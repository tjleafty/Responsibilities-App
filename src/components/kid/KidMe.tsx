import { useState } from "react"
import { Check, Flame, LogOut, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { bestStreak, choresDone, currentStreak, pointsEarned } from "@/lib/family"
import { KID_THEME_IDS, ensureThemeFonts, getKidTheme, kidThemeStyle } from "@/lib/themes"
import { cn } from "@/lib/utils"

export function KidMe({ profile, completions, onThemeChange, onSwitchProfile }: KidAppProps) {
  const theme = getKidTheme(profile.theme_key)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const stats = [
    { label: `${theme.tokenName} earned`, value: pointsEarned(profile.id, completions), icon: <span aria-hidden="true">{theme.token}</span> },
    { label: "Chores done", value: choresDone(profile.id, completions), icon: <Check className="h-5 w-5" strokeWidth={3} /> },
    { label: "Days in a row", value: currentStreak(profile.id, completions), icon: <Flame className="h-5 w-5" /> },
    { label: "Best streak", value: bestStreak(profile.id, completions), icon: <Trophy className="h-5 w-5" /> },
  ]

  const pick = async (themeId: string) => {
    if (themeId === theme.id || saving) return
    setSaving(themeId)
    setError(null)
    try {
      await onThemeChange(themeId)
    } catch (caught) {
      console.error("Theme change failed:", caught)
      setError("We couldn't change your world. Try again.")
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col items-center text-center">
        <Avatar profile={profile} size={104} ring />
        <h1 className="mt-3 font-display text-4xl font-semibold">{profile.display_name}</h1>
        <p className="text-lg text-muted-foreground">{theme.name} explorer</p>
      </header>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <li key={stat.label} className="rounded-[22px] bg-card p-4 text-center shadow-soft">
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-lg text-primary">{stat.icon}</span>
            <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{stat.value}</p>
            <p className="text-sm font-bold text-muted-foreground">{stat.label}</p>
          </li>
        ))}
      </ul>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Pick your world</h2>
        <ErrorNote>{error}</ErrorNote>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {KID_THEME_IDS.map((id) => {
            const option = getKidTheme(id)
            const active = option.id === theme.id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => void pick(id)}
                  onMouseEnter={() => ensureThemeFonts(id)}
                  aria-pressed={active}
                  className={cn("relative flex h-full w-full flex-col items-start rounded-[22px] p-4 text-left shadow-soft transition-transform active:scale-[0.97]", active && "ring-4 ring-primary")}
                  style={{ ...kidThemeStyle(id), backgroundColor: option.colors.bg, color: option.colors.ink }}
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl" style={{ background: option.colors.primary }} aria-hidden="true">{option.token}</span>
                  <span className="mt-3 font-semibold leading-tight" style={{ fontFamily: option.displayStack, fontSize: 18 }}>{option.name}</span>
                  <span className="mt-0.5 text-xs font-bold opacity-75">{option.vibe}</span>
                  {active ? <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-white text-[#2D2A4A] shadow-soft"><Check className="h-4 w-4" strokeWidth={3} /></span> : null}
                  {saving === id ? <span className="absolute right-3 top-3 text-xs font-bold">Saving...</span> : null}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <Button variant="outline" size="lg" onClick={onSwitchProfile} className="w-full"><LogOut className="h-5 w-5" />Switch profile</Button>
    </div>
  )
}
