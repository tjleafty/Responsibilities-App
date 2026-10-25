import { Gift, Sparkles, Target } from "lucide-react"
import { EmptyState, ProgressBar, Ring, TokenPill } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { isActive } from "@/lib/family"
import { getKidTheme } from "@/lib/themes"
import { cn } from "@/lib/utils"

interface KidPrizesProps extends KidAppProps {
  balance: number
}

const FREQUENCY_LABEL = { daily: "Today", weekly: "This week", monthly: "This month" } as const

export function KidPrizes({ profile, goals, rewards, balance }: KidPrizesProps) {
  const theme = getKidTheme(profile.theme_key)
  const myGoals = goals.filter((goal) => goal.target_profile_id === profile.id && isActive(goal))
  const shelf = rewards
    .filter((reward) => isActive(reward) && (!reward.target_profile_id || reward.target_profile_id === profile.id))
    .sort((a, b) => (Number(a.points_required) || 0) - (Number(b.points_required) || 0))
  // The cheapest prize still out of reach is the one to save up for.
  const savingFor = shelf.find((reward) => (Number(reward.points_required) || 0) > balance) ?? null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">My prizes</h1>
        <TokenPill amount={balance} token={theme.token} className="bg-card px-4 py-2 text-lg shadow-soft" />
      </header>

      {savingFor ? (
        <section className="flex items-center gap-5 rounded-[26px] bg-card p-5 shadow-soft">
          <Ring value={balance} max={Number(savingFor.points_required) || 1} size={104} stroke={10}>
            <span className="text-2xl" aria-hidden="true">{theme.token}</span>
          </Ring>
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Saving up for</p>
            <p className="mt-1 font-display text-2xl font-semibold">{savingFor.title}</p>
            <p className="mt-1 text-lg font-bold text-primary">{(Number(savingFor.points_required) || 0) - balance} more {theme.tokenName}</p>
          </div>
        </section>
      ) : null}

      {myGoals.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Target className="h-5 w-5 text-primary" />My goals</h2>
          {myGoals.map((goal) => {
            const progress = Math.min(goal.progress, goal.target_count)
            const reached = progress >= goal.target_count
            return (
              <article key={goal.id} className="rounded-[22px] bg-card p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-xl font-semibold">{goal.title}</p>
                    <p className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABEL[goal.frequency] ?? ""}</p>
                  </div>
                  <span className="shrink-0 font-display text-lg font-semibold tabular-nums">{progress}/{goal.target_count}</span>
                </div>
                <ProgressBar value={progress} max={goal.target_count} thick className="mt-3" color={reached ? "hsl(var(--success))" : undefined} />
                {goal.prize ? (
                  <p className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-bold", reached ? "bg-success/15 text-success" : "bg-secondary/15 text-foreground")}>
                    <Gift className="h-4 w-4" />{reached ? `You won: ${goal.prize}` : `Prize: ${goal.prize}`}
                  </p>
                ) : null}
              </article>
            )
          })}
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Sparkles className="h-5 w-5 text-primary" />Prize shelf</h2>
        {shelf.length === 0 ? (
          <EmptyState emoji="🎁" title="No prizes yet">Ask a grown-up to add a prize you can save up for.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shelf.map((reward) => {
              const cost = Number(reward.points_required) || 0
              const ready = balance >= cost
              return (
                <li key={reward.id} className={cn("flex flex-col rounded-[22px] bg-card p-4 shadow-soft", ready && "ring-4 ring-accent")}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-3xl" aria-hidden="true">🎁</span>
                    <div className="min-w-0">
                      <p className="font-display text-lg font-semibold leading-tight">{reward.title}</p>
                      {reward.description ? <p className="mt-1 text-sm text-muted-foreground">{reward.description}</p> : null}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-2">
                    <TokenPill amount={cost} token={theme.token} />
                    {ready
                      ? <span className="rounded-full bg-accent px-3 py-1 text-sm font-extrabold text-accent-foreground">Ready! Ask a grown-up</span>
                      : <span className="text-sm font-bold text-muted-foreground">{cost - balance} more</span>}
                  </div>
                  {!ready ? <ProgressBar value={balance} max={cost} className="mt-3" /> : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
