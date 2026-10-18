import { getTheme } from "@/lib/familyTypes"
import { getRewardTheme } from "@/lib/rewardThemes"

interface ProfileThemeTileProps {
  themeKey: string
  selected?: boolean
  onSelect?: () => void
}

export function ProfileThemeTile({ themeKey, selected = false, onSelect }: ProfileThemeTileProps) {
  const theme = getTheme(themeKey)
  const uploaded = getRewardTheme(themeKey)
  const palette = {
    background: uploaded.colors.bg,
    pattern: uploaded.colors.pattern,
    surface: uploaded.colors.surface,
    ink: uploaded.colors.ink,
    inkSoft: uploaded.colors.inkSoft,
    primary: uploaded.colors.primary,
    primaryForeground: uploaded.colors.onPrimary,
    secondary: uploaded.colors.secondary,
    secondaryForeground: uploaded.colors.onSecondary,
    accent: uploaded.colors.accent,
    accentForeground: uploaded.colors.onAccent,
  }
  const content = (
    <>
      <div className="overflow-hidden rounded-xl">
        <div className="relative flex h-28 w-full items-center justify-between overflow-hidden border p-3" style={{ backgroundColor: palette.background, borderColor: palette.pattern }}>
          <div className="absolute -right-5 -top-7 h-24 w-24 rounded-full opacity-45" style={{ backgroundColor: palette.pattern }} />
          <div className="relative flex items-center gap-2" aria-hidden="true">
            <span className="h-8 w-8 rounded-full" style={{ backgroundColor: palette.primary }} />
            <span className="h-5 w-5 rounded-full" style={{ backgroundColor: palette.secondary }} />
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: palette.accent }} />
          </div>
          <span className="relative max-w-[55%] text-right font-display text-sm font-bold" style={{ color: palette.ink }}>{theme.label}</span>
        </div>
      </div>
      <div className="mt-3 text-left">
        <p className="font-display text-base font-bold text-card-foreground">{theme.label}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{theme.description}</p>
      </div>
    </>
  )

  const className = `group rounded-2xl border p-2 text-left transition-[border-color,box-shadow,transform] duration-200 ${
    selected ? "border-primary shadow-md ring-2 ring-primary/15" : "border-border hover:-translate-y-0.5 hover:border-primary/60"
  }`

  return onSelect ? (
    <button type="button" onClick={onSelect} className={`${className} w-full`}>
      {content}
    </button>
  ) : (
    <div className={className}>{content}</div>
  )
}
