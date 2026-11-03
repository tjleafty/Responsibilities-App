import type { ChoreRecord, Difficulty } from "@/lib/familyTypes"
import { familySettings, type FamilySettings } from "@/lib/familySettings"

/*
 * Chore difficulty (chores.difficulty, migration 20261029000000). A chore marked
 * easy, medium or hard earns the family's points for that level (1, 2 and 3 by
 * default). Chores without a difficulty earn their own custom points.
 */

export const DIFFICULTIES: Array<{ value: Difficulty; label: string; emoji: string }> = [
  { value: "easy", label: "Easy", emoji: "🌱" },
  { value: "medium", label: "Medium", emoji: "💪" },
  { value: "hard", label: "Hard", emoji: "🔥" },
]

export const difficultyOf = (chore: Pick<ChoreRecord, "difficulty">): Difficulty | null =>
  chore.difficulty === "easy" || chore.difficulty === "medium" || chore.difficulty === "hard" ? chore.difficulty : null

/** Points for a level of difficulty, from the family's settings. */
export const difficultyPoints = (difficulty: Difficulty, settings: FamilySettings = familySettings()): number =>
  Math.max(0, Math.round(Number(settings.points.difficultyPoints[difficulty]) || 0))

/** Points a chore earns: its difficulty's points when it has one, its custom points when it doesn't. */
export function pointsFor(custom: number, difficulty: Difficulty | null, settings: FamilySettings = familySettings()): number {
  return difficulty ? difficultyPoints(difficulty, settings) : Math.max(0, Math.round(Number(custom) || 0))
}

/** The points a kid earns for this chore right now. */
export const chorePoints = (chore: Pick<ChoreRecord, "reward_points" | "difficulty">, settings?: FamilySettings) =>
  pointsFor(Number(chore.reward_points) || 0, difficultyOf(chore), settings)

/** "1 point" / "3 points". */
export const pointsLabel = (points: number) => `${points} ${points === 1 ? "point" : "points"}`
