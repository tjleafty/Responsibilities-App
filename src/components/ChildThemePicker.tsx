import { ProfileThemeTile } from "@/components/ProfileThemeTile"
import { THEME_OPTIONS } from "@/lib/familyTypes"
import { getRewardThemeId } from "@/lib/rewardThemes"

interface ChildThemePickerProps {
  themeKey: string
  saving?: boolean
  error?: string | null
  onThemeChange: (themeKey: string) => void | Promise<void>
}

export function ChildThemePicker({ themeKey, saving = false, error, onThemeChange }: ChildThemePickerProps) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="child-theme-heading" data-element-id="child-theme-picker">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Make it yours</p>
      <h2 id="child-theme-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Choose your theme</h2>
      <p className="mt-2 text-sm text-muted-foreground">Pick the look you want for your family quest.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {THEME_OPTIONS.map((theme) => (
          <ProfileThemeTile
            key={theme.key}
            themeKey={theme.key}
            selected={getRewardThemeId(themeKey) === theme.key}
            onSelect={() => void onThemeChange(theme.key)}
          />
        ))}
      </div>
      {saving ? <p className="mt-3 text-sm text-muted-foreground" role="status">Saving your theme…</p> : null}
      {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  )
}
