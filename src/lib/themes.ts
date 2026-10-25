import type { CSSProperties } from "react"
import themesFile from "../../chore-rewards/themes/themes.json"
import { getRewardTheme, getRewardThemeId, getRewardThemeStyle } from "@/lib/rewardThemes"

interface ThemeFile {
  themes: Array<{
    id: string
    name: string
    vibe: string
    mode: "light" | "dark"
    fonts: { display: string; body: string; displayStack: string; bodyStack: string; googleFontsUrl: string }
    shape: { radius: number; border: number }
    pattern: { kind: string; svg: string }
    reward: { token: string; tokenName: string; cheer: string }
  }>
}

const THEMES = (themesFile as ThemeFile).themes

const TOKEN_EMOJI: Record<string, string> = {
  star: "⭐", shell: "🐚", planet: "🪐", egg: "🥚", candy: "🍬", flower: "🌸",
  coin: "🪙", bolt: "⚡", heart: "💖", nut: "🔩", snowflake: "❄️", moon: "🌙",
}

export interface KidTheme {
  id: string
  name: string
  vibe: string
  mode: "light" | "dark"
  token: string
  tokenName: string
  cheer: string
  displayStack: string
  bodyStack: string
  colors: ReturnType<typeof getRewardTheme>["colors"]
}

export function getKidTheme(themeKey: string): KidTheme {
  const id = getRewardThemeId(themeKey)
  const data = THEMES.find((theme) => theme.id === id) ?? THEMES[0]
  return {
    id: data.id,
    name: data.name,
    vibe: data.vibe,
    mode: data.mode,
    token: TOKEN_EMOJI[data.reward.token] ?? "⭐",
    tokenName: data.reward.tokenName,
    cheer: data.reward.cheer,
    displayStack: data.fonts.displayStack,
    bodyStack: data.fonts.bodyStack,
    colors: getRewardTheme(id).colors,
  }
}

export const KID_THEME_IDS = THEMES.map((theme) => theme.id)

const loadedFonts = new Set<string>()

/** Adds the theme's Google Fonts stylesheet once, so its display font is ready when the kid screen shows. */
export function ensureThemeFonts(themeKey: string) {
  if (typeof document === "undefined") return
  const id = getRewardThemeId(themeKey)
  const data = THEMES.find((theme) => theme.id === id)
  if (!data || loadedFonts.has(data.fonts.googleFontsUrl)) return
  loadedFonts.add(data.fonts.googleFontsUrl)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = data.fonts.googleFontsUrl
  document.head.appendChild(link)
}

/** CSS variables, fonts and the soft background pattern for a kid's theme. */
export function kidThemeStyle(themeKey: string, withPattern = true): CSSProperties {
  const id = getRewardThemeId(themeKey)
  const data = THEMES.find((theme) => theme.id === id) ?? THEMES[0]
  const pattern = `url("data:image/svg+xml,${encodeURIComponent(data.pattern.svg)}")`
  return {
    ...getRewardThemeStyle(id),
    "--font-display": data.fonts.displayStack,
    "--font-body": data.fonts.bodyStack,
    "--theme-radius": `${data.shape.radius}px`,
    fontFamily: data.fonts.bodyStack,
    colorScheme: data.mode,
    ...(withPattern ? { backgroundImage: pattern } : {}),
  } as CSSProperties
}
