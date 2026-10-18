import type { ChoreCompletionRecord, ChoreRecord, ChoreSubtask, GoalFrequency, FamilyProfile } from "@/lib/familyTypes"

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
    if (chore.frequency !== "daily" || chore.is_active === false) return false
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
