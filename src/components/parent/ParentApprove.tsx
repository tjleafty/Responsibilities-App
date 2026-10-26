import { useState } from "react"
import { Check, CheckCheck, ChevronRight, CircleCheck, History, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Chip, EmptyState, ErrorNote, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { useReview } from "@/components/parent/review"
import { ApprovalHistory, reviewedRows } from "@/components/parent/ApprovalHistory"
import { PrizeRequests } from "@/components/parent/PrizeRequests"
import { pendingRequests } from "@/lib/prizeRequests"
import { awaitingReview, kidsOf, relativeTime } from "@/lib/family"
import { parseChoreSubtasks, parseCompletedTaskIds } from "@/lib/choreUtils"
import { getKidTheme } from "@/lib/themes"
import type { ChoreCompletionRecord } from "@/lib/familyTypes"
import { cn, parseUTC } from "@/lib/utils"

const newestFirst = (field: "completed_at" | "verified_at") => (a: ChoreCompletionRecord, b: ChoreCompletionRecord) =>
  parseUTC(b[field] ?? "").getTime() - parseUTC(a[field] ?? "").getTime()

export function ParentApprove(props: ParentScreenProps) {
  const { profiles, chores, completions, prizeRequests } = props
  const [kidFilter, setKidFilter] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const review = useReview(props)
  const choreById = new Map(chores.map((chore) => [chore.id, chore]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const queue = awaitingReview(completions).filter((row) => choreById.has(row.chore_id) && profileById.has(row.profile_id)).sort(newestFirst("completed_at"))
  const visible = kidFilter ? queue.filter((row) => row.profile_id === kidFilter) : queue
  const history = reviewedRows(completions, chores)
  const weekAgo = Date.now() - 7 * 86_400_000
  const prizeAsks = pendingRequests(prizeRequests).length
  const thisWeek = history.filter((row) => parseUTC(row.verified_at ?? "").getTime() >= weekAgo).length

  if (showHistory) return <ApprovalHistory profiles={profiles} chores={chores} completions={completions} onBack={() => setShowHistory(false)} />

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Review queue</h1>
          <p className="text-muted-foreground">{queue.length + prizeAsks === 0 ? "Nothing waiting right now." : waitingLine(queue.length, prizeAsks)}</p>
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

      <PrizeRequests {...props} />

      <ErrorNote>{review.error}</ErrorNote>

      {visible.length === 0 && (prizeAsks === 0 || queue.length > 0) ? (
        <EmptyState emoji="🎉" title="All caught up!">When a kid finishes a chore that needs your OK, it shows up here.</EmptyState>
      ) : visible.length === 0 ? null : (
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
        <button type="button" onClick={() => setShowHistory(true)} className="mx-auto flex min-h-12 items-center gap-2 rounded-full bg-card px-5 font-display font-semibold shadow-soft hover:bg-muted">
          <History className="h-5 w-5 text-primary" />See approval history ({thisWeek} this week)<ChevronRight className="h-5 w-5" />
        </button>
      ) : null}
      {review.sheet}
    </div>
  )
}

function waitingLine(chores: number, prizes: number) {
  const parts = [
    chores ? `${chores} ${chores === 1 ? "chore" : "chores"}` : "",
    prizes ? `${prizes} prize ${prizes === 1 ? "request" : "requests"}` : "",
  ].filter(Boolean)
  return `${parts.join(" and ")} waiting for your OK.`
}
