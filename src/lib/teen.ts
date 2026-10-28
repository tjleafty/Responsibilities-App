import type { RewardThemeColors } from "./rewardThemes.js"

/*
 * Teen mode (ages 12+): same chores, steps, approval and prizes as kid mode, with a clean
 * dark look, XP instead of stars and no mascot. Stored in family_profiles.theme_key as
 * "teen:<accent>:<appearance>", so it needs no database change.
 */

export const TEEN_ACCENTS = [
  // `light` is a deeper shade so text in the accent color stays readable on white.
  { id: "blue", name: "Electric blue", hex: "#5B8DEF", light: "#2F62CF" },
  { id: "violet", name: "Violet", hex: "#8B6CFF", light: "#6243E0" },
  { id: "mint", name: "Mint", hex: "#3EE6A0", light: "#0F855A" },
  { id: "coral", name: "Coral", hex: "#FF6B5B", light: "#CF3B2C" },
  { id: "amber", name: "Amber", hex: "#FFB020", light: "#A86A00" },
  { id: "pink", name: "Pink", hex: "#FF4D9D", light: "#C8246F" },
] as const

export type TeenAccent = (typeof TEEN_ACCENTS)[number]["id"]
export type TeenAppearance = "dark" | "light" | "auto"

export interface TeenPrefs {
  accent: TeenAccent
  appearance: TeenAppearance
}

export const TEEN_THEME_ID = "teen"
export const TEEN_FONTS_URL = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
export const TEEN_DISPLAY_STACK = "\"Space Grotesk\", Inter, system-ui, sans-serif"
export const TEEN_BODY_STACK = "Inter, system-ui, sans-serif"

export function isTeenKey(themeKey: string | null | undefined): boolean {
  return themeKey === TEEN_THEME_ID || Boolean(themeKey?.startsWith(`${TEEN_THEME_ID}:`))
}

export function teenPrefs(themeKey: string | null | undefined): TeenPrefs {
  const [, accent, appearance] = (themeKey ?? "").split(":")
  return {
    accent: TEEN_ACCENTS.some((item) => item.id === accent) ? accent as TeenAccent : "blue",
    appearance: appearance === "light" || appearance === "auto" ? appearance : "dark",
  }
}

export function teenKey(prefs: Partial<TeenPrefs> = {}): string {
  const { accent, appearance } = { ...teenPrefs(null), ...prefs }
  return `${TEEN_THEME_ID}:${accent}:${appearance}`
}

/** Whether the teen look is dark right now ("auto" follows the device). */
export function teenIsDark(themeKey: string | null | undefined): boolean {
  const { appearance } = teenPrefs(themeKey)
  if (appearance !== "auto") return appearance === "dark"
  return typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function teenColors(themeKey: string | null | undefined): RewardThemeColors {
  const swatch = TEEN_ACCENTS.find((item) => item.id === teenPrefs(themeKey).accent) ?? TEEN_ACCENTS[0]
  const dark = teenIsDark(themeKey)
  const accent = dark ? swatch.hex : swatch.light
  return dark
    ? {
      bg: "#121420", pattern: "#2A2E45", surface: "#1C1F30", ink: "#F2F3F8", inkSoft: "#A3A7BD",
      primary: accent, secondary: "#3EE6A0", accent: "#2A2E45", success: "#3EE6A0", reward: accent, rewardStroke: accent,
      onPrimary: "#0E1020", onSecondary: "#0E1020", onAccent: "#F2F3F8", onSuccess: "#0E1020",
    }
    : {
      bg: "#F6F7FB", pattern: "#E4E6EF", surface: "#FFFFFF", ink: "#1A1D2E", inkSoft: "#5D6178",
      primary: accent, secondary: "#14946A", accent: "#E4E6EF", success: "#14946A", reward: accent, rewardStroke: accent,
      onPrimary: "#FFFFFF", onSecondary: "#FFFFFF", onAccent: "#1A1D2E", onSuccess: "#FFFFFF",
    }
}
