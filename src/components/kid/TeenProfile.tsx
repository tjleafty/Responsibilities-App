import { useState } from "react"
import { Check, Flame, LogOut, Monitor, Moon, ShieldCheck, Sun, Zap } from "lucide-react"
import { DeviceReminders } from "@/components/DeviceReminders"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, Segmented } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { bestStreak, choreState, choresDone, currentStreak, pointsEarned } from "@/lib/family"
import { TEEN_ACCENTS, teenKey, teenPrefs, type TeenPrefs } from "@/lib/teen"
import { cn, parseUTC } from "@/lib/utils"

const APPEARANCE = [
  { value: "dark" as const, label: <span className="inline-flex items-center gap-1.5"><Moon className="h-4 w-4" />Dark</span> },
  { value: "light" as const, label: <span className="inline-flex items-center gap-1.5"><Sun className="h-4 w-4" />Light</span> },
  { value: "auto" as const, label: <span className="inline-flex items-center gap-1.5"><Monitor className="h-4 w-4" />Auto</span> },
]

/** Teen "Profile": stats, accent color and appearance, reminders and recent activity. */
export function TeenProfile({ profile, chores, completions, onThemeChange, onSwitchProfile }: KidAppProps) {
  const prefs = teenPrefs(profile.theme_key)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = completions.filter((row) => row.profile_id === profile.id)
  const reviewed = mine.filter((row) => ["done", "sent_back"].includes(choreState(row)))
  const approvalRate = reviewed.length ? Math.round((reviewed.filter((row) => choreState(row) === "done").length / reviewed.length) * 100) : null
  const recent = mine
    .filter((row) => row.completed_at && Date.now() - parseUTC(row.completed_at).getTime() < 7 * 86_400_000)
    .sort((a, b) => parseUTC(b.completed_at ?? "").getTime() - parseUTC(a.completed_at ?? "").getTime())
    .slice(0, 8)

  const stats = [
    { label: "Total XP", value: pointsEarned(profile.id, completions).toLocaleString(), icon: <Zap className="h-4 w-4" /> },
    { label: "Completed", value: choresDone(profile.id, completions), icon: <Check className="h-4 w-4" /> },
    { label: "Best streak", value: `${bestStreak(profile.id, completions)} days`, sub: `Current: ${currentStreak(profile.id, completions)}`, icon: <Flame className="h-4 w-4" /> },
    { label: "Approval rate", value: approvalRate === null ? "–" : `${approvalRate}%`, icon: <ShieldCheck className="h-4 w-4" /> },
  ]

  const save = async (next: Partial<TeenPrefs>) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      await onThemeChange(teenKey({ ...prefs, ...next }))
    } catch (caught) {
      console.error("Saving teen look failed:", caught)
      setError("That didn't save. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="flex items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        <Avatar profile={profile} size={64} />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight">{profile.display_name}</h1>
          <p className="text-sm text-muted-foreground">{profile.birth_year ? `Age ${new Date().getFullYear() - profile.birth_year}` : "Teen mode"}</p>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-3">
        {stats.map((stat) => (
          <li key={stat.label} className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <p className="flex items-center justify-between text-sm text-muted-foreground">{stat.label}<span className="text-primary">{stat.icon}</span></p>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums">{stat.value}</p>
            {stat.sub ? <p className="text-sm text-muted-foreground">{stat.sub}</p> : null}
          </li>
        ))}
      </ul>

      <section className="space-y-4 rounded-2xl bg-card p-5 ring-1 ring-border">
        <h2 className="font-display text-lg font-semibold">Personalize</h2>
        <div className="space-y-2">
          <p className="flex items-center justify-between text-sm text-muted-foreground">Accent color<span className="font-medium text-primary">{TEEN_ACCENTS.find((item) => item.id === prefs.accent)?.name}</span></p>
          <div className="grid grid-cols-6 gap-2">
            {TEEN_ACCENTS.map((accent) => (
              <button key={accent.id} type="button" onClick={() => void save({ accent: accent.id })} disabled={saving} aria-label={accent.name} aria-pressed={prefs.accent === accent.id}
                className={cn("grid h-11 place-items-center rounded-xl transition-transform active:scale-95", prefs.accent === accent.id && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}
                style={{ background: accent.hex }}>
                {prefs.accent === accent.id ? <Check className="h-5 w-5 text-[#0E1020]" strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Appearance</p>
          <Segmented value={prefs.appearance} options={APPEARANCE} onChange={(appearance) => void save({ appearance })} />
        </div>
        <ErrorNote>{error}</ErrorNote>
      </section>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <DeviceReminders profile={profile} kid />
      </section>

      {recent.length > 0 ? (
        <section className="space-y-2 rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="flex items-center justify-between font-display text-lg font-semibold">Recent activity<span className="text-sm font-normal text-muted-foreground">Last 7 days</span></h2>
          <ul className="divide-y divide-border">
            {recent.map((row) => {
              const state = choreState(row)
              const title = chores.find((chore) => chore.id === row.chore_id)?.title ?? "Chore"
              return (
                <li key={row.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{title}</span>
                    <span className={cn("block text-sm", state === "sent_back" ? "text-coral" : state === "done" ? "text-muted-foreground" : "text-primary")}>
                      {state === "done" ? `Approved ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(parseUTC(row.verified_at ?? row.completed_at ?? ""))}` : state === "sent_back" ? "Sent back" : state === "waiting" ? "Waiting for review" : "In progress"}
                    </span>
                  </span>
                  {Number(row.reward_points_snapshot) > 0 ? <span className={cn("font-display text-sm font-semibold tabular-nums", state === "done" ? "text-success" : "text-muted-foreground")}>+{Number(row.reward_points_snapshot)} XP</span> : null}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <Button variant="outline" size="lg" onClick={onSwitchProfile} className="w-full"><LogOut className="h-5 w-5" />Switch profile</Button>
    </div>
  )
}
