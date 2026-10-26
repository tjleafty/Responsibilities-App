import { db } from "@/lib/db"
import { pointsEarned } from "@/lib/family"
import type { ChoreCompletionRecord, FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { parseUTC } from "@/lib/utils"

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
  return pointsEarned(profileId, completions) - held
}

export async function askForPrize(reward: FamilyReward, profile: FamilyProfile): Promise<PrizeRequest> {
  const now = new Date().toISOString()
  const created = await db.chore_completion.create({
    chore_id: `${PREFIX}${reward.id}`,
    profile_id: profile.id,
    period_key: now.slice(0, 10),
    completed_task_ids: JSON.stringify([]),
    status: "pending_verification",
    review_status: "unreviewed",
    started_at: now,
    completed_at: now,
    reward_points_snapshot: Number(reward.points_required) || 0,
  })
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
