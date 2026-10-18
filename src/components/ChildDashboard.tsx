import { ArrowLeft, Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileThemeTile } from "@/components/ProfileThemeTile"
import { ChoreChecklist } from "@/components/ChoreChecklist"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, GoalRecord } from "@/lib/familyTypes"
import { getTheme } from "@/lib/familyTypes"
import { ChildThemePicker } from "@/components/ChildThemePicker"
import { getRewardThemeStyle } from "@/lib/rewardThemes"

interface ChildDashboardProps {
  profile: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  goals: GoalRecord[]
  onRefresh: () => Promise<void>
  onParent: () => void
  themeSaving: boolean
  themeError: string | null
  onThemeChange: (themeKey: string) => Promise<void>
}

export function ChildDashboard({ profile, profiles, chores, completions, goals, onRefresh, onParent, themeSaving, themeError, onThemeChange }: ChildDashboardProps) {
  const theme = getTheme(profile.theme_key)
  const goalsForChild = goals.filter((goal) => goal.target_profile_id === profile.id)

  return (
    <main className="min-h-screen bg-background px-4 py-5 sm:px-6 sm:py-8" data-element-id="child-facing-dashboard" style={getRewardThemeStyle(profile.theme_key)}>
      <header className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-3"><button type="button" onClick={onParent} aria-label="Open parent dashboard" title="Parent dashboard" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-border bg-card text-primary shadow-sm transition-transform active:scale-[0.96]"><ArrowLeft className="h-5 w-5" /></button><div className="min-w-0 text-right"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{theme.label}</p><p className="truncate text-sm text-muted-foreground">{profile.display_name}'s quest</p></div></header>
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="grid gap-5 overflow-hidden rounded-[2rem] border border-border bg-card p-4 shadow-sm sm:grid-cols-[0.8fr_1.2fr] sm:items-center sm:p-7"><div className="mx-auto w-full max-w-sm sm:mx-0"><ProfileThemeTile themeKey={profile.theme_key} /></div><div className="py-2 sm:py-4"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your family quest</p><h1 className="mt-2 font-display text-4xl font-bold text-card-foreground sm:text-5xl">Hi, {profile.display_name}!</h1><p className="mt-3 text-base leading-7 text-muted-foreground">{theme.description} Pick a task, check it off, and watch your progress grow.</p><div className="mt-5 inline-flex items-center gap-2 rounded-full bg-secondary/60 px-4 py-2 text-sm font-semibold text-secondary-foreground"><Star className="h-4 w-4" />Every small step counts</div></div></section>
        <ChildThemePicker themeKey={profile.theme_key} saving={themeSaving} error={themeError} onThemeChange={(themeKey) => { void onThemeChange(themeKey) }} />
        <ChoreChecklist activeProfile={profile} profiles={profiles} chores={chores} completions={completions} onRefresh={onRefresh} />
        <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="child-goals-heading"><div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your milestones</p><h2 id="child-goals-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Little steps, big wins</h2></div><Star className="h-7 w-7 text-secondary-foreground" /></div>{goalsForChild.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Your parent has not assigned a goal yet. Keep doing your chores and check back soon.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{goalsForChild.map((goal) => { const progress = Math.min(Number(goal.progress), Number(goal.target_count)); const percent = goal.target_count > 0 ? Math.round(progress / Number(goal.target_count) * 100) : 0; return <article key={goal.id} className="min-w-0 rounded-2xl border border-border p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{goal.title}</h3><p className="mt-1 text-sm capitalize text-muted-foreground">{goal.frequency} goal</p>{goal.prize ? <p className="mt-2 text-sm text-primary">Reward: {goal.prize}</p> : null}</div><span className="tabular-nums shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-secondary-foreground">{progress}/{goal.target_count}</span></div><div className="mt-4 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{percent}% of your goal</p></article> })}</div>}</section>
      </div>
    </main>
  )
}
