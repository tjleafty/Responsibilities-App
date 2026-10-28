import { useEffect, useState } from "react"
import { db } from "@/lib/db"
import type { ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { chorePeriodKey } from "@/lib/choreUtils"

/*
 * Chore swaps and trades (chore_swaps, migration 20261029000000). A kid asks; a
 * grown-up approves. Once approved, the chore belongs to the other kid for that
 * one period, and any points change hands. Nothing changes while it's pending.
 *   swap:     my chore <-> a sibling's chore
 *   handoff:  a sibling does my chore, I pay them points
 *   takeover: I do a sibling's chore and ask for bonus points
 */

export type SwapKind = "swap" | "handoff" | "takeover"
export type SwapStatus = "pending" | "approved" | "rejected" | "canceled"

export interface ChoreSwap {
  id: string
  kind: SwapKind
  from_profile_id: string
  to_profile_id: string
  give_chore_id: string | null
  give_period_key: string | null
  take_chore_id: string | null
  take_period_key: string | null
  points: number
  message: string | null
  status: SwapStatus
  parent_note: string | null
  decided_at: string | null
  created_at: string
}

let swaps: ChoreSwap[] = []
let available = false
const listeners = new Set<() => void>()

export function setSwaps(rows: ChoreSwap[], tableExists: boolean) {
  swaps = rows
  available = tableExists
  listeners.forEach((listener) => listener())
}

/** False until the chore_swaps table is on the database. */
export const swapsAvailable = () => available

export function useSwaps(): ChoreSwap[] {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return swaps
}

export async function loadSwaps(): Promise<ChoreSwap[]> {
  try {
    const rows = (await db.chore_swap.list({ orderBy: "-created_at" })) as unknown as ChoreSwap[]
    setSwaps(rows, true)
  } catch (error) {
    const code = (error as { code?: string }).code ?? ""
    if (!["PGRST205", "42P01"].includes(code)) console.error("Loading chore swaps failed:", error)
    setSwaps([], false)
  }
  return swaps
}

const periodOf = (chore: ChoreRecord, profileId: string, date = new Date()) => chorePeriodKey(chore, profileId, date)

/** Who does a chore after approved swaps: the kid it moved to replaces the kid it moved from. */
export function applySwaps(chore: ChoreRecord, kidIds: string[], date = new Date()): string[] {
  const moves = swaps.filter((row) => row.status === "approved")
  if (moves.length === 0) return kidIds
  let result = [...kidIds]
  moves.forEach((row) => {
    // The asking kid's chore goes to the sibling (swap, handoff)...
    if (row.give_chore_id === chore.id && result.includes(row.from_profile_id) && row.give_period_key === periodOf(chore, row.from_profile_id, date)) {
      result = result.map((id) => (id === row.from_profile_id ? row.to_profile_id : id))
    }
    // ...and the sibling's chore comes to the asking kid (swap, takeover).
    if (row.take_chore_id === chore.id && result.includes(row.to_profile_id) && row.take_period_key === periodOf(chore, row.to_profile_id, date)) {
      result = result.map((id) => (id === row.to_profile_id ? row.from_profile_id : id))
    }
  })
  return [...new Set(result)]
}

/** Points a kid gained or paid through approved handoffs and takeover bonuses. */
export function swapPoints(profileId: string): number {
  return swaps.filter((row) => row.status === "approved").reduce((sum, row) => {
    if (row.kind === "handoff") return sum + (row.to_profile_id === profileId ? row.points : row.from_profile_id === profileId ? -row.points : 0)
    if (row.kind === "takeover" && row.from_profile_id === profileId) return sum + row.points
    return sum
  }, 0)
}

/** Points a kid has promised in handoffs still waiting for a grown-up. */
export function pointsOnHold(profileId: string): number {
  return swaps.filter((row) => row.status === "pending" && row.kind === "handoff" && row.from_profile_id === profileId).reduce((sum, row) => sum + row.points, 0)
}

export const pendingSwaps = (rows: ChoreSwap[] = swaps) => rows.filter((row) => row.status === "pending")

/** An open ask that involves this chore for this kid, so it isn't asked twice. */
export function openSwapFor(chore: ChoreRecord, profileId: string): ChoreSwap | null {
  return swaps.find((row) => row.status === "pending"
    && ((row.give_chore_id === chore.id && row.from_profile_id === profileId) || (row.take_chore_id === chore.id && row.to_profile_id === profileId))) ?? null
}

export async function askForSwap(request: { kind: SwapKind; from: FamilyProfile; to: FamilyProfile; give: ChoreRecord | null; take: ChoreRecord | null; points: number; message?: string }) {
  const row = await db.chore_swap.create({
    kind: request.kind,
    from_profile_id: request.from.id,
    to_profile_id: request.to.id,
    give_chore_id: request.give?.id ?? null,
    give_period_key: request.give ? periodOf(request.give, request.from.id) : null,
    take_chore_id: request.take?.id ?? null,
    take_period_key: request.take ? periodOf(request.take, request.to.id) : null,
    points: Math.max(0, Math.round(request.points)),
    message: request.message?.trim() || null,
    status: "pending",
  })
  setSwaps([row as unknown as ChoreSwap, ...swaps], true)
}

export async function answerSwap(swap: ChoreSwap, decision: "approved" | "rejected" | "canceled", extra: { points?: number; note?: string } = {}) {
  const row = await db.chore_swap.update(swap.id, {
    status: decision,
    decided_at: new Date().toISOString(),
    ...(extra.points !== undefined ? { points: Math.max(0, Math.round(extra.points)) } : {}),
    ...(extra.note !== undefined ? { parent_note: extra.note.trim() || null } : {}),
  })
  setSwaps(swaps.map((item) => (item.id === swap.id ? row as unknown as ChoreSwap : item)), true)
}
