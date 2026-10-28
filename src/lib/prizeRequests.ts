import { pointsOnHold, swapPoints } from "@/lib/swaps"
import { db } from "@/lib/db"
import { pointsEarned } from "@/lib/family"
import type { ChoreCompletionRecord, FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { parseUTC } from "@/lib/utils"
import { familySettings } from "@/lib/familySettings"
import { notifyGrownUps } from "@/lib/notify"

/*
 * A kid asking for a prize is stored as a chore_completions row whose chore_id is
 * "prize:<reward id>", so the feature needs no new table. reward_points_snapshot holds
 * the prize's cost. Pending and granted requests both count against the kid's balance;
 * a declined request gives the points back.
 */
const PREFIX = "prize:"

export type PrizeRequest = ChoreCompletionRecord
export type RequestState = "pending" | "granted" | "declined"

export const isPrizeRequest = (row: ChoreCompletionRecord) => row.chore_id.startsWith(PREFIX)

/** Chore rows and prize request rows, kept apart so chore screens never see prizes. */
export function splitCompletions(rows: ChoreCompletionRecord[]) {
  return { completions: rows.filter((row) => !isPrizeRequest(row)), prizeRequests: rows.filter(isPrizeRequest) }
}

export const requestedRewardId = (row: PrizeRequest) => row.chore_id.slice(PREFIX.length)

export function requestState(row: PrizeRequest): RequestState {
  if (row.status === "approved") return "granted"
  if (row.status === "rejected") return "declined"
  return "pending"
}

export const requestCost = (row: PrizeRequest) => Number(row.reward_points_snapshot) || 0

export function pendingRequests(requests: PrizeRequest[]) {
  return requests.filter((row) => requestState(row) === "pending")
    .sort((a, b) => parseUTC(b.completed_at ?? "").getTime() - parseUTC(a.completed_at ?? "").getTime())
}

/** What a kid can still spend: earned points minus prizes granted or waiting for an answer. */
export function pointsBalance(profileId: string, completions: ChoreCompletionRecord[], requests: PrizeRequest[]) {
  const held = requests
    .filter((row) => row.profile_id === profileId && requestState(row) !== "declined")
    .reduce((sum, row) => sum + requestCost(row), 0)
  return pointsEarned(profileId, completions) + swapPoints(profileId) - held - pointsOnHold(profileId)
}

/** Prize asks a kid made in the last 7 days, for the family's weekly limit. */
export function asksThisWeek(profileId: string, requests: PrizeRequest[], now = Date.now()) {
  const weekAgo = now - 7 * 86_400_000
  return requests.filter((row) => row.profile_id === profileId && parseUTC(row.completed_at ?? "").getTime() >= weekAgo).length
}

/** Records a prize ask. Cheap prizes under the family's auto-grant limit are granted right away. */
export async function askForPrize(reward: FamilyReward, profile: FamilyProfile): Promise<PrizeRequest> {
  const now = new Date().toISOString()
  const cost = Number(reward.points_required) || 0
  const { autoGrantUpTo } = familySettings().prizes
  const granted = autoGrantUpTo !== null && cost <= autoGrantUpTo
  const created = await db.chore_completion.create({
    chore_id: `${PREFIX}${reward.id}`,
    profile_id: profile.id,
    period_key: now.slice(0, 10),
    completed_task_ids: JSON.stringify([]),
    status: granted ? "approved" : "pending_verification",
    review_status: granted ? "approved" : "unreviewed",
    started_at: now,
    completed_at: now,
    verified_at: granted ? now : null,
    reward_points_snapshot: cost,
  })
  if (!granted) notifyGrownUps({ event: "prize_request", kid: profile.display_name, item: reward.title })
  return created as unknown as PrizeRequest
}

export async function answerPrizeRequest(request: PrizeRequest, decision: "approved" | "rejected", note = ""): Promise<PrizeRequest> {
  const updated = await db.chore_completion.update(request.id, {
    status: decision,
    review_status: decision,
    parent_feedback: note.trim(),
    verified_at: new Date().toISOString(),
  })
  return updated as unknown as PrizeRequest
}
