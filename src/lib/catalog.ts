import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"
import { CHORE_PRESETS } from "@/lib/chorePresets"
import { makeTaskId, parseChoreSubtasks } from "@/lib/choreUtils"
import type { ChoreSubtask, GoalFrequency } from "@/lib/familyTypes"

/*
 * The starter chore list (chore_catalog) and parents' suggestions for it
 * (migration 20261028000100). Until that migration is on the database the app
 * falls back to the built-in CHORE_PRESETS and suggestions are skipped.
 */

export interface CatalogChore {
  id: string
  title: string
  frequency: GoalFrequency
  subtasks: ChoreSubtask[]
  min_age: number | null
  max_age: number | null
  is_active: boolean
}

export type SuggestionKind = "chore" | "steps"
export type SuggestionStatus = "pending" | "approved" | "rejected"

export interface ChoreSuggestion {
  id: string
  family_id: string | null
  kind: SuggestionKind
  title: string
  frequency: GoalFrequency
  subtasks: ChoreSubtask[]
  catalog_id: string | null
  status: SuggestionStatus
  admin_note: string | null
  created_at: string
}

interface CatalogRow extends Omit<CatalogChore, "subtasks"> { subtasks: string | null }
interface SuggestionRow extends Omit<ChoreSuggestion, "subtasks"> { subtasks: string | null }

// PostgREST answers PGRST205 (or Postgres 42P01) for a table that isn't there, PGRST202 for a missing function.
const missing = (error: { code?: string } | null) => !!error && ["PGRST205", "PGRST202", "42P01"].includes(error.code ?? "")

const builtIn = (): CatalogChore[] => CHORE_PRESETS.map((preset) => ({
  id: `preset:${preset.title}`, title: preset.title, frequency: preset.frequency, subtasks: [], min_age: null, max_age: null, is_active: true,
}))

const demo = {
  catalog: (DEMO_MODE ? builtIn().map((item, index) => ({ ...item, min_age: index % 3 === 0 ? 4 : 7, max_age: 17 })) : []) as CatalogChore[],
  suggestions: (DEMO_MODE ? [
    { id: "s1", family_id: "f1", kind: "chore", title: "Feed the dog", frequency: "daily", subtasks: [{ id: "a", title: "Scoop one cup of food" }, { id: "b", title: "Fresh water" }], catalog_id: null, status: "pending", admin_note: null, created_at: new Date().toISOString() },
    { id: "s2", family_id: "f2", kind: "chore", title: "feed the dog", frequency: "daily", subtasks: [], catalog_id: null, status: "pending", admin_note: null, created_at: new Date().toISOString() },
    { id: "s3", family_id: "f1", kind: "steps", title: "Make your bed", frequency: "daily", subtasks: [{ id: "c", title: "Stuffed animals on top" }], catalog_id: "preset:Make your bed", status: "pending", admin_note: null, created_at: new Date().toISOString() },
  ] : []) as ChoreSuggestion[],
}

const fromCatalogRow = (row: CatalogRow): CatalogChore => ({ ...row, subtasks: parseChoreSubtasks(row.subtasks) })
const fromSuggestionRow = (row: SuggestionRow): ChoreSuggestion => ({ ...row, subtasks: parseChoreSubtasks(row.subtasks) })

let cached: Promise<CatalogChore[]> | null = null

/** Active starter chores, from the database when it has them. */
export function loadCatalog(force = false): Promise<CatalogChore[]> {
  if (force || !cached) {
    cached = (async () => {
      if (DEMO_MODE) return demo.catalog.filter((item) => item.is_active)
      const { data, error } = await supabase.from("chore_catalog").select("*").eq("is_active", true).order("title")
      if (error) {
        if (!missing(error)) console.error("Loading the chore list failed:", error)
        return builtIn()
      }
      return data.length > 0 ? (data as CatalogRow[]).map(fromCatalogRow) : builtIn()
    })()
  }
  return cached
}

export async function isAppAdmin(): Promise<boolean> {
  if (DEMO_MODE) return true
  const { data, error } = await supabase.rpc("is_app_admin")
  return !error && data === true
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

/**
 * After a parent saves a chore: sends the chore (or just its new steps) to the
 * super admins when it isn't on the starter list. Never throws; it's best effort.
 */
export async function suggestFromChore(chore: { title: string; frequency: GoalFrequency; steps: ChoreSubtask[] }) {
  try {
    const title = chore.title.trim()
    const steps = chore.steps.map((step) => ({ ...step, title: step.title.trim() })).filter((step) => step.title)
    if (!title) return
    const catalog = await loadCatalog()
    const match = catalog.find((item) => norm(item.title) === norm(title))
    let row: Omit<SuggestionRow, "id" | "family_id" | "status" | "admin_note" | "created_at">
    if (!match) {
      row = { kind: "chore", title, frequency: chore.frequency, subtasks: JSON.stringify(steps), catalog_id: null }
    } else {
      const known = new Set(match.subtasks.map((step) => norm(step.title)))
      const fresh = steps.filter((step) => !known.has(norm(step.title)))
      if (fresh.length === 0) return
      row = { kind: "steps", title: match.title, frequency: match.frequency, subtasks: JSON.stringify(fresh), catalog_id: match.id.startsWith("preset:") ? null : match.id }
    }
    if (DEMO_MODE) {
      demo.suggestions.push({ ...row, id: makeTaskId(), family_id: "demo", status: "pending", admin_note: null, created_at: new Date().toISOString(), subtasks: parseChoreSubtasks(row.subtasks) })
      return
    }
    const { error } = await supabase.from("chore_suggestions").insert(row)
    // 23505: this family already has an open suggestion for the same chore.
    if (error && error.code !== "23505" && !missing(error)) console.error("Sending a chore suggestion failed:", error)
  } catch (caught) {
    console.error("Sending a chore suggestion failed:", caught)
  }
}

// ---- Super admin ----

export async function listSuggestions(status: SuggestionStatus = "pending"): Promise<ChoreSuggestion[]> {
  if (DEMO_MODE) return demo.suggestions.filter((item) => item.status === status)
  const { data, error } = await supabase.from("chore_suggestions").select("*").eq("status", status).order("created_at", { ascending: false })
  if (error) throw error
  return (data as SuggestionRow[]).map(fromSuggestionRow)
}

export async function listAllCatalog(): Promise<CatalogChore[]> {
  if (DEMO_MODE) return [...demo.catalog]
  const { data, error } = await supabase.from("chore_catalog").select("*").order("title")
  if (error) throw error
  return (data as CatalogRow[]).map(fromCatalogRow)
}

async function markSuggestions(ids: string[], status: SuggestionStatus, note?: string) {
  if (DEMO_MODE) {
    demo.suggestions.forEach((item) => { if (ids.includes(item.id)) Object.assign(item, { status, admin_note: note ?? null }) })
    return
  }
  const { data: me } = await supabase.auth.getUser()
  const { error } = await supabase.from("chore_suggestions")
    .update({ status, admin_note: note?.trim() || null, reviewed_by: me.user?.id ?? null, reviewed_at: new Date().toISOString() })
    .in("id", ids)
  if (error) throw error
}

export interface CatalogDraft {
  title: string
  frequency: GoalFrequency
  subtasks: ChoreSubtask[]
  min_age: number | null
  max_age: number | null
}

/** Adds (or merges into) a starter chore and closes the suggestions it came from. */
export async function approveSuggestions(ids: string[], draft: CatalogDraft) {
  const steps = draft.subtasks.map((step) => ({ id: step.id || makeTaskId(), title: step.title.trim() })).filter((step) => step.title)
  const existing = (await listAllCatalog()).find((item) => norm(item.title) === norm(draft.title))
  const mergedSteps = existing
    ? [...existing.subtasks, ...steps.filter((step) => !existing.subtasks.some((known) => norm(known.title) === norm(step.title)))]
    : steps
  const data = { title: draft.title.trim(), frequency: draft.frequency, subtasks: JSON.stringify(mergedSteps), min_age: draft.min_age, max_age: draft.max_age, is_active: true }
  if (DEMO_MODE) {
    if (existing) Object.assign(existing, { ...data, subtasks: mergedSteps })
    else demo.catalog.push({ ...data, id: makeTaskId(), subtasks: mergedSteps })
  } else {
    const { error } = existing
      ? await supabase.from("chore_catalog").update(data).eq("id", existing.id)
      : await supabase.from("chore_catalog").insert(data)
    if (error) throw error
  }
  await markSuggestions(ids, "approved")
  cached = null
}

export async function rejectSuggestions(ids: string[], note?: string) {
  await markSuggestions(ids, "rejected", note)
}

export async function setCatalogActive(id: string, active: boolean) {
  if (DEMO_MODE) {
    const item = demo.catalog.find((row) => row.id === id)
    if (item) item.is_active = active
  } else {
    const { error } = await supabase.from("chore_catalog").update({ is_active: active }).eq("id", id)
    if (error) throw error
  }
  cached = null
}

/** Whether a kid of `age` fits a starter chore's age range (no range = fits everyone). */
export function fitsAge(item: Pick<CatalogChore, "min_age" | "max_age">, age: number | null): boolean {
  if (age === null) return true
  return (item.min_age === null || age >= item.min_age) && (item.max_age === null || age <= item.max_age)
}
