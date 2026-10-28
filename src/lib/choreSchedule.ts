import type { ChoreRecord, GoalFrequency } from "./familyTypes.js"

/*
 * When a chore shows up. Stored as JSON in chores.schedule (migration 20261028000000):
 *   { weekday, every, anchor, kids: { [profileId]: { frequency, weekday, every, anchor } } }
 * Everything is optional, so chores saved before schedules existed act as before.
 */

export interface ChoreSchedule {
  frequency: GoalFrequency
  /** Weekly chores only: the day it's due, 0 = Sunday ... 6 = Saturday (like Date.getDay). Null = any day that week. */
  weekday: number | null
  /** Weekly chores only: 1 = every week, 2 = every other week. */
  every: 1 | 2
  /** Every-other-week chores: any date inside a week the chore is on. */
  anchor: string | null
}

type StoredSchedule = Partial<Omit<ChoreSchedule, "frequency">> & { kids?: Record<string, Partial<ChoreSchedule>> }

export type DueStatus = "off" | "upcoming" | "due" | "late"

export const WEEKDAYS = [
  { value: 1, short: "Mon", long: "Monday" },
  { value: 2, short: "Tue", long: "Tuesday" },
  { value: 3, short: "Wed", long: "Wednesday" },
  { value: 4, short: "Thu", long: "Thursday" },
  { value: 5, short: "Fri", long: "Friday" },
  { value: 6, short: "Sat", long: "Saturday" },
  { value: 0, short: "Sun", long: "Sunday" },
]

function readStored(chore: Pick<ChoreRecord, "schedule">): StoredSchedule {
  if (!chore.schedule) return {}
  try {
    const parsed = JSON.parse(chore.schedule) as unknown
    return parsed && typeof parsed === "object" ? parsed as StoredSchedule : {}
  } catch {
    return {}
  }
}

function normalize(frequency: GoalFrequency, value: Partial<ChoreSchedule>): ChoreSchedule {
  const weekly = frequency === "weekly"
  const weekday = weekly && typeof value.weekday === "number" && value.weekday >= 0 && value.weekday <= 6 ? value.weekday : null
  const every = weekly && value.every === 2 ? 2 : 1
  return { frequency, weekday, every, anchor: every === 2 ? value.anchor ?? null : null }
}

/** The chore's own schedule, before any per-kid overrides. */
export function baseSchedule(chore: ChoreRecord): ChoreSchedule {
  return normalize(chore.frequency, readStored(chore))
}

/** Kids with their own schedule on this chore, keyed by profile id. */
export function kidSchedules(chore: ChoreRecord): Record<string, ChoreSchedule> {
  const kids = readStored(chore).kids ?? {}
  return Object.fromEntries(Object.entries(kids).map(([id, value]) => [id, normalize(value.frequency ?? chore.frequency, value)]))
}

/** The schedule a kid follows for this chore: their own if they have one, otherwise the chore's. */
export function scheduleFor(chore: ChoreRecord, profileId?: string | null): ChoreSchedule {
  if (profileId) {
    const own = kidSchedules(chore)[profileId]
    if (own) return own
  }
  return baseSchedule(chore)
}

export function frequencyFor(chore: ChoreRecord, profileId?: string | null): GoalFrequency {
  return scheduleFor(chore, profileId).frequency
}

/** JSON for chores.schedule, or null when everything is the default. */
export function serializeSchedule(base: ChoreSchedule, kids: Record<string, ChoreSchedule> | null): string | null {
  const strip = (schedule: ChoreSchedule, withFrequency: boolean) => {
    const out: Partial<ChoreSchedule> = withFrequency ? { frequency: schedule.frequency } : {}
    if (schedule.frequency === "weekly") {
      if (schedule.weekday !== null) out.weekday = schedule.weekday
      if (schedule.every === 2) {
        out.every = 2
        out.anchor = schedule.anchor ?? isoDate(startOfWeek(new Date()))
      }
    }
    return out
  }
  const stored: StoredSchedule = strip(base, false)
  if (kids && Object.keys(kids).length > 0) stored.kids = Object.fromEntries(Object.entries(kids).map(([id, schedule]) => [id, strip(schedule, true)]))
  return Object.keys(stored).length > 0 ? JSON.stringify(stored) : null
}

/** Monday of the week that contains `date`, matching the ISO weeks used for weekly period keys. */
export function startOfWeek(date: Date): Date {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return monday
}

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function weekNumber(date: Date): number {
  const monday = startOfWeek(date)
  return Math.round(Date.UTC(monday.getFullYear(), monday.getMonth(), monday.getDate()) / (7 * 86400000))
}

function parseDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

/** Whether an every-other-week chore is on in the week containing `date`. */
export function isOnWeek(schedule: ChoreSchedule, date: Date): boolean {
  if (schedule.frequency !== "weekly" || schedule.every !== 2) return true
  const anchor = schedule.anchor ? parseDate(schedule.anchor) : date
  return Math.abs(weekNumber(date) - weekNumber(anchor)) % 2 === 0
}

/**
 * Whether the chore is on a kid's list on `date`. A weekly chore with a due day
 * appears that day and stays (as late) for the rest of its week until it's done.
 */
export function dueStatus(schedule: ChoreSchedule, date = new Date()): DueStatus {
  if (schedule.frequency !== "weekly") return "due"
  if (!isOnWeek(schedule, date)) return "off"
  if (schedule.weekday === null) return "due"
  const today = (date.getDay() + 6) % 7
  const due = (schedule.weekday + 6) % 7
  return today < due ? "upcoming" : today === due ? "due" : "late"
}

/** Goes on the "today" part of a kid's list rather than "this week and month". */
export function isTodayChore(schedule: ChoreSchedule): boolean {
  return schedule.frequency === "daily" || (schedule.frequency === "weekly" && schedule.weekday !== null)
}

export function scheduleLabel(schedule: ChoreSchedule): string {
  if (schedule.frequency === "daily") return "Daily"
  if (schedule.frequency === "monthly") return "Monthly"
  const day = WEEKDAYS.find((item) => item.value === schedule.weekday)
  if (schedule.every === 2) return day ? `Every other ${day.short}` : "Every other week"
  return day ? `Every ${day.short}` : "Weekly"
}

/** Short label for a chore in lists; "Varies" when kids have different schedules. */
export function choreScheduleLabel(chore: ChoreRecord): string {
  const kids = Object.values(kidSchedules(chore))
  if (kids.length === 0) return scheduleLabel(baseSchedule(chore))
  const labels = new Set(kids.map(scheduleLabel))
  return labels.size === 1 ? [...labels][0] : "Varies by kid"
}
