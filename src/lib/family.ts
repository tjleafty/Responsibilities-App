import { applySwaps } from "@/lib/swaps"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { getAssignedProfileIds, getPeriodKey, getRandomGroup, isRandomAssignmentEnabled } from "@/lib/choreUtils"
import { dueStatus, frequencyFor, isTodayChore, scheduleFor } from "@/lib/choreSchedule"
import { parseUTC } from "@/lib/utils"

export type ChoreState = "todo" | "in_progress" | "waiting" | "done" | "sent_back"

export function requiresApproval(chore: ChoreRecord): boolean {
  return chore.requires_verification === true || chore.requires_verification === 1
}

export function isActive<T extends { is_active?: boolean }>(row: T): boolean {
  return row.is_active !== false
}

export function kidsOf(profiles: FamilyProfile[]): FamilyProfile[] {
  return profiles.filter((profile) => profile.profile_type === "child" && isActive(profile))
}

export function grownUpsOf(profiles: FamilyProfile[]): FamilyProfile[] {
  return profiles.filter((profile) => profile.profile_type === "parent" && isActive(profile))
}

/** Who a chore belongs to for the period that contains `date` (random assignment picks one kid or a group). */
export function assigneesOf(chore: ChoreRecord, profiles: FamilyProfile[], date = new Date()): string[] {
  const kids = isRandomAssignmentEnabled(chore) ? getRandomGroup(chore, profiles, date) : getAssignedProfileIds(chore)
  return applySwaps(chore, kids, date)
}

/** The chores on a kid's list on `date`: assigned to them and due (weekly chores with a due day wait for that day). */
export function choresFor(profileId: string, chores: ChoreRecord[], profiles: FamilyProfile[], date = new Date()): ChoreRecord[] {
  return chores.filter((chore) => {
    if (!isActive(chore) || !assigneesOf(chore, profiles, date).includes(profileId)) return false
    const status = dueStatus(scheduleFor(chore, profileId), date)
    return status === "due" || status === "late"
  })
}

/** Due today (daily, or a weekly chore whose day it is) rather than any time this week or month. */
export function isTodayFor(chore: ChoreRecord, profileId: string): boolean {
  return isTodayChore(scheduleFor(chore, profileId))
}

/** A weekly chore whose due day has passed this week. */
export function isLate(chore: ChoreRecord, profileId: string, date = new Date()): boolean {
  return dueStatus(scheduleFor(chore, profileId), date) === "late"
}

export function completionFor(chore: ChoreRecord, profileId: string, completions: ChoreCompletionRecord[], date = new Date()) {
  const periodKey = getPeriodKey(frequencyFor(chore, profileId), date)
  return completions.find((row) => row.chore_id === chore.id && row.profile_id === profileId && row.period_key === periodKey) ?? null
}

export function choreState(completion: ChoreCompletionRecord | null): ChoreState {
  if (!completion) return "todo"
  if (completion.status === "rejected" || completion.review_status === "rejected") return "sent_back"
  if (completion.status === "approved" || completion.review_status === "approved") return "done"
  if (completion.status === "pending_verification" || (completion.completed_at && completion.review_status === "unreviewed")) return "waiting"
  return "in_progress"
}

/** Completions a grown-up still has to look at. */
export function awaitingReview(completions: ChoreCompletionRecord[]): ChoreCompletionRecord[] {
  return completions.filter((row) => choreState(row) === "waiting")
}

function isApproved(row: ChoreCompletionRecord) {
  return row.status === "approved" || row.review_status === "approved"
}

function approvedOn(row: ChoreCompletionRecord): Date | null {
  const stamp = row.verified_at || row.completed_at
  return stamp ? parseUTC(stamp) : null
}

export function pointsEarned(profileId: string, completions: ChoreCompletionRecord[]): number {
  return completions
    .filter((row) => row.profile_id === profileId && isApproved(row))
    .reduce((sum, row) => sum + (Number(row.reward_points_snapshot) || 0), 0)
}

export function pointsToday(profileId: string, completions: ChoreCompletionRecord[], date = new Date()): number {
  const today = getPeriodKey("daily", date)
  return completions
    .filter((row) => row.profile_id === profileId && isApproved(row))
    .filter((row) => {
      const when = approvedOn(row)
      return when ? getPeriodKey("daily", when) === today : false
    })
    .reduce((sum, row) => sum + (Number(row.reward_points_snapshot) || 0), 0)
}

export function choresDone(profileId: string, completions: ChoreCompletionRecord[]): number {
  return completions.filter((row) => row.profile_id === profileId && isApproved(row)).length
}

function approvedDays(profileId: string, completions: ChoreCompletionRecord[]): Set<string> {
  const days = new Set<string>()
  completions.forEach((row) => {
    if (row.profile_id !== profileId || !isApproved(row)) return
    const when = approvedOn(row)
    if (when) days.add(getPeriodKey("daily", when))
  })
  return days
}

/** Days in a row, ending today or yesterday, with at least one approved chore. */
export function currentStreak(profileId: string, completions: ChoreCompletionRecord[], date = new Date()): number {
  const days = approvedDays(profileId, completions)
  const cursor = new Date(date)
  if (!days.has(getPeriodKey("daily", cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (days.has(getPeriodKey("daily", cursor))) {
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

export function bestStreak(profileId: string, completions: ChoreCompletionRecord[]): number {
  const sorted = [...approvedDays(profileId, completions)].sort()
  let best = 0
  let run = 0
  let previous: Date | null = null
  for (const key of sorted) {
    const [year, month, day] = key.split("-").map(Number)
    const current = new Date(year, month - 1, day)
    run = previous && Math.round((current.getTime() - previous.getTime()) / 86400000) === 1 ? run + 1 : 1
    best = Math.max(best, run)
    previous = current
  }
  return best
}

export interface TodayRow {
  chore: ChoreRecord
  profile: FamilyProfile
  completion: ChoreCompletionRecord | null
  state: ChoreState
}

/** Every kid's chores for today plus this week's and month's, with their state. */
export function familyRows(chores: ChoreRecord[], completions: ChoreCompletionRecord[], profiles: FamilyProfile[], date = new Date()): TodayRow[] {
  return kidsOf(profiles).flatMap((profile) => choresFor(profile.id, chores, profiles, date).map((chore) => {
    const completion = completionFor(chore, profile.id, completions, date)
    return { chore, profile, completion, state: choreState(completion) }
  }))
}

export function relativeTime(stamp?: string | null): string {
  if (!stamp) return ""
  const minutes = Math.round((Date.now() - parseUTC(stamp).getTime()) / 60000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  return days === 1 ? "yesterday" : `${days} days ago`
}

export function firstName(profile?: FamilyProfile | null): string {
  return profile?.display_name.split(" ")[0] ?? ""
}
