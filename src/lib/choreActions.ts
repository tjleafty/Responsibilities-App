import { db } from "@/lib/db"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { areDailyChoresApproved, getPeriodKey, subtasksFor } from "@/lib/choreUtils"
import { prepareCelebration } from "@/lib/celebration"
import { firstName, requiresApproval } from "@/lib/family"
import { frequencyFor } from "@/lib/choreSchedule"
import { familySettings } from "@/lib/familySettings"
import { notifyGrownUps } from "@/lib/notify"

export const SEND_BACK_REASONS = [
  "Not fully completed",
  "Some steps were skipped",
  "Needs more attention",
  "Please redo this chore",
  "Please check with me",
]

async function startChore(chore: ChoreRecord, profile: FamilyProfile, existing: ChoreCompletionRecord | null): Promise<ChoreCompletionRecord> {
  if (existing) return existing
  const now = new Date()
  const periodKey = getPeriodKey(frequencyFor(chore, profile.id))
  const deadline = chore.time_limit_minutes ? new Date(now.getTime() + Number(chore.time_limit_minutes) * 60_000) : null
  const created = await db.chore_completion.create({
    chore_id: chore.id,
    profile_id: profile.id,
    period_key: periodKey,
    completed_task_ids: JSON.stringify([]),
    status: "in_progress",
    started_at: now.toISOString(),
    deadline_at: deadline?.toISOString() ?? null,
    reward_points_snapshot: Number(chore.reward_points) || 0,
  })
  return created as unknown as ChoreCompletionRecord
}

/** Saves checked steps. A chore that was sent back goes back to "in progress". */
export async function saveChoreProgress(chore: ChoreRecord, profile: FamilyProfile, existing: ChoreCompletionRecord | null, completedIds: string[]) {
  const completion = await startChore(chore, profile, existing)
  const wasSentBack = completion.status === "rejected"
  const saved = await db.chore_completion.update(completion.id, {
    completed_task_ids: JSON.stringify(completedIds),
    ...(wasSentBack ? { status: "in_progress", completed_at: null, verified_at: null, review_status: "unreviewed", rejection_reason: "" } : {}),
  })
  return saved as unknown as ChoreCompletionRecord
}

/** Marks a chore finished: approved right away, or waiting for a grown-up. Plays the theme's celebration. */
export async function completeChore(
  chore: ChoreRecord,
  profile: FamilyProfile,
  existing: ChoreCompletionRecord | null,
  completedIds: string[],
  context: { chores: ChoreRecord[]; completions: ChoreCompletionRecord[]; profiles: FamilyProfile[] },
) {
  const subtasks = subtasksFor(chore, profile.id, context.profiles)
  if (!subtasks.every((task) => completedIds.includes(task.id))) throw new Error("Check every step first.")
  const needsApproval = requiresApproval(chore)
  // Must run inside the tap so the browser lets the sound play.
  const celebrate = needsApproval ? null : prepareCelebration({ themeKey: profile.theme_key, reward: "star-shower" })
  const completion = await startChore(chore, profile, existing)
  const completedAt = new Date().toISOString()
  const updated = await db.chore_completion.update(completion.id, {
    completed_task_ids: JSON.stringify(completedIds),
    status: needsApproval ? "pending_verification" : "approved",
    completed_at: completedAt,
    review_status: needsApproval ? "unreviewed" : "approved",
    verified_at: needsApproval ? null : completedAt,
    rejection_reason: "",
  }) as unknown as ChoreCompletionRecord

  if (celebrate) {
    const points = Number(updated.reward_points_snapshot ?? chore.reward_points) || 0
    const allDone = familySettings().celebrations.allDoneTrophy && areDailyChoresApproved(context.chores, context.completions, context.profiles, profile.id, new Date(), updated)
    const reward = allDone ? "trophy" : points > 0 ? "coin-jar" : "star-shower"
    const text: Record<string, string | number> = allDone
      ? { title: "All done today!", subtitle: points > 0 ? `+${points} · Champion!` : "Champion!" }
      : reward === "coin-jar"
        ? { title: "Great job!", points, coins: Math.min(20, Math.max(1, Math.round(points))) }
        : { title: "Great job!", subtitle: chore.title, stars: 1 }
    celebrate(allDone ? `All of today's chores are done, ${firstName(profile)}!` : `Great job, ${firstName(profile)}! ${chore.title} is done.`, { reward, text })
  }
  if (needsApproval) notifyGrownUps({ event: "approval_needed", kid: profile.display_name, item: chore.title })
  return updated
}

/** A grown-up approves a chore or sends it back with a reason and an optional note. */
export async function reviewCompletion(
  completion: ChoreCompletionRecord,
  decision: "approved" | "rejected",
  context: { chores: ChoreRecord[]; completions: ChoreCompletionRecord[]; profiles: FamilyProfile[] },
  options: { reason?: string; note?: string; celebrate?: boolean } = {},
) {
  const child = context.profiles.find((profile) => profile.id === completion.profile_id)
  const celebrate = decision === "approved" && options.celebrate !== false ? prepareCelebration({ themeKey: child?.theme_key, reward: "star-shower" }) : null
  const updated = await db.chore_completion.update(completion.id, {
    status: decision,
    review_status: decision,
    rejection_reason: decision === "rejected" ? options.reason ?? SEND_BACK_REASONS[0] : "",
    parent_feedback: options.note?.trim() ?? "",
    verified_at: new Date().toISOString(),
  }) as unknown as ChoreCompletionRecord
  if (celebrate) {
    const allDone = familySettings().celebrations.allDoneTrophy && areDailyChoresApproved(context.chores, context.completions, context.profiles, completion.profile_id, new Date(), updated)
    const points = Number(updated.reward_points_snapshot) || 0
    const name = firstName(child) || "Your child"
    const reward = allDone ? "trophy" : points > 0 ? "coin-jar" : "star-shower"
    const text: Record<string, string | number> = allDone
      ? { title: "All done today!", subtitle: `${name} finished everything` }
      : reward === "coin-jar"
        ? { title: "Approved!", points, coins: Math.min(20, Math.max(1, Math.round(points))) }
        : { title: "Approved!", subtitle: name, stars: 1 }
    celebrate(allDone ? `${name} finished today's chores!` : `${name}'s chore is approved.`, { themeKey: child?.theme_key, reward, text })
  }
  return updated
}
