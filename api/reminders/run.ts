import webpush from "web-push"
import { serviceDb, type ApiRequest, type ApiResponse } from "../_lib/server.js"
// Shared with the app (relative imports, no "@/" alias, so the server bundle can use them).
import { dueStatus, isTodayChore, scheduleFor } from "../../src/lib/choreSchedule.js"
import { chorePeriodKey, getAssignedProfileIds, getRandomGroup, isRandomAssignmentEnabled, schedulePeriodKey } from "../../src/lib/choreUtils.js"
import { kidNudge, parentSummary } from "../../src/lib/nudges.js"
import { isTeenKey } from "../../src/lib/teen.js"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "../../src/lib/familyTypes.js"

/*
 * Sends the push reminders that are due right now. Called every 15 minutes (pg_cron in
 * Supabase, see migration 20261029000000). Each family's reminder times are in its own
 * time zone, and reminder_log makes sure each one goes out once a day, so calling this
 * more often never sends twice.
 */

const WINDOW_MINUTES = 15
const DUE_DAY_MORNING = "08:00"

interface Reminders { kidTimes?: string[]; parentTime?: string | null; dueDayMorning?: boolean; timeZone?: string }
interface Subscription { id: string; profile_id: string | null; endpoint: string; p256dh: string; auth: string }
interface Swap { kind: string; status: string; from_profile_id: string; to_profile_id: string; give_chore_id: string | null; give_period_key: string | null; take_chore_id: string | null; take_period_key: string | null }

/** The family's wall-clock time, as a Date whose local fields read like their clock. */
function localNow(timeZone: string, now = new Date()) {
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", hourCycle: "h23" })
      .formatToParts(now).map((part) => [part.type, part.value]))
    return new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute))
  } catch {
    return null
  }
}

const minutesOf = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + (minutes || 0)
}
const inWindow = (time: string, clock: Date) => {
  const diff = clock.getHours() * 60 + clock.getMinutes() - minutesOf(time)
  return diff >= 0 && diff < WINDOW_MINUTES
}

function assignees(chore: ChoreRecord, profiles: FamilyProfile[], swaps: Swap[], date: Date) {
  let kids = isRandomAssignmentEnabled(chore) ? getRandomGroup(chore, profiles, date) : getAssignedProfileIds(chore)
  const key = (kid: string) => chorePeriodKey(chore, kid, date)
  swaps.forEach((swap) => {
    if (swap.give_chore_id === chore.id && kids.includes(swap.from_profile_id) && swap.give_period_key === key(swap.from_profile_id)) kids = kids.map((id) => (id === swap.from_profile_id ? swap.to_profile_id : id))
    if (swap.take_chore_id === chore.id && kids.includes(swap.to_profile_id) && swap.take_period_key === key(swap.to_profile_id)) kids = kids.map((id) => (id === swap.to_profile_id ? swap.from_profile_id : id))
  })
  return kids
}

/** A kid's chores for today that they haven't finished (sent for approval counts as finished). */
function choresLeft(kid: FamilyProfile, chores: ChoreRecord[], completions: ChoreCompletionRecord[], profiles: FamilyProfile[], swaps: Swap[], clock: Date, dueTodayOnly = false) {
  return chores.filter((chore) => {
    if (chore.is_active === false || !assignees(chore, profiles, swaps, clock).includes(kid.id)) return false
    const schedule = scheduleFor(chore, kid.id)
    const status = dueStatus(schedule, clock)
    if (dueTodayOnly ? !(schedule.frequency === "weekly" && schedule.days.includes(clock.getDay())) : !(status === "late" || (status === "due" && isTodayChore(schedule)))) return false
    const key = schedulePeriodKey(schedule, clock)
    const row = completions.find((item) => item.chore_id === chore.id && item.profile_id === kid.id && item.period_key === key)
    return !row || row.status === "in_progress" || row.status === "rejected"
  }).map((chore) => ({ chore, late: dueStatus(scheduleFor(chore, kid.id), clock) === "late" }))
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ ok: false })
  const db = serviceDb()
  const publicKey = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!db || !publicKey || !privateKey) return res.status(503).json({ ok: false, error: "Reminders aren't set up (SUPABASE_SERVICE_ROLE_KEY, VAPID keys)." })
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://responsibilities-app.vercel.app", publicKey, privateKey)

  // Only families with at least one device signed up for reminders.
  const { data: subs, error } = await db.from("push_subscriptions").select("id, family_id, profile_id, endpoint, p256dh, auth")
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const byFamily = new Map<string, Subscription[]>()
  ;(subs ?? []).forEach((sub) => byFamily.set(sub.family_id, [...(byFamily.get(sub.family_id) ?? []), sub]))

  let sent = 0
  const gone: string[] = []
  const push = async (targets: Subscription[], message: { title: string; body: string }, tag: string) => {
    await Promise.all(targets.map(async (sub) => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ ...message, tag, url: "/dashboard" }), { TTL: 3600 })
        sent += 1
      } catch (failure) {
        const status = (failure as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) gone.push(sub.id)
        else console.error("Push failed:", status, failure)
      }
    }))
  }

  for (const [familyId, targets] of byFamily) {
    const { data: family } = await db.from("families").select("id, settings").eq("id", familyId).maybeSingle()
    const reminders = ((family?.settings as { reminders?: Reminders } | null)?.reminders ?? {}) as Reminders
    const clock = localNow(reminders.timeZone || "America/New_York")
    if (!clock) continue
    const kidTimes = reminders.kidTimes ?? ["16:00", "19:00"]
    const parentTime = reminders.parentTime === undefined ? "19:30" : reminders.parentTime
    const slots: Array<{ slot: string; kind: "kids" | "evening" | "due" | "parents" }> = []
    kidTimes.forEach((time, index) => { if (inWindow(time, clock)) slots.push({ slot: `kids-${time}`, kind: index === kidTimes.length - 1 && kidTimes.length > 1 ? "evening" : "kids" }) })
    if (reminders.dueDayMorning !== false && inWindow(DUE_DAY_MORNING, clock)) slots.push({ slot: "due-morning", kind: "due" })
    if (parentTime && inWindow(parentTime, clock)) slots.push({ slot: `parents-${parentTime}`, kind: "parents" })
    if (slots.length === 0) continue

    const [profiles, chores, completions, swaps] = await Promise.all([
      db.from("family_profiles").select("*").eq("family_id", familyId),
      db.from("chores").select("*").eq("family_id", familyId).eq("is_active", true),
      db.from("chore_completions").select("chore_id, profile_id, period_key, status").eq("family_id", familyId).gte("created_at", new Date(Date.now() - 40 * 86400000).toISOString()),
      db.from("chore_swaps").select("*").eq("family_id", familyId).eq("status", "approved"),
    ])
    const people = (profiles.data ?? []) as FamilyProfile[]
    const kids = people.filter((profile) => profile.profile_type === "child" && profile.is_active !== false)
    const today = `${clock.getFullYear()}-${String(clock.getMonth() + 1).padStart(2, "0")}-${String(clock.getDate()).padStart(2, "0")}`

    for (const { slot, kind } of slots) {
      // Claim the slot first; a second run in the same window finds it taken.
      const { error: claimed } = await db.from("reminder_log").insert({ family_id: familyId, slot, sent_on: today })
      if (claimed) continue
      const left = kids.map((kid) => ({ kid, chores: choresLeft(kid, (chores.data ?? []) as ChoreRecord[], (completions.data ?? []) as ChoreCompletionRecord[], people, (swaps.data ?? []) as Swap[], clock, kind === "due") }))
      if (kind === "parents") {
        const grownUps = targets.filter((sub) => !sub.profile_id || people.find((profile) => profile.id === sub.profile_id)?.profile_type === "parent")
        await push(grownUps, parentSummary(left.map((row) => ({ name: row.kid.display_name.split(" ")[0], left: row.chores.length }))), "parents")
        continue
      }
      for (const row of left) {
        if (row.chores.length === 0) continue
        const devices = targets.filter((sub) => sub.profile_id === row.kid.id)
        if (devices.length === 0) continue
        const birthYear = (row.kid as FamilyProfile & { birth_year?: number | null }).birth_year
        const age = birthYear ? clock.getFullYear() - birthYear : null
        const first = row.chores.find((item) => item.late) ?? row.chores[0]
        await push(devices, kidNudge({ name: row.kid.display_name.split(" ")[0], age, left: row.chores.length, first: first.chore.title, late: first.late, evening: kind === "evening", teen: isTeenKey(row.kid.theme_key) }), `kid-${row.kid.id}`)
      }
    }
  }

  if (gone.length) await db.from("push_subscriptions").delete().in("id", gone)
  return res.status(200).json({ ok: true, sent, removed: gone.length })
}
