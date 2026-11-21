import { useEffect, useState } from "react"
import { db } from "@/lib/db"
import type { FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { notifyGrownUps } from "@/lib/notify"
import { firstName } from "@/lib/family"
import { parseUTC } from "@/lib/utils"

/*
 * Team prizes (prize_pledges, migration 20261121000000). A grown-up marks a prize as shared
 * by some kids. Each of them can put points into the prize's jar, and take their own back out
 * until the jar is full. A full jar always waits for a grown-up, even with auto-grant on.
 *   held -> pending (jar full) -> granted (spent) or returned (points back)
 * A kid's held, pending and granted points all come out of their balance.
 */

export type PledgeStatus = "held" | "pending" | "granted" | "returned"

export interface PrizePledge {
  id: string
  reward_id: string
  profile_id: string
  points: number
  status: PledgeStatus
  parent_note: string | null
  decided_at: string | null
  created_at: string
}

let pledges: PrizePledge[] = []
let available = false
const listeners = new Set<() => void>()

export function setPledges(rows: PrizePledge[], tableExists: boolean) {
  pledges = rows
  available = tableExists
  listeners.forEach((listener) => listener())
}

/** False until the prize_pledges table is on the database, so team prizes stay hidden. */
export const teamPrizesAvailable = () => available

export function usePledges(): PrizePledge[] {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return pledges
}

export async function loadPledges(): Promise<PrizePledge[]> {
  try {
    const rows = (await db.prize_pledge.list({ orderBy: "-created_at" })) as unknown as PrizePledge[]
    setPledges(rows.map((row) => ({ ...row, points: Number(row.points) || 0 })), true)
  } catch (error) {
    const code = (error as { code?: string }).code ?? ""
    if (!["PGRST205", "42P01"].includes(code)) console.error("Loading prize jars failed:", error)
    setPledges([], false)
  }
  return pledges
}

/** The kids who share a team prize. Fewer than two means it's a regular prize. */
export function teamOf(reward: Pick<FamilyReward, "team_profile_ids"> | null | undefined): string[] {
  if (!reward?.team_profile_ids) return []
  try {
    const ids = JSON.parse(reward.team_profile_ids)
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

export const isTeamPrize = (reward: Pick<FamilyReward, "team_profile_ids"> | null | undefined) => teamOf(reward).length >= 2

const cost = (reward: FamilyReward) => Number(reward.points_required) || 0

/** Points a kid has put into jars that aren't back with them: in a jar, waiting, or spent. */
export function pledgedPoints(profileId: string, rows: PrizePledge[] = pledges): number {
  return rows.filter((row) => row.profile_id === profileId && row.status !== "returned").reduce((sum, row) => sum + row.points, 0)
}

export interface Jar {
  reward: FamilyReward
  /** The rows in the jar right now: held while filling, pending once it's full. */
  rows: PrizePledge[]
  total: number
  cost: number
  state: "filling" | "full"
  /** Each kid's share of what's in the jar, biggest first. */
  shares: Array<{ profileId: string; points: number }>
}

function sharesOf(rows: PrizePledge[]) {
  const byKid = new Map<string, number>()
  rows.forEach((row) => byKid.set(row.profile_id, (byKid.get(row.profile_id) ?? 0) + row.points))
  return [...byKid.entries()].map(([profileId, points]) => ({ profileId, points })).sort((a, b) => b.points - a.points)
}

export function jarFor(reward: FamilyReward, rows: PrizePledge[] = pledges): Jar {
  const mine = rows.filter((row) => row.reward_id === reward.id)
  const pending = mine.filter((row) => row.status === "pending")
  const inJar = pending.length > 0 ? pending : mine.filter((row) => row.status === "held")
  const total = inJar.reduce((sum, row) => sum + row.points, 0)
  return { reward, rows: inJar, total, cost: cost(reward), state: pending.length > 0 ? "full" : "filling", shares: sharesOf(inJar) }
}

/** Full jars waiting for a grown-up, oldest first. */
export function pendingJars(rewards: FamilyReward[], rows: PrizePledge[] = pledges): Jar[] {
  const ids = new Set(rows.filter((row) => row.status === "pending").map((row) => row.reward_id))
  return rewards.filter((reward) => ids.has(reward.id)).map((reward) => jarFor(reward, rows))
}

/** A jar a grown-up already answered: one entry per decision. */
export interface JarResult {
  key: string
  rewardId: string
  state: "granted" | "declined"
  decidedAt: string
  total: number
  note: string | null
  shares: Array<{ profileId: string; points: number }>
}

export function jarResults(rows: PrizePledge[] = pledges): JarResult[] {
  const groups = new Map<string, PrizePledge[]>()
  rows.filter((row) => (row.status === "granted" || row.status === "returned") && row.decided_at).forEach((row) => {
    const key = `${row.reward_id}|${row.status}|${row.decided_at}`
    groups.set(key, [...(groups.get(key) ?? []), row])
  })
  return [...groups.entries()].map(([key, group]) => ({
    key,
    rewardId: group[0].reward_id,
    state: group[0].status === "granted" ? "granted" as const : "declined" as const,
    decidedAt: group[0].decided_at ?? "",
    total: group.reduce((sum, row) => sum + row.points, 0),
    note: group.find((row) => row.parent_note)?.parent_note ?? null,
    shares: sharesOf(group),
  })).sort((a, b) => parseUTC(b.decidedAt).getTime() - parseUTC(a.decidedAt).getTime())
}

function replace(updated: PrizePledge[]) {
  const byId = new Map(updated.map((row) => [row.id, row]))
  setPledges(pledges.map((row) => byId.get(row.id) ?? row), true)
}

/**
 * A kid puts points into a team prize's jar. Never more than the jar still needs.
 * When this fills the jar, it goes to the grown-ups. Returns true when the jar is now full.
 */
export async function addToJar(reward: FamilyReward, kid: FamilyProfile, points: number, profiles: FamilyProfile[] = [kid]): Promise<boolean> {
  await loadPledges()
  const jar = jarFor(reward)
  if (jar.state === "full") throw new Error("This jar is already full.")
  const amount = Math.min(Math.round(points), jar.cost - jar.total)
  if (amount <= 0) throw new Error("Nothing to add.")
  const row = (await db.prize_pledge.create({ reward_id: reward.id, profile_id: kid.id, points: amount, status: "held" })) as unknown as PrizePledge
  setPledges([{ ...row, points: Number(row.points) || amount }, ...pledges], true)
  if (jar.total + amount < jar.cost) return false
  const held = pledges.filter((item) => item.reward_id === reward.id && item.status === "held")
  replace((await Promise.all(held.map((item) => db.prize_pledge.update(item.id, { status: "pending" })))) as unknown as PrizePledge[])
  const names = sharesOf(held).map((share) => firstName(profiles.find((profile) => profile.id === share.profileId))).filter(Boolean)
  notifyGrownUps({ event: "prize_request", kid: names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : firstName(kid), item: `${reward.title} (team prize)` })
  return true
}

/** A kid takes their own points back out of a jar that isn't full yet. */
export async function takeBackFromJar(reward: FamilyReward, kid: FamilyProfile) {
  const mine = pledges.filter((row) => row.reward_id === reward.id && row.profile_id === kid.id && row.status === "held")
  // No decided_at: only a grown-up's answer shows up as a result.
  replace((await Promise.all(mine.map((row) => db.prize_pledge.update(row.id, { status: "returned" })))) as unknown as PrizePledge[])
}

/** A grown-up answers a full jar. Not now gives every kid their share back. */
export async function answerJar(jar: Jar, decision: "approved" | "rejected", note = "") {
  const now = new Date().toISOString()
  const status: PledgeStatus = decision === "approved" ? "granted" : "returned"
  replace((await Promise.all(jar.rows.map((row) => db.prize_pledge.update(row.id, { status, decided_at: now, parent_note: note.trim() || null })))) as unknown as PrizePledge[])
}

/** Before a team prize is deleted or changed to a regular prize, every kid gets back what's in its jar. */
export async function emptyJar(reward: FamilyReward) {
  const open = pledges.filter((row) => row.reward_id === reward.id && (row.status === "held" || row.status === "pending"))
  replace((await Promise.all(open.map((row) => db.prize_pledge.update(row.id, { status: "returned" })))) as unknown as PrizePledge[])
}
