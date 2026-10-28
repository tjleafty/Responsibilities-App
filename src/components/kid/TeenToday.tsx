import { useState } from "react"
import { BellRing, Check, ChevronRight, Clock3, Flame, HandHelping, Hourglass, RotateCcw, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Ring } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { kidTodayNudge } from "@/components/kid/KidToday"
import { SwapSheet } from "@/components/kid/SwapSheet"
import type { ChoreCompletionRecord, ChoreRecord } from "@/lib/familyTypes"
import { choreState, choresFor, completionFor, currentStreak, isLate, isTodayFor, kidsOf, pointsToday, type ChoreState } from "@/lib/family"
import { scheduleFor, scheduleLabel } from "@/lib/choreSchedule"
import { subtasksFor } from "@/lib/choreUtils"
import { chorePoints } from "@/lib/difficulty"
import { pendingSwaps, swapsAvailable, useSwaps } from "@/lib/swaps"
import { cn, parseUTC } from "@/lib/utils"

interface TeenTodayProps extends KidAppProps {
  balance: number
  onOpenChore: (choreId: string) => void
}

interface Row { chore: ChoreRecord; completion: ChoreCompletionRecord | null; state: ChoreState }

// Sent back first (needs action), then what's left, then what's finished.
const ORDER: ChoreState[] = ["sent_back", "in_progress", "todo", "waiting", "done"]
const byState = (a: Row, b: Row) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state)
const timeOf = (stamp?: string | null) => stamp ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(parseUTC(stamp)) : ""

/** Teen "Today": an activity ring with streak and XP, then compact chore rows. */
export function TeenToday({ profile, profiles, chores, completions, balance, onOpenChore }: TeenTodayProps) {
  const [helping, setHelping] = useState(false)
  useSwaps()
  const mySwaps = pendingSwaps().filter((row) => row.from_profile_id === profile.id)
  const rows: Row[] = choresFor(profile.id, chores, profiles).map((chore) => {
    const completion = completionFor(chore, profile.id, completions)
    return { chore: { ...chore, subtasks: JSON.stringify(subtasksFor(chore, profile.id, profiles)) }, completion, state: choreState(completion) }
  })
  const today = rows.filter((row) => isTodayFor(row.chore, profile.id)).sort(byState)
  const week = rows.filter((row) => !isTodayFor(row.chore, profile.id)).sort(byState)
  const finished = today.filter((row) => row.state === "done" || row.state === "waiting").length
  const left = today.length - finished
  const streak = currentStreak(profile.id, completions)
  const xpToday = pointsToday(profile.id, completions)
  const weekXp = week.filter((row) => row.state !== "done").reduce((sum, row) => sum + chorePoints(row.chore), 0)
  const nudge = kidTodayNudge(profile, today.filter((row) => row.state === "todo" || row.state === "in_progress" || row.state === "sent_back").map((row) => ({ title: row.chore.title, late: isLate(row.chore, profile.id) })))

  return (
    <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
      <header className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight">Today</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 font-display text-sm font-semibold tabular-nums ring-1 ring-border"><Zap className="h-4 w-4 text-primary" />{balance} XP</span>
        <span className="md:hidden"><Avatar profile={profile} size={36} /></span>
      </header>

      <section className="flex items-center gap-5 rounded-2xl bg-card p-5 ring-1 ring-border" aria-label="Today's progress">
        <Ring value={finished} max={Math.max(1, today.length)} size={112} stroke={10} color="hsl(var(--success))">
          <span className="flex flex-col items-center leading-none">
            <span className="font-display text-2xl font-bold">{finished}/{today.length}</span>
            <span className="mt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">done</span>
          </span>
        </Ring>
        <div className="min-w-0 space-y-2">
          {streak > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full bg-success/15 px-3 py-1 text-sm font-semibold text-success"><Flame className="h-4 w-4" />{streak}-day streak</span> : null}
          <p className="text-muted-foreground"><span className="font-display text-xl font-bold text-primary">+{xpToday} XP</span> today</p>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Clock3 className="h-4 w-4" />{today.length === 0 ? "Nothing due today" : left === 0 ? "Everything's in" : `${left} left today`}</p>
        </div>
      </section>

      {nudge ? (
        <p role="status" className="flex items-start gap-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span><span className="block font-semibold">{nudge.title}</span><span className="block text-sm text-muted-foreground">{nudge.body}</span></span>
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-border">No chores assigned yet.</p>
      ) : null}

      {today.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Today's chores <span className="rounded-full bg-muted px-2 py-0.5 text-foreground">{today.length}</span></h2>
          <div className="grid gap-2 lg:grid-cols-2">{today.map((row) => <TeenRow key={row.chore.id} row={row} profileId={profile.id} onOpen={() => onOpenChore(row.chore.id)} />)}</div>
        </section>
      ) : null}

      {week.length > 0 ? (
        <section className="space-y-2">
          <h2 className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">This week{weekXp > 0 ? <span className="normal-case tracking-normal text-primary">+{weekXp} XP available</span> : null}</h2>
          <div className="grid gap-2 lg:grid-cols-2">{week.map((row) => <TeenRow key={row.chore.id} row={row} profileId={profile.id} onOpen={() => onOpenChore(row.chore.id)} />)}</div>
        </section>
      ) : null}

      {swapsAvailable() && kidsOf(profiles).length > 1 ? (
        <section className="flex items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
          <HandHelping className="h-5 w-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">Pick up extra XP</span>
            <span className="block text-muted-foreground">{mySwaps.length ? `${mySwaps.length} ${mySwaps.length === 1 ? "request is" : "requests are"} waiting on a parent.` : "Take on a sibling's chore or trade one."}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => setHelping(true)}>Offer</Button>
        </section>
      ) : null}
      <SwapSheet open={helping} onOpenChange={setHelping} profile={profile} profiles={profiles} chores={chores} completions={completions} chore={null} balance={balance} token="⚡" onSent={() => undefined} />
    </div>
  )
}

function TeenRow({ row, profileId, onOpen }: { row: Row; profileId: string; onOpen: () => void }) {
  const { chore, completion, state } = row
  const xp = chorePoints(chore)
  const schedule = scheduleFor(chore, profileId)
  const due = schedule.frequency === "weekly" && schedule.days.length > 0 ? scheduleLabel(schedule) : schedule.frequency === "monthly" ? "This month" : schedule.frequency === "weekly" ? "Any day this week" : isLate(chore, profileId) ? "Late" : ""
  const sub = state === "done" ? `Approved${completion?.verified_at ? ` · ${timeOf(completion.verified_at)}` : ""}`
    : state === "waiting" ? "Waiting for review"
      : state === "sent_back" ? "Redo requested"
        : state === "in_progress" ? `In progress${due ? ` · ${due}` : ""}`
          : due
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left ring-1 ring-border transition-colors hover:bg-muted/40", state === "sent_back" && "ring-coral/50")}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg",
        state === "done" ? "bg-success text-success-foreground" : state === "waiting" ? "bg-muted text-muted-foreground" : state === "sent_back" ? "bg-coral/15 text-coral" : "border-2 border-muted-foreground/40")} aria-hidden="true">
        {state === "done" ? <Check className="h-5 w-5" strokeWidth={3} /> : state === "waiting" ? <Hourglass className="h-4 w-4" /> : state === "sent_back" ? <RotateCcw className="h-4 w-4" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-medium", state === "done" && "text-muted-foreground line-through")}>{chore.title}</span>
        {sub ? <span className={cn("block truncate text-sm", state === "sent_back" ? "text-coral" : "text-muted-foreground")}>{sub}</span> : null}
        {state === "sent_back" && (completion?.parent_feedback || completion?.rejection_reason) ? <span className="mt-1 block truncate text-sm">“{completion?.parent_feedback || completion?.rejection_reason}”</span> : null}
      </span>
      {xp > 0 ? <span className={cn("shrink-0 font-display text-sm font-semibold tabular-nums", state === "done" ? "text-success" : "text-primary")}>+{xp} XP</span> : null}
      {state === "todo" || state === "in_progress" || state === "sent_back" ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" /> : null}
      <span className="sr-only">{state.replace("_", " ")}</span>
    </button>
  )
}
