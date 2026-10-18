export type ProfileType = "parent" | "child"
export type GoalFrequency = "daily" | "weekly" | "monthly"

export interface FamilyProfile {
  id: string
  display_name: string
  profile_type: ProfileType
  theme_key: string
  pin_hash?: string | null
  is_active?: boolean
  created_at?: string
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
}

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

export interface FamilyThemePalette {
  background: string
  pattern: string
  surface: string
  ink: string
  inkSoft: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  accent: string
  accentForeground: string
}

export interface FamilyThemeOption {
  key: string
  label: string
  description?: string
  image?: string
  palette?: FamilyThemePalette
}

export const THEME_OPTIONS: FamilyThemeOption[] = [
  {
    key: "sunset",
    label: "Sunset Sprint",
    description: "Warm skies for big wins.",
    image: "/assets/images/theme-sunset.png",
    palette: {
      background: "#FBF0DF",
      pattern: "#F1DDBF",
      surface: "#FFFAF2",
      ink: "#283044",
      inkSoft: "#646D7E",
      primary: "#D86F52",
      primaryForeground: "#FFFFFF",
      secondary: "#F6C95B",
      secondaryForeground: "#283044",
      accent: "#5E987A",
      accentForeground: "#FFFFFF",
    },
  },
  {
    key: "garden",
    label: "Garden Glow",
    description: "A leafy little adventure.",
    image: "/assets/images/theme-garden.png",
    palette: {
      background: "#EEF5E9",
      pattern: "#DCEAD4",
      surface: "#FFFFFF",
      ink: "#26372A",
      inkSoft: "#5E7062",
      primary: "#3F8526",
      primaryForeground: "#FFFFFF",
      secondary: "#F6C445",
      secondaryForeground: "#26372A",
      accent: "#F28C28",
      accentForeground: "#26372A",
    },
  },
  {
    key: "starlight",
    label: "Starlight Crew",
    description: "Night missions and bright ideas.",
    image: "/assets/images/theme-starlight.png",
    palette: {
      background: "#14163A",
      pattern: "#2E3172",
      surface: "#232663",
      ink: "#F4F3FF",
      inkSoft: "#B4B3E3",
      primary: "#8B6CFF",
      primaryForeground: "#14163A",
      secondary: "#39D5FF",
      secondaryForeground: "#14163A",
      accent: "#FF6FB5",
      accentForeground: "#14163A",
    },
  },
  {
    key: "ocean",
    label: "Ocean Quest",
    description: "Ride the wave of progress.",
    image: "/assets/images/theme-ocean.png",
    palette: {
      background: "#DFF4F7",
      pattern: "#BFE6EC",
      surface: "#FFFFFF",
      ink: "#0E3B4F",
      inkSoft: "#4C7385",
      primary: "#0B7A8A",
      primaryForeground: "#FFFFFF",
      secondary: "#FF7F6B",
      secondaryForeground: "#0E3B4F",
      accent: "#FFD166",
      accentForeground: "#0E3B4F",
    },
  },
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
  return THEME_OPTIONS.find((theme) => theme.key === themeKey) ?? THEME_OPTIONS[0]
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
