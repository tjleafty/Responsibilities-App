import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"

/*
 * Family-wide rules, stored as JSON in families.settings (migration 20261028000100).
 * Every field has a default, so a family that never opened settings (or a database
 * without the column) behaves exactly as before.
 */

export interface FamilySettings {
  points: {
    /** Points a new chore starts with. */
    defaultPoints: number
    /** Points are multiplied by these for chores marked easy, medium or hard. */
    multipliers: { easy: number; medium: number; hard: number }
  }
  prizes: {
    kidsCanAsk: boolean
    /** Most prize asks a kid can make in 7 days; null = no limit. */
    maxAsksPerWeek: number | null
    /** Prizes costing this much or less are granted without a grown-up; null = always ask. */
    autoGrantUpTo: number | null
  }
  notifications: {
    approvalNeeded: boolean
    prizeRequest: boolean
    /** Logins in the family that don't want the emails. */
    mutedUserIds: string[]
  }
  suggestions: {
    /** Sort and badge chore ideas by each kid's age. */
    ageBased: boolean
  }
  celebrations: {
    animations: boolean
    sounds: boolean
    allDoneTrophy: boolean
  }
}

export const DEFAULT_SETTINGS: FamilySettings = {
  points: { defaultPoints: 5, multipliers: { easy: 1, medium: 1.5, hard: 2 } },
  prizes: { kidsCanAsk: true, maxAsksPerWeek: null, autoGrantUpTo: null },
  notifications: { approvalNeeded: false, prizeRequest: false, mutedUserIds: [] },
  suggestions: { ageBased: true },
  celebrations: { animations: true, sounds: true, allDoneTrophy: true },
}

type Stored = { [K in keyof FamilySettings]?: Partial<FamilySettings[K]> }

function withDefaults(stored: Stored | null | undefined): FamilySettings {
  const value = stored ?? {}
  return {
    points: { ...DEFAULT_SETTINGS.points, ...value.points, multipliers: { ...DEFAULT_SETTINGS.points.multipliers, ...value.points?.multipliers } },
    prizes: { ...DEFAULT_SETTINGS.prizes, ...value.prizes },
    notifications: { ...DEFAULT_SETTINGS.notifications, ...value.notifications },
    suggestions: { ...DEFAULT_SETTINGS.suggestions, ...value.suggestions },
    celebrations: { ...DEFAULT_SETTINGS.celebrations, ...value.celebrations },
  }
}

let current: FamilySettings = DEFAULT_SETTINGS
let familyId: string | null = null
let available = DEMO_MODE
const listeners = new Set<() => void>()
const publish = () => listeners.forEach((listener) => listener())

/** The settings most recently loaded, for code outside React (celebrations, chore actions). */
export function familySettings(): FamilySettings {
  return current
}

/** False until the settings column exists on the database. */
export function familySettingsAvailable(): boolean {
  return available
}

export async function loadFamilySettings(): Promise<FamilySettings> {
  if (DEMO_MODE) return current
  const { data, error } = await supabase.from("families").select("id, settings").order("created_at").limit(1).maybeSingle()
  if (error) {
    // 42703 / PGRST204: the settings column isn't there yet; PGRST205: no families table.
    if (!["42703", "PGRST204", "PGRST205", "42P01"].includes(error.code ?? "")) console.error("Loading family settings failed:", error)
    available = false
    current = DEFAULT_SETTINGS
  } else {
    available = !!data
    familyId = data?.id ?? null
    current = withDefaults(data?.settings as Stored | undefined)
  }
  publish()
  return current
}

export async function saveFamilySettings(next: FamilySettings) {
  if (!DEMO_MODE) {
    if (!familyId) throw new Error("Family settings aren't set up on the database yet.")
    const { error } = await supabase.from("families").update({ settings: next }).eq("id", familyId)
    if (error) throw error
  }
  current = next
  publish()
}

export function useFamilySettings(): FamilySettings {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return current
}

/** A kid's age this year from their birth year, or null when it isn't set. */
export function ageFromBirthYear(birthYear?: number | null, today = new Date()): number | null {
  return birthYear ? Math.max(0, today.getFullYear() - birthYear) : null
}
