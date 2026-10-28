import { useState } from "react"
import { Clock3, Gift, Hand, PartyPopper, Sparkles, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState, ErrorNote, ProgressBar, Ring, TokenPill } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { isActive } from "@/lib/family"
import { askForPrize, asksThisWeek, requestCost, requestState, requestedRewardId, type PrizeRequest } from "@/lib/prizeRequests"
import { getKidTheme } from "@/lib/themes"
import { useFamilySettings } from "@/lib/familySettings"
import { cn, parseUTC } from "@/lib/utils"

interface KidPrizesProps extends KidAppProps {
  balance: number
  onRequested: (row: PrizeRequest) => void
}

const FREQUENCY_LABEL = { daily: "Today", weekly: "This week", monthly: "This month" } as const

export function KidPrizes({ profile, goals, rewards, prizeRequests, balance, onRequested }: KidPrizesProps) {
  const theme = getKidTheme(profile.theme_key)
  const { prizes: rules } = useFamilySettings()
  const overLimit = rules.maxAsksPerWeek !== null && asksThisWeek(profile.id, prizeRequests) >= rules.maxAsksPerWeek
  const [asking, setAsking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mine = prizeRequests.filter((row) => row.profile_id === profile.id)
  const waitingFor = new Set(mine.filter((row) => requestState(row) === "pending").map(requestedRewardId))
  // Answers stay on screen for a week so a kid sees what a grown-up said.
  const weekAgo = Date.now() - 7 * 86_400_000
  const recent = mine
    .filter((row) => requestState(row) === "pending" || parseUTC(row.verified_at ?? "").getTime() >= weekAgo)
    .sort((a, b) => parseUTC(b.completed_at ?? "").getTime() - parseUTC(a.completed_at ?? "").getTime())
  const titleOf = (row: PrizeRequest) => rewards.find((reward) => reward.id === requestedRewardId(row))?.title ?? "A prize"

  const ask = async (reward: (typeof rewards)[number]) => {
    setAsking(reward.id)
    setError(null)
    try {
      onRequested(await askForPrize(reward, profile))
    } catch (caught) {
      console.error("Prize request failed:", caught)
      setError("That didn't send. Try again in a moment.")
    } finally {
      setAsking(null)
    }
  }
  const myGoals = goals.filter((goal) => goal.target_profile_id === profile.id && isActive(goal))
  const shelf = rewards
    .filter((reward) => isActive(reward) && (!reward.target_profile_id || reward.target_profile_id === profile.id))
    .sort((a, b) => (Number(a.points_required) || 0) - (Number(b.points_required) || 0))
  // The cheapest prize still out of reach is the one to save up for.
  const savingFor = shelf.find((reward) => (Number(reward.points_required) || 0) > balance && !waitingFor.has(reward.id)) ?? null

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

      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><Hand className="h-5 w-5 text-primary" />Prizes I asked for</h2>
          <ul className="space-y-2">
            {recent.map((row) => {
              const state = requestState(row)
              return (
                <li key={row.id} className={cn("flex items-center gap-3 rounded-[22px] bg-card p-4 shadow-soft", state === "granted" && "ring-4 ring-success/40")}>
                  <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full", state === "granted" ? "bg-success text-white" : state === "declined" ? "bg-muted text-muted-foreground" : "bg-accent/40")}>
                    {state === "granted" ? <PartyPopper className="h-6 w-6" /> : state === "declined" ? <Gift className="h-6 w-6" /> : <Clock3 className="h-6 w-6" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold leading-tight">{titleOf(row)}</p>
                    <p className="text-sm font-bold text-muted-foreground">
                      {state === "granted" ? "You got it! Enjoy!" : state === "declined" ? `Not this time. Your ${requestCost(row)} ${theme.tokenName} are back.` : "Waiting for a grown-up to say yes"}
                    </p>
                    {row.parent_feedback ? <p className="mt-1 text-sm">“{row.parent_feedback}”</p> : null}
                  </div>
                  <TokenPill amount={requestCost(row)} token={theme.token} />
                </li>
              )
            })}
          </ul>
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
        <ErrorNote>{error}</ErrorNote>
        {shelf.length === 0 ? (
          <EmptyState emoji="🎁" title="No prizes yet">Ask a grown-up to add a prize you can save up for.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shelf.map((reward) => {
              const cost = Number(reward.points_required) || 0
              const asked = waitingFor.has(reward.id)
              const ready = !asked && balance >= cost
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
                    {asked
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-3 py-1 text-sm font-extrabold"><Clock3 className="h-4 w-4" />Asked!</span>
                      : ready ? null
                        : <span className="text-sm font-bold text-muted-foreground">{cost - balance} more</span>}
                  </div>
                  {ready && (!rules.kidsCanAsk || overLimit)
                    ? <p className="mt-3 rounded-2xl bg-muted px-3 py-2 text-center text-sm font-bold">{rules.kidsCanAsk ? "You've asked for lots of prizes this week. Try again soon!" : "You have enough! Tell a grown-up."}</p>
                    : ready ? <Button onClick={() => void ask(reward)} disabled={asking !== null} className="mt-3 w-full"><Hand className="h-5 w-5" />{asking === reward.id ? "Asking..." : "Ask for it"}</Button>
                    : !asked ? <ProgressBar value={balance} max={cost} className="mt-3" /> : null}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
