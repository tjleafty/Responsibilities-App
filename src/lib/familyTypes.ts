import { getRewardThemeId } from "@/lib/rewardThemes"

export type ProfileType = "parent" | "child"
export type GoalFrequency = "daily" | "weekly" | "monthly"
export type RandomMode = "chore" | "chore_and_subtasks" | "subtasks"

export interface FamilyProfile {
  id: string
  display_name: string
  profile_type: ProfileType
  theme_key: string
  pin_hash?: string | null
  is_active?: boolean
  created_at?: string
  /** The login that created this profile; a grown-up's own profile is the one they own. */
  owner_id?: string | null
  /** Kids only: for age-appropriate chore ideas. */
  birth_year?: number | null
}

export interface GoalRecord {
  id: string
  title: string
  description?: string | null
  frequency: GoalFrequency
  target_profile_id: string
  target_count: number
  progress: number
  is_active?: boolean
  prize?: string | null
  reward_id?: string | null
}

export interface ChoreRecord {
  id: string
  title: string
  frequency: GoalFrequency
  target_profile_id: string
  is_active?: boolean
  __client_key?: string
  assigned_profile_ids?: string | null
  subtasks?: string | null
  reward?: string | null
  reward_id?: string | null
  reward_points?: number
  time_limit_minutes?: number | null
  requires_verification?: boolean | number
  random_assignment_enabled?: boolean | number
  assignment_rotation_enabled?: boolean | number
  assignment_change_frequency?: GoalFrequency | null
  /** JSON: due day, every-other-week and per-kid schedules (see lib/choreSchedule). */
  schedule?: string | null
  /** With random assignment on: "chore" (one kid), "chore_and_subtasks" (a random group splits the steps) or "subtasks" (every kid, steps split). */
  random_mode?: RandomMode | null
  /** "chore_and_subtasks" only: how many kids are picked each time. */
  random_group_size?: number | null
  /** Easy, medium or hard: scales the points with the family's multipliers (lib/difficulty). */
  difficulty?: Difficulty | null
}

export type Difficulty = "easy" | "medium" | "hard"

export type ChoreSubtask = {
  id: string
  title: string
}

export interface ChoreCompletionRecord {
  id: string
  chore_id: string
  profile_id: string
  period_key: string
  completed_task_ids?: string | null
  status: "in_progress" | "pending_verification" | "approved" | "rejected"
  started_at?: string
  deadline_at?: string
  completed_at?: string
  verified_at?: string
  reward_points_snapshot?: number
  __client_key?: string
  review_status?: "unreviewed" | "approved" | "rejected"
  rejection_reason?: string | null
  parent_feedback?: string | null
}

export interface FamilyThemeOption {
  key: string
  label: string
  description?: string
}

export const THEME_OPTIONS: FamilyThemeOption[] = [
  {
    key: "sunny-room",
    label: "Sunny Room",
    description: "Bright and cheerful.",
  },
  {
    key: "ocean-explorer",
    label: "Ocean Explorer",
    description: "Deep and adventurous.",
  },
  {
    key: "space-mission",
    label: "Space Mission",
    description: "Cosmic and mysterious.",
  },
  {
    key: "dino-valley",
    label: "Dino Valley",
    description: "Prehistoric and playful.",
  },
  {
    key: "candy-shop",
    label: "Candy Shop",
    description: "Sweet and colorful.",
  },
  {
    key: "fairy-garden",
    label: "Fairy Garden",
    description: "Magical and whimsical.",
  },
  {
    key: "pixel-arcade",
    label: "Pixel Arcade",
    description: "Retro and fun.",
  },
  {
    key: "superhero-city",
    label: "Superhero City",
    description: "Bold and heroic.",
  },
  {
    key: "rainbow-sky",
    label: "Rainbow Sky",
    description: "Vibrant and uplifting.",
  },
  {
    key: "construction-zone",
    label: "Construction Zone",
    description: "Busy and creative.",
  },
  {
    key: "arctic-friends",
    label: "Arctic Friends",
    description: "Cool and cozy.",
  },
  {
    key: "calm-night",
    label: "Calm Night",
    description: "Peaceful and serene.",
  },
]

export function getTheme(themeKey: string) {
  const key = getRewardThemeId(themeKey)
  return THEME_OPTIONS.find((theme) => theme.key === key) ?? THEME_OPTIONS[0]
}

export async function hashPin(pin: string) {
  const bytes = new TextEncoder().encode(pin)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin)
}

export const GOAL_FREQUENCIES: Array<{ value: GoalFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

export interface FamilyReward {
  id: string
  title: string
  description?: string | null
  reward_type: "participation" | "goal" | "chore"
  target_profile_id?: string | null
  points_required?: number
  is_active?: boolean
}
