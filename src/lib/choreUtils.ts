// Relative so the server (api/reminders) can use this file too.
import { frequencyFor } from "./choreSchedule.js"
import type { ChoreCompletionRecord, ChoreRecord, ChoreSubtask, GoalFrequency, FamilyProfile, RandomMode } from "./familyTypes.js"

export function getAssignedProfileIds(chore: ChoreRecord): string[] {
  if (chore.assigned_profile_ids) {
    try {
      const ids = JSON.parse(chore.assigned_profile_ids) as unknown
      if (Array.isArray(ids)) return ids.filter((id): id is string => typeof id === "string")
    } catch {
      // Older rows use target_profile_id only.
    }
  }
  return chore.target_profile_id ? [chore.target_profile_id] : []
}

export function isRandomAssignmentEnabled(chore: ChoreRecord): boolean {
  return chore.random_assignment_enabled === true || chore.random_assignment_enabled === 1
}

export function isAssignmentRotationEnabled(chore: ChoreRecord): boolean {
  return chore.assignment_rotation_enabled === true || chore.assignment_rotation_enabled === 1
}

function stableHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 16777619)
  }
  return hash >>> 0
}

function periodOrdinal(frequency: GoalFrequency, date: Date): number {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
  if (frequency === "daily") return day
  if (frequency === "weekly") return Math.floor((day + 3) / 7)
  return date.getFullYear() * 12 + date.getMonth()
}

export function getRandomlyAssignedProfileId(
  chore: ChoreRecord,
  profiles: FamilyProfile[],
  date = new Date(),
): string | null {
  if (!isRandomAssignmentEnabled(chore)) return null
  const selectedIds = new Set(getAssignedProfileIds(chore))
  const childIds = profiles
    .filter((profile) => profile.profile_type === "child" && profile.is_active !== false && selectedIds.has(profile.id))
    .map((profile) => profile.id)
  if (childIds.length === 0) return null

  const shuffledIds = childIds.sort((left, right) => {
    const leftHash = stableHash(`${chore.id}:${left}`)
    const rightHash = stableHash(`${chore.id}:${right}`)
    return leftHash - rightHash || left.localeCompare(right)
  })
  if (!isAssignmentRotationEnabled(chore) || shuffledIds.length === 1) {
    return shuffledIds[stableHash(chore.id) % shuffledIds.length]
  }

  const cadence = chore.assignment_change_frequency ?? "weekly"
  const offset = stableHash(chore.id) % shuffledIds.length
  const index = (periodOrdinal(cadence, date) + offset) % shuffledIds.length
  return shuffledIds[index]
}

export function randomModeOf(chore: ChoreRecord): RandomMode {
  return chore.random_mode === "subtasks" || chore.random_mode === "chore_and_subtasks" ? chore.random_mode : "chore"
}

/** Same order every time for the same seed, so everyone sees the same split for a period. */
function seededOrder<T>(items: T[], key: (item: T) => string, seed: string): T[] {
  return [...items].sort((left, right) => stableHash(`${seed}:${key(left)}`) - stableHash(`${seed}:${key(right)}`) || key(left).localeCompare(key(right)))
}

function rotationSeed(chore: ChoreRecord, date: Date): string {
  if (!isAssignmentRotationEnabled(chore)) return chore.id
  return `${chore.id}:${periodOrdinal(chore.assignment_change_frequency ?? "weekly", date)}`
}

/**
 * Kids who share a randomly assigned chore whose steps are split: every picked kid
 * ("subtasks"), or a random group of random_group_size kids ("chore_and_subtasks").
 */
function splitGroup(chore: ChoreRecord, profiles: FamilyProfile[], date: Date): string[] {
  const selectedIds = new Set(getAssignedProfileIds(chore))
  const childIds = profiles
    .filter((profile) => profile.profile_type === "child" && profile.is_active !== false && selectedIds.has(profile.id))
    .map((profile) => profile.id)
  const seed = rotationSeed(chore, date)
  const ordered = seededOrder(childIds, (id) => id, seed)
  if (randomModeOf(chore) === "subtasks") return ordered
  const size = Math.min(ordered.length, Math.max(1, Number(chore.random_group_size) || 2))
  return ordered.slice(0, size)
}

/** Who gets the chore for the period containing `date` when random assignment is on. */
export function getRandomGroup(chore: ChoreRecord, profiles: FamilyProfile[], date = new Date()): string[] {
  if (!isRandomAssignmentEnabled(chore)) return []
  if (randomModeOf(chore) === "chore") {
    const id = getRandomlyAssignedProfileId(chore, profiles, date)
    return id ? [id] : []
  }
  const group = splitGroup(chore, profiles, date)
  // With fewer steps than kids, kids left without a step sit this one out.
  const steps = parseChoreSubtasks(chore.subtasks)
  return steps.length > 0 ? group.slice(0, steps.length) : group
}

/** The steps a kid does: all of them, or their share when the steps are split at random. */
export function subtasksFor(chore: ChoreRecord, profileId: string, profiles: FamilyProfile[], date = new Date()): ChoreSubtask[] {
  const steps = parseChoreSubtasks(chore.subtasks)
  if (!isRandomAssignmentEnabled(chore) || randomModeOf(chore) === "chore") return steps
  const group = getRandomGroup(chore, profiles, date)
  if (group.length <= 1) return group.includes(profileId) ? steps : []
  const dealt = seededOrder(steps, (step) => step.id, rotationSeed(chore, date))
  const mine = new Set(dealt.filter((_, index) => group[index % group.length] === profileId).map((step) => step.id))
  return steps.filter((step) => mine.has(step.id))
}

export function areDailyChoresApproved(
  chores: ChoreRecord[],
  completions: ChoreCompletionRecord[],
  profiles: FamilyProfile[],
  profileId: string,
  date = new Date(),
  replacement?: ChoreCompletionRecord,
): boolean {
  const profile = profiles.find((item) => item.id === profileId && item.profile_type === "child" && item.is_active !== false)
  if (!profile) return false

  const periodKey = getPeriodKey("daily", date)
  const assignedToday = chores.filter((chore) => {
    if (frequencyFor(chore, profileId) !== "daily" || chore.is_active === false) return false
    if (isRandomAssignmentEnabled(chore)) return getRandomlyAssignedProfileId(chore, profiles, date) === profileId
    return getAssignedProfileIds(chore).includes(profileId)
  })

  return assignedToday.length > 0 && assignedToday.every((chore) => {
    const completion = replacement && replacement.chore_id === chore.id && replacement.profile_id === profileId && replacement.period_key === periodKey
      ? replacement
      : completions.find((item) => item.chore_id === chore.id && item.profile_id === profileId && item.period_key === periodKey)
    return completion?.status === "approved" || completion?.review_status === "approved"
  })
}

export function parseChoreSubtasks(value?: string | null): ChoreSubtask[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is ChoreSubtask => Boolean(item && typeof item.id === "string" && typeof item.title === "string"))
  } catch {
    return []
  }
}

export function parseCompletedTaskIds(value?: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export function getPeriodKey(frequency: GoalFrequency, date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  if (frequency === "daily") return `${year}-${month}-${day}`
  if (frequency === "monthly") return `${year}-${month}`

  const thursday = new Date(year, date.getMonth(), date.getDate())
  thursday.setDate(thursday.getDate() + 3 - ((thursday.getDay() + 6) % 7))
  const weekYear = thursday.getFullYear()
  const firstThursday = new Date(weekYear, 0, 4)
  const weekNumber = 1 + Math.round(((thursday.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7)
  return `${weekYear}-W${String(weekNumber).padStart(2, "0")}`
}

export function makeTaskId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function getLocalPeriodKey(type: "daily" | "weekly" | "monthly", date = new Date()): string {
  if (type === "daily") return getPeriodKey("daily", date)
  if (type === "weekly") return getPeriodKey("weekly", date)
  return getPeriodKey("monthly", date)
}
