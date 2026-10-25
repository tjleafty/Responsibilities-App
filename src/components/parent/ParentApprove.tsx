import { useState } from "react"
import { Check, CheckCheck, ChevronDown, CircleCheck, History, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Chip, EmptyState, ErrorNote, StateChip, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { useReview } from "@/components/parent/review"
import { awaitingReview, choreState, kidsOf, relativeTime } from "@/lib/family"
import { parseChoreSubtasks, parseCompletedTaskIds } from "@/lib/choreUtils"
import { getKidTheme } from "@/lib/themes"
import { parseUTC } from "@/lib/utils"
import type { ChoreCompletionRecord } from "@/lib/familyTypes"
import { cn } from "@/lib/utils"

const newestFirst = (field: "completed_at" | "verified_at") => (a: ChoreCompletionRecord, b: ChoreCompletionRecord) =>
  parseUTC(b[field] ?? "").getTime() - parseUTC(a[field] ?? "").getTime()

export function ParentApprove(props: ParentScreenProps) {
  const { profiles, chores, completions } = props
  const [kidFilter, setKidFilter] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const review = useReview(props)
  const choreById = new Map(chores.map((chore) => [chore.id, chore]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const queue = awaitingReview(completions).filter((row) => choreById.has(row.chore_id) && profileById.has(row.profile_id)).sort(newestFirst("completed_at"))
  const visible = kidFilter ? queue.filter((row) => row.profile_id === kidFilter) : queue
  const history = completions
    .filter((row) => (choreState(row) === "done" || choreState(row) === "sent_back") && row.verified_at && choreById.has(row.chore_id))
    .sort(newestFirst("verified_at"))
    .slice(0, 20)

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Review queue</h1>
          <p className="text-muted-foreground">{queue.length === 0 ? "Nothing waiting right now." : `${queue.length} ${queue.length === 1 ? "chore is" : "chores are"} waiting for your OK.`}</p>
        </div>
        {visible.length > 1 ? <Button onClick={() => void review.approveAll(visible)} disabled={review.busyId === "all"}><CheckCheck className="h-5 w-5" />{review.busyId === "all" ? "Approving..." : `Approve all (${visible.length})`}</Button> : null}
      </header>

      {queue.length > 0 ? (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          <Chip active={!kidFilter} onClick={() => setKidFilter(null)}>All <span className="opacity-70">{queue.length}</span></Chip>
          {kidsOf(profiles).map((kid) => {
            const count = queue.filter((row) => row.profile_id === kid.id).length
            return <Chip key={kid.id} active={kidFilter === kid.id} onClick={() => setKidFilter(kid.id)} className={cn(count === 0 && "opacity-50")}>{kid.display_name} <span className="opacity-70">{count}</span></Chip>
          })}
        </div>
      ) : null}

      <ErrorNote>{review.error}</ErrorNote>

      {visible.length === 0 ? (
        <EmptyState emoji="🎉" title="All caught up!">When a kid finishes a chore that needs your OK, it shows up here.</EmptyState>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {visible.map((row) => {
            const chore = choreById.get(row.chore_id)!
            const kid = profileById.get(row.profile_id)!
            const theme = getKidTheme(kid.theme_key)
            const steps = parseChoreSubtasks(chore.subtasks)
            const checked = parseCompletedTaskIds(row.completed_task_ids)
            const points = Number(row.reward_points_snapshot ?? chore.reward_points) || 0
            return (
              <li key={row.id} className="flex flex-col rounded-[26px] bg-card p-5 shadow-soft">
                <div className="flex items-center gap-3">
                  <Avatar profile={kid} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-lg font-semibold">{kid.display_name} <span className="text-sm font-normal text-muted-foreground">· {relativeTime(row.completed_at)}</span></p>
                    <p className="text-sm font-bold" style={{ color: theme.colors.primary }}>{theme.name}</p>
                  </div>
                  {points > 0 ? <TokenPill amount={points} token={theme.token} prefix="+" /> : null}
                </div>
                <h2 className="mt-3 font-display text-2xl font-semibold">{chore.title}</h2>
                {steps.length > 0 ? (
                  <div className="mt-3 rounded-2xl bg-muted/70 p-3">
                    <p className="flex items-center justify-between text-sm font-bold">
                      <span className="flex items-center gap-1.5"><CircleCheck className="h-4 w-4 text-primary" />{checked.filter((id) => steps.some((step) => step.id === id)).length} of {steps.length} steps done</span>
                    </p>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {steps.map((step) => {
                        const done = checked.includes(step.id)
                        return <li key={step.id} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", done ? "bg-card" : "bg-coral/10 text-coral line-through")}>{done ? <Check className="h-3.5 w-3.5 text-primary" /> : null}{step.title}</li>
                      })}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
                  <Button onClick={() => void review.approve(row)} disabled={review.busyId === row.id}><Check className="h-5 w-5" />Approve{points > 0 ? ` (+${points})` : ""}</Button>
                  <Button variant="ghost" onClick={() => review.sendBack(row)} className="bg-coral/10 text-coral hover:bg-coral/20 hover:text-coral"><RotateCcw className="h-5 w-5" />Send back</Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {history.length > 0 ? (
        <section className="rounded-[22px] bg-card shadow-soft">
          <button type="button" onClick={() => setShowHistory((open) => !open)} aria-expanded={showHistory} className="flex w-full items-center gap-3 p-4 text-left font-display text-lg font-semibold">
            <History className="h-5 w-5 text-primary" />Recent decisions<ChevronDown className={cn("ml-auto h-5 w-5 transition-transform", showHistory && "rotate-180")} />
          </button>
          {showHistory ? (
            <ul className="space-y-2 px-4 pb-4">
              {history.map((row) => {
                const kid = profileById.get(row.profile_id)
                return (
                  <li key={row.id} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                    {kid ? <Avatar profile={kid} size={32} /> : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{choreById.get(row.chore_id)?.title}</span>
                      <span className="block text-xs text-muted-foreground">{kid?.display_name} · {relativeTime(row.verified_at)}</span>
                    </span>
                    <StateChip state={choreState(row)} label={choreState(row) === "done" ? "Approved" : undefined} />
                  </li>
                )
              })}
            </ul>
          ) : null}
        </section>
      ) : null}
      {review.sheet}
    </div>
  )
}
