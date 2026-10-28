import type { CSSProperties } from "react"
import themesFile from "../../chore-rewards/themes/themes.json"
import { getRewardTheme, getRewardThemeId, getRewardThemeStyle } from "@/lib/rewardThemes"
import { isTeenKey, teenIsDark, TEEN_BODY_STACK, TEEN_DISPLAY_STACK, TEEN_FONTS_URL, TEEN_THEME_ID } from "@/lib/teen"

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
  if (isTeenKey(themeKey)) {
    return {
      id: TEEN_THEME_ID, name: "Teen", vibe: "Clean and focused", mode: teenIsDark(themeKey) ? "dark" : "light",
      token: "⚡", tokenName: "XP", cheer: "Done.", displayStack: TEEN_DISPLAY_STACK, bodyStack: TEEN_BODY_STACK,
      colors: getRewardTheme(themeKey).colors,
    }
  }
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
  const url = isTeenKey(themeKey) ? TEEN_FONTS_URL : THEMES.find((theme) => theme.id === id)?.fonts.googleFontsUrl
  if (!url || loadedFonts.has(url)) return
  loadedFonts.add(url)
  const link = document.createElement("link")
  link.rel = "stylesheet"
  link.href = url
  document.head.appendChild(link)
}

/** CSS variables, fonts and the soft background pattern for a kid's theme. */
export function kidThemeStyle(themeKey: string, withPattern = true): CSSProperties {
  if (isTeenKey(themeKey)) {
    const dark = teenIsDark(themeKey)
    // No pattern or mascot shapes: flat surfaces, 16px corners, Space Grotesk headings.
    return {
      ...getRewardThemeStyle(themeKey),
      "--font-display": TEEN_DISPLAY_STACK,
      "--font-body": TEEN_BODY_STACK,
      "--theme-radius": "16px",
      "--success": dark ? "156 76% 57%" : "158 76% 33%",
      "--success-foreground": dark ? "232 39% 9%" : "0 0% 100%",
      "--coral": dark ? "6 100% 68%" : "5 65% 49%",
      "--shadow-soft": dark ? "0 1px 0 rgba(255, 255, 255, 0.04)" : "0 1px 3px rgba(26, 29, 46, 0.08)",
      fontFamily: TEEN_BODY_STACK,
      colorScheme: dark ? "dark" : "light",
    } as CSSProperties
  }
  const id = getRewardThemeId(themeKey)
  const data = THEMES.find((theme) => theme.id === id) ?? THEMES[0]
  const pattern = `url("data:image/svg+xml,${encodeURIComponent(data.pattern.svg)}")`
  return {
    ...getRewardThemeStyle(id),
    "--font-display": data.fonts.displayStack,
    "--font-body": data.fonts.bodyStack,
    "--theme-radius": `${data.shape.radius}px`,
    // Kid worlds keep their own look when a grown-up turns on dark mode.
    "--success": "156 56% 42%",
    "--success-foreground": "0 0% 100%",
    "--coral": "7 74% 60%",
    "--shadow-soft": "0 4px 16px rgba(45, 42, 74, 0.08)",
    fontFamily: data.fonts.bodyStack,
    colorScheme: data.mode,
    ...(withPattern ? { backgroundImage: pattern } : {}),
  } as CSSProperties
}
