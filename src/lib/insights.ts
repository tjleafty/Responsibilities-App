import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { assigneesOf, choreState, isActive, kidsOf } from "@/lib/family"
import { isOnWeek, scheduleFor, startOfWeek } from "@/lib/choreSchedule"
import { getPeriodKey } from "@/lib/choreUtils"
import { requestCost, requestedRewardId, requestState, type PrizeRequest } from "@/lib/prizeRequests"
import { parseUTC } from "@/lib/utils"

/*
 * Family insights, worked out from the chores and completions already loaded.
 * Every chore a kid was due to do in the range is one "expected" item; it counts as
 * done when its completion was approved. A period that is still open (today, this
 * week, this month) only counts once it's done, so the current day never drags
 * the rate down.
 */

export type RangeDays = 7 | 30 | 90

interface Expected {
  chore: ChoreRecord
  kidId: string
  /** First day of the chore's period: the day, the Monday, or the 1st of the month. */
  date: Date
  done: boolean
  open: boolean
}


const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const createdAt = (row: { created_at?: string }) => (row.created_at ? dayStart(parseUTC(row.created_at)) : null)
const isApproved = (row: ChoreCompletionRecord) => choreState(row) === "done"

function expectedItems(chores: ChoreRecord[], completions: ChoreCompletionRecord[], profiles: FamilyProfile[], from: Date, to: Date, today: Date): Expected[] {
  const kids = new Set(kidsOf(profiles).map((kid) => kid.id))
  const done = new Set(completions.filter(isApproved).map((row) => `${row.chore_id}|${row.profile_id}|${row.period_key}`))
  const items: Expected[] = []
  chores.filter(isActive).forEach((chore) => {
    const born = createdAt(chore as ChoreRecord & { created_at?: string })
    for (let day = dayStart(from); day <= to; day = addDays(day, 1)) {
      if (born && day < born) continue
      assigneesOf(chore, profiles, day).filter((id) => kids.has(id)).forEach((kidId) => {
        const schedule = scheduleFor(chore, kidId)
        const first = day.getTime() === dayStart(from).getTime()
        // One item per period: on its first day, or on the range's first day for a period already underway.
        const starts = schedule.frequency === "daily" ? true
          : schedule.frequency === "weekly" ? (day.getDay() === 1 || first) && isOnWeek(schedule, day)
            : day.getDate() === 1 || first
        if (!starts) return
        const periodStart = schedule.frequency === "daily" ? day : schedule.frequency === "weekly" ? startOfWeek(day) : new Date(day.getFullYear(), day.getMonth(), 1)
        const key = getPeriodKey(schedule.frequency, day)
        const open = key === getPeriodKey(schedule.frequency, today)
        items.push({ chore, kidId, date: periodStart < from ? dayStart(from) : periodStart, done: done.has(`${chore.id}|${kidId}|${key}`), open })
      })
    }
  })
  // Open periods count only once they're done.
  return items.filter((item) => item.done || !item.open)
}

const rate = (items: Expected[]) => (items.length ? items.filter((item) => item.done).length / items.length : null)

export interface Bucket { label: string; from: Date; rate: number | null; done: number; expected: number }
export interface KidInsight { kid: FamilyProfile; rate: number | null; done: number; expected: number; earned: number; spent: number; trend: Bucket[] }
export interface ChoreInsight { chore: ChoreRecord; rate: number; done: number; expected: number }
export interface PrizeInsight { reward: FamilyReward | null; title: string; times: number; points: number }

export interface Insights {
  rate: number | null
  previousRate: number | null
  done: number
  expected: number
  earned: number
  spent: number
  trend: Bucket[]
  kids: KidInsight[]
  /** Chores with enough history to judge, best first. */
  chores: ChoreInsight[]
  prizes: PrizeInsight[]
}

function buckets(items: Expected[], from: Date, days: RangeDays): Bucket[] {
  const size = days === 7 ? 1 : 7
  const list: Bucket[] = []
  for (let start = dayStart(from); list.length < Math.ceil(days / size); start = addDays(start, size)) {
    const end = addDays(start, size)
    const inside = items.filter((item) => item.date >= start && item.date < end)
    list.push({
      label: size === 1 ? start.toLocaleDateString(undefined, { weekday: "short" }) : start.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      from: start, rate: rate(inside), done: inside.filter((item) => item.done).length, expected: inside.length,
    })
  }
  return list
}

const within = (stamp: string | undefined | null, from: Date, to: Date) => {
  if (!stamp) return false
  const when = parseUTC(stamp)
  return when >= from && when < addDays(to, 1)
}

export function familyInsights(
  { chores, completions, prizeRequests, profiles, rewards }: { chores: ChoreRecord[]; completions: ChoreCompletionRecord[]; prizeRequests: PrizeRequest[]; profiles: FamilyProfile[]; rewards: FamilyReward[] },
  days: RangeDays,
  now = new Date(),
): Insights {
  const today = dayStart(now)
  const from = addDays(today, -(days - 1))
  const items = expectedItems(chores, completions, profiles, from, today, today)
  const previous = expectedItems(chores, completions, profiles, addDays(from, -days), addDays(from, -1), today)
  const earnedRows = completions.filter((row) => isApproved(row) && within(row.verified_at ?? row.completed_at, from, today))
  const granted = prizeRequests.filter((row) => requestState(row) === "granted" && within(row.verified_at ?? row.completed_at, from, today))
  const sum = (rows: ChoreCompletionRecord[]) => rows.reduce((total, row) => total + (Number(row.reward_points_snapshot) || 0), 0)

  const kids = kidsOf(profiles).map((kid) => {
    const own = items.filter((item) => item.kidId === kid.id)
    return {
      kid, rate: rate(own), done: own.filter((item) => item.done).length, expected: own.length,
      earned: sum(earnedRows.filter((row) => row.profile_id === kid.id)),
      spent: granted.filter((row) => row.profile_id === kid.id).reduce((total, row) => total + requestCost(row), 0),
      trend: buckets(own, from, days),
    }
  })

  const byChore = new Map<string, ChoreInsight>()
  items.forEach((item) => {
    const entry = byChore.get(item.chore.id) ?? { chore: item.chore, rate: 0, done: 0, expected: 0 }
    entry.expected += 1
    if (item.done) entry.done += 1
    byChore.set(item.chore.id, entry)
  })
  const choreList = [...byChore.values()].map((entry) => ({ ...entry, rate: entry.done / entry.expected }))
    .sort((a, b) => b.rate - a.rate || b.done - a.done)

  const byPrize = new Map<string, PrizeInsight>()
  granted.forEach((row) => {
    const id = requestedRewardId(row)
    const reward = rewards.find((item) => item.id === id) ?? null
    const entry = byPrize.get(id) ?? { reward, title: reward?.title ?? "A prize", times: 0, points: 0 }
    entry.times += 1
    entry.points += requestCost(row)
    byPrize.set(id, entry)
  })

  return {
    rate: rate(items), previousRate: rate(previous),
    done: items.filter((item) => item.done).length, expected: items.length,
    earned: sum(earnedRows), spent: granted.reduce((total, row) => total + requestCost(row), 0),
    trend: buckets(items, from, days), kids, chores: choreList,
    prizes: [...byPrize.values()].sort((a, b) => b.points - a.points),
  }
}

export const percent = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`)
