import type { CSSProperties } from "react"

export interface RewardThemeColors {
  bg: string
  pattern: string
  surface: string
  ink: string
  inkSoft: string
  primary: string
  secondary: string
  accent: string
  success: string
  reward: string
  rewardStroke: string
  onPrimary: string
  onSecondary: string
  onAccent: string
  onSuccess: string
}

export interface RewardTheme {
  id: string
  name: string
  mode: "light" | "dark"
  fonts: { display: string; body: string }
  colors: RewardThemeColors
  confetti: string[]
  pattern: string
  reward: { token: string; tokenName: string; cheer: string; particles: string; count: number; rise: boolean }
}

export const REWARD_IDS = [
  "check-pop", "star-shower", "balloons", "mascot-dance", "coin-jar", "treasure-chest",
  "confetti-cannon", "streak-flame", "badge-unlock", "trophy", "rocket-level-up", "fireworks",
] as const

const makeTheme = (
  id: string, name: string, mode: RewardTheme["mode"], display: string,
  colors: RewardThemeColors, confetti: string[], pattern: string,
  token: string, tokenName: string, cheer: string, particles: string, count: number, rise = false,
): RewardTheme => ({
  id, name, mode, fonts: { display, body: "Nunito" }, colors, confetti, pattern,
  reward: { token, tokenName, cheer, particles, count, rise },
})

export const REWARD_THEMES: Record<string, RewardTheme> = {
  "sunny-room": makeTheme("sunny-room", "Sunny Room", "light", "Fredoka", {
    bg: "#FFF4E0", pattern: "#FFE6BF", surface: "#FFFFFF", ink: "#2D2A4A", inkSoft: "#6B6788", primary: "#4673D1", secondary: "#FF7AA2", accent: "#FFC93C", success: "#2FA877", reward: "#FFC93C", rewardStroke: "#E0A400", onPrimary: "#FFFFFF", onSecondary: "#2D2A4A", onAccent: "#2D2A4A", onSuccess: "#2D2A4A",
  }, ["#FF7AA2", "#FFC93C", "#3CC48B", "#5B8DEF", "#B28DFF"], "dots", "star", "stars", "Great job!", "confetti", 90),
  "ocean-explorer": makeTheme("ocean-explorer", "Ocean Explorer", "light", "Baloo 2", {
    bg: "#DFF4F7", pattern: "#BFE6EC", surface: "#FFFFFF", ink: "#0E3B4F", inkSoft: "#4C7385", primary: "#0B7A8A", secondary: "#FF7F6B", accent: "#FFD166", success: "#188457", reward: "#FFE3EC", rewardStroke: "#E88AA6", onPrimary: "#FFFFFF", onSecondary: "#0E3B4F", onAccent: "#0E3B4F", onSuccess: "#FFFFFF",
  }, ["#7FDBE6", "#FF7F6B", "#FFD166", "#FFFFFF", "#5BC0EB"], "bubbles", "shell", "shells", "Splash-tastic!", "bubbles", 45, true),
  "space-mission": makeTheme("space-mission", "Space Mission", "dark", "Righteous", {
    bg: "#14163A", pattern: "#2E3172", surface: "#232663", ink: "#F4F3FF", inkSoft: "#B4B3E3", primary: "#8B6CFF", secondary: "#39D5FF", accent: "#FF6FB5", success: "#3EE6A0", reward: "#FFB84D", rewardStroke: "#FF7A45", onPrimary: "#14163A", onSecondary: "#14163A", onAccent: "#14163A", onSuccess: "#14163A",
  }, ["#FFD84D", "#39D5FF", "#FF6FB5", "#8B6CFF", "#FFFFFF"], "stars", "planet", "planets", "Mission complete!", "starburst", 70),
  "dino-valley": makeTheme("dino-valley", "Dino Valley", "light", "Lilita One", {
    bg: "#EEF6DA", pattern: "#D8E9B2", surface: "#FFFFFF", ink: "#2F3B1E", inkSoft: "#66724F", primary: "#3F8526", secondary: "#F28C28", accent: "#F6C445", success: "#22814F", reward: "#FFF3D1", rewardStroke: "#8CC63F", onPrimary: "#FFFFFF", onSecondary: "#2F3B1E", onAccent: "#2F3B1E", onSuccess: "#FFFFFF",
  }, ["#8CC63F", "#F28C28", "#F6C445", "#4E9A2F", "#C0E57A"], "leaves", "egg", "dino eggs", "Roar-some!", "leaves", 50),
  "candy-shop": makeTheme("candy-shop", "Candy Shop", "light", "Chewy", {
    bg: "#FFF0F5", pattern: "#FFD1E0", surface: "#FFFFFF", ink: "#4A2340", inkSoft: "#8A5A7E", primary: "#C42F6C", secondary: "#3FC1A8", accent: "#FFC93C", success: "#167A56", reward: "#FF8FB8", rewardStroke: "#D63B79", onPrimary: "#FFFFFF", onSecondary: "#4A2340", onAccent: "#4A2340", onSuccess: "#FFFFFF",
  }, ["#FF8FB8", "#3FC1A8", "#FFC93C", "#9B7BFF", "#7FD6FF"], "sprinkles", "candy", "candies", "Sweet!", "sprinkles", 110),
  "fairy-garden": makeTheme("fairy-garden", "Fairy Garden", "light", "Sniglet", {
    bg: "#F4EEFF", pattern: "#E3D6FF", surface: "#FFFFFF", ink: "#3A2A5C", inkSoft: "#776A96", primary: "#7448E8", secondary: "#2FB28A", accent: "#FFB3D1", success: "#187A56", reward: "#FF9BCB", rewardStroke: "#D9579A", onPrimary: "#FFFFFF", onSecondary: "#3A2A5C", onAccent: "#3A2A5C", onSuccess: "#FFFFFF",
  }, ["#FFB3D1", "#C7A8FF", "#9BE8C8", "#FFE08A", "#FFFFFF"], "flowers", "flower", "flowers", "Magical!", "petals", 55, true),
  "pixel-arcade": makeTheme("pixel-arcade", "Pixel Arcade", "dark", "Silkscreen", {
    bg: "#101626", pattern: "#1E2842", surface: "#1A2238", ink: "#F2F5FF", inkSoft: "#9AA6C8", primary: "#36E27B", secondary: "#FF4D9D", accent: "#4DC3FF", success: "#36E27B", reward: "#FFD23F", rewardStroke: "#E09A00", onPrimary: "#101626", onSecondary: "#101626", onAccent: "#101626", onSuccess: "#101626",
  }, ["#36E27B", "#FF4D9D", "#FFD23F", "#4DC3FF", "#FFFFFF"], "pixels", "coin", "coins", "LEVEL UP!", "pixels", 80),
  "superhero-city": makeTheme("superhero-city", "Superhero City", "light", "Bangers", {
    bg: "#EAF2FF", pattern: "#D2E1FF", surface: "#FFFFFF", ink: "#1A1F3D", inkSoft: "#525A80", primary: "#D62839", secondary: "#1D4ED8", accent: "#FFD60A", success: "#1A7F45", reward: "#FFD60A", rewardStroke: "#1A1F3D", onPrimary: "#FFFFFF", onSecondary: "#FFFFFF", onAccent: "#1A1F3D", onSuccess: "#FFFFFF",
  }, ["#D62839", "#1D4ED8", "#FFD60A", "#FFFFFF", "#1A1F3D"], "halftone", "bolt", "power bolts", "POW! Chore defeated!", "bursts", 26),
  "rainbow-sky": makeTheme("rainbow-sky", "Rainbow Sky", "light", "Grandstander", {
    bg: "#EEF5FF", pattern: "#DCE9FF", surface: "#FFFFFF", ink: "#33305A", inkSoft: "#6E6B94", primary: "#CF2F58", secondary: "#4DA3FF", accent: "#FFC93C", success: "#187A56", reward: "#FF5E7E", rewardStroke: "#D63B5E", onPrimary: "#FFFFFF", onSecondary: "#33305A", onAccent: "#33305A", onSuccess: "#FFFFFF",
  }, ["#FF5E7E", "#FF9F43", "#FFD43B", "#4CD97B", "#4DA3FF", "#9B7BFF"], "clouds", "heart", "hearts", "You shine!", "hearts", 70),
  "construction-zone": makeTheme("construction-zone", "Construction Zone", "light", "Bowlby One", {
    bg: "#FFF8E1", pattern: "#FBEAB8", surface: "#FFFFFF", ink: "#26221A", inkSoft: "#6A6252", primary: "#F2A000", secondary: "#3F4A5A", accent: "#E8641A", success: "#22804A", reward: "#C9CED6", rewardStroke: "#5B6573", onPrimary: "#26221A", onSecondary: "#FFFFFF", onAccent: "#26221A", onSuccess: "#FFFFFF",
  }, ["#F2A000", "#E8641A", "#3F4A5A", "#C9CED6", "#FFD43B"], "hazard", "nut", "bolts", "Built it!", "nuts", 40),
  "arctic-friends": makeTheme("arctic-friends", "Arctic Friends", "light", "Quicksand", {
    bg: "#EAF5FF", pattern: "#CFE5F8", surface: "#FFFFFF", ink: "#12304A", inkSoft: "#4D6A82", primary: "#1F6FD1", secondary: "#2BB0D4", accent: "#FFA94D", success: "#1A8467", reward: "#BDE6FF", rewardStroke: "#1F6FD1", onPrimary: "#FFFFFF", onSecondary: "#12304A", onAccent: "#12304A", onSuccess: "#FFFFFF",
  }, ["#FFFFFF", "#BDE6FF", "#7CC4F5", "#FFA94D", "#1F6FD1"], "snow", "snowflake", "snowflakes", "Ice work!", "snowflakes", 55),
  "calm-night": makeTheme("calm-night", "Calm Night", "dark", "Nunito", {
    bg: "#1C2238", pattern: "#323B5E", surface: "#262E4A", ink: "#EDEAF6", inkSoft: "#A9AECB", primary: "#9DB4FF", secondary: "#C7B6FF", accent: "#FFE7A3", success: "#8FD6B4", reward: "#FFE7A3", rewardStroke: "#D9BE6E", onPrimary: "#1C2238", onSecondary: "#1C2238", onAccent: "#1C2238", onSuccess: "#1C2238",
  }, ["#FFE7A3", "#C7B6FF", "#9DB4FF"], "nightsky", "moon", "moons", "Nicely done.", "glow", 14, true),
}

const legacyThemeMap: Record<string, string> = {
  sunset: "sunny-room",
  garden: "fairy-garden",
  starlight: "space-mission",
  ocean: "ocean-explorer",
}

export function getRewardThemeId(themeKey: string): string {
  return legacyThemeMap[themeKey] ?? (REWARD_THEMES[themeKey] ? themeKey : "sunny-room")
}

export function getRewardTheme(themeKey: string): RewardTheme {
  return REWARD_THEMES[getRewardThemeId(themeKey)]
}

function toHsl(hex: string): string {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!match) return "0 0% 100%"
  let r = parseInt(match[1], 16) / 255
  let g = parseInt(match[2], 16) / 255
  let b = parseInt(match[3], 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const delta = max - min
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
    if (max === r) h = (g - b) / delta + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h /= 6
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`
}

export function getRewardThemeStyle(themeKey: string): CSSProperties {
  const { colors } = getRewardTheme(themeKey)
  return {
    "--background": toHsl(colors.bg),
    "--foreground": toHsl(colors.ink),
    "--card": toHsl(colors.surface),
    "--card-foreground": toHsl(colors.ink),
    "--popover": toHsl(colors.surface),
    "--popover-foreground": toHsl(colors.ink),
    "--primary": toHsl(colors.primary),
    "--primary-foreground": toHsl(colors.onPrimary),
    "--secondary": toHsl(colors.secondary),
    "--secondary-foreground": toHsl(colors.onSecondary),
    "--accent": toHsl(colors.accent),
    "--accent-foreground": toHsl(colors.onAccent),
    "--muted": toHsl(colors.pattern),
    "--muted-foreground": toHsl(colors.inkSoft),
    "--border": toHsl(colors.pattern),
    "--input": toHsl(colors.pattern),
    "--ring": toHsl(colors.primary),
  } as CSSProperties
}

export const REWARD_ASSET_BASE_URL = "https://cdn.jsdelivr.net/gh/tjleafty/Responsibilities-App@b7d80be98a8f2d327cc80a09e6459fa2701e39b6/chore-rewards"

export function getRewardSoundUrl(rewardId: string): string {
  return `${REWARD_ASSET_BASE_URL}/sounds/${encodeURIComponent(rewardId)}.wav`
}

export const REWARD_RUNTIME_URL = `${REWARD_ASSET_BASE_URL}/lib/rewards.js`
export const REWARD_SOUND_RUNTIME_URL = `${REWARD_ASSET_BASE_URL}/lib/sounds.js`

export function getRewardVideoUrl(rewardId: string): string {
  return `${REWARD_ASSET_BASE_URL}/videos/${encodeURIComponent(rewardId)}.mp4`
}

export default REWARD_THEMES
