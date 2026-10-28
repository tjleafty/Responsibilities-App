import type { ChoreRecord, Difficulty } from "@/lib/familyTypes"
import { familySettings, type FamilySettings } from "@/lib/familySettings"

/*
 * Chore difficulty (chores.difficulty, migration 20261029000000). A chore's
 * points are its base points times the family's multiplier for its difficulty.
 * Chores without a difficulty keep their base points.
 */

export const DIFFICULTIES: Array<{ value: Difficulty; label: string; emoji: string }> = [
  { value: "easy", label: "Easy", emoji: "🌱" },
  { value: "medium", label: "Medium", emoji: "💪" },
  { value: "hard", label: "Hard", emoji: "🔥" },
]

export const difficultyOf = (chore: Pick<ChoreRecord, "difficulty">): Difficulty | null =>
  chore.difficulty === "easy" || chore.difficulty === "medium" || chore.difficulty === "hard" ? chore.difficulty : null

export function pointsFor(base: number, difficulty: Difficulty | null, settings: FamilySettings = familySettings()): number {
  const multiplier = difficulty ? settings.points.multipliers[difficulty] ?? 1 : 1
  return Math.max(0, Math.round((Number(base) || 0) * multiplier))
}

/** The points a kid earns for this chore right now. */
export const chorePoints = (chore: Pick<ChoreRecord, "reward_points" | "difficulty">, settings?: FamilySettings) =>
  pointsFor(Number(chore.reward_points) || 0, difficultyOf(chore), settings)

export const formatMultiplier = (value: number) => `×${Number.isInteger(value) ? value : value.toFixed(1).replace(/\.0$/, "")}`
