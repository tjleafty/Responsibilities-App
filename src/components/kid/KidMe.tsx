import { useState } from "react"
import { Check, Flame, LogOut, Trophy } from "lucide-react"
import { ThemePicker } from "@/components/ThemePicker"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { bestStreak, choresDone, currentStreak, pointsEarned } from "@/lib/family"
import { getKidTheme } from "@/lib/themes"

export function KidMe({ profile, completions, onThemeChange, onSwitchProfile }: KidAppProps) {
  const theme = getKidTheme(profile.theme_key)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stats = [
    { label: `${theme.tokenName} earned`, value: pointsEarned(profile.id, completions), icon: <span aria-hidden="true">{theme.token}</span> },
    { label: "Chores done", value: choresDone(profile.id, completions), icon: <Check className="h-5 w-5" strokeWidth={3} /> },
    { label: "Days in a row", value: currentStreak(profile.id, completions), icon: <Flame className="h-5 w-5" /> },
    { label: "Best streak", value: bestStreak(profile.id, completions), icon: <Trophy className="h-5 w-5" /> },
  ]

  const pick = async (themeId: string) => {
    if (themeId === theme.id || saving) return
    setSaving(true)
    setError(null)
    try {
      await onThemeChange(themeId)
    } catch (caught) {
      console.error("Theme change failed:", caught)
      setError("We couldn't change your world. Try again.")
    } finally {
      setSaving(false)
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
        <ThemePicker value={theme.id} onChange={pick} kidName={profile.display_name} label={saving ? "Saving..." : "Change"} />
      </section>

      <Button variant="outline" size="lg" onClick={onSwitchProfile} className="w-full"><LogOut className="h-5 w-5" />Switch profile</Button>
    </div>
  )
}
