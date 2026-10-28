import { useState } from "react"
import { ArrowRight, BarChart3, Check, Clock3, Gift, MessageSquareText, Plus, RotateCcw, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Chip, ChoreIconTile, EmptyState, ErrorNote, Ring, Segmented, StateChip, TokenPill } from "@/components/kit"
import { ParentInsights } from "@/components/parent/ParentInsights"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { useReview } from "@/components/parent/review"
import { familyRows, firstName, isLate, isTodayFor, kidsOf, pointsToday, relativeTime, type TodayRow } from "@/lib/family"
import { scheduleFor, scheduleLabel } from "@/lib/choreSchedule"
import { pendingRequests, requestedRewardId } from "@/lib/prizeRequests"
import { getKidTheme } from "@/lib/themes"
import { parseCompletedTaskIds, subtasksFor } from "@/lib/choreUtils"
import type { FamilyProfile } from "@/lib/familyTypes"
import { chorePoints } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

const FREQUENCY = { daily: "Today", weekly: "This week", monthly: "This month" } as const

function whenLabel(row: TodayRow) {
  const schedule = scheduleFor(row.chore, row.profile.id)
  return schedule.weekday === null && schedule.every === 1 ? FREQUENCY[schedule.frequency] : scheduleLabel(schedule)
}

export function ParentToday(props: ParentScreenProps) {
  const { profile, profiles, chores, completions, prizeRequests, rewards, onNavigate, onAddChore } = props
  const [filter, setFilter] = useState<BoardFilter>("all")
  const [view, setView] = useState<"today" | "insights">("today")
  const review = useReview(props)
  const rows = familyRows(chores, completions, profiles)
  const kids = kidsOf(profiles)
  const daily = rows.filter((row) => isTodayFor(row.chore, row.profile.id))
  const dailyDone = daily.filter((row) => row.state === "done").length
  const waiting = rows.filter((row) => row.state === "waiting")
  const board = rows.filter((row) => FILTERS.find((option) => option.value === filter)!.match(row.state)).sort((a, b) => order(a) - order(b))
  const waitingNames = [...new Set(waiting.map((row) => firstName(row.profile)))]
  const prizeAsks = pendingRequests(prizeRequests).filter((row) => profiles.some((kid) => kid.id === row.profile_id))
  const firstAsk = prizeAsks[0]

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-muted-foreground">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(new Date())}</p>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Hi {firstName(profile)} <span aria-hidden="true">👋</span></h1>
          {daily.length > 0 ? <p className="mt-1 text-muted-foreground">The kids have finished {dailyDone} of {daily.length} chores for today.</p> : null}
        </div>
        <Button onClick={onAddChore} className="hidden lg:inline-flex"><Plus className="h-5 w-5" />Add chore</Button>
      </header>

      <Segmented value={view} onChange={setView} size="lg" className="max-w-md" options={[
        { value: "today", label: <span className="inline-flex items-center gap-1.5"><Sun className="h-4 w-4" />Today</span> },
        { value: "insights", label: <span className="inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Insights</span> },
      ]} />

      {view === "insights" ? <ParentInsights {...props} /> : <>

      {kids.length === 0 ? (
        <EmptyState title="Add your first kid" action={<Button onClick={() => onNavigate("family")}>Go to Family</Button>}>Kids get their own profile, theme and chores.</EmptyState>
      ) : (
        <ul className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {kids.map((kid) => <KidCard key={kid.id} kid={kid} rows={rows.filter((row) => row.profile.id === kid.id)} points={pointsToday(kid.id, completions)} />)}
        </ul>
      )}

      {waiting.length > 0 ? (
        <section className="flex flex-col gap-4 rounded-[22px] bg-card p-5 shadow-soft sm:flex-row sm:items-center">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-secondary"><MessageSquareText className="h-7 w-7" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl font-semibold">{waiting.length} {waiting.length === 1 ? "chore needs" : "chores need"} your OK</p>
            <p className="text-muted-foreground">{listNames(waitingNames)} finished and {waitingNames.length === 1 ? "is" : "are"} waiting for you.</p>
          </div>
          <Button onClick={() => onNavigate("approve")}>Review all ({waiting.length})<ArrowRight className="h-5 w-5" /></Button>
        </section>
      ) : null}

      {firstAsk ? (
        <button type="button" onClick={() => onNavigate("approve")} className="flex w-full items-center gap-4 rounded-[22px] bg-card p-4 text-left shadow-soft hover:bg-muted/60">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-secondary"><Gift className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg font-semibold">{prizeAsks.length === 1 ? "A prize request" : `${prizeAsks.length} prize requests`}</span>
            <span className="block truncate text-muted-foreground">
              {firstName(profiles.find((kid) => kid.id === firstAsk.profile_id)!)} is asking for {rewards.find((reward) => reward.id === requestedRewardId(firstAsk))?.title ?? "a prize"}{prizeAsks.length > 1 ? ` and ${prizeAsks.length - 1} more` : ""}
            </span>
          </span>
          <ArrowRight className="h-5 w-5 text-muted-foreground" />
        </button>
      ) : null}

      <ErrorNote>{review.error}</ErrorNote>

      {rows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl font-semibold">Chore board</h2>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {FILTERS.map((option) => {
                const count = rows.filter((row) => option.match(row.state)).length
                return <Chip key={option.value} active={filter === option.value} onClick={() => setFilter(option.value)}>{option.label} ({count})</Chip>
              })}
            </div>
          </div>
          {board.length === 0 ? <p className="rounded-[22px] bg-card p-5 text-muted-foreground shadow-soft">Nothing here right now.</p> : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {board.map((row) => <ChoreTile key={`${row.chore.id}-${row.profile.id}`} row={row} profiles={profiles} review={review} />)}
            </ul>
          )}
        </section>
      ) : null}

      </>}

      <button type="button" onClick={onAddChore} className="fixed bottom-24 right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden" aria-label="Add chore"><Plus className="h-8 w-8" /></button>
      {review.sheet}
    </div>
  )
}

type BoardFilter = "all" | "waiting" | "todo" | "done"

const FILTERS: Array<{ value: BoardFilter; label: string; match: (state: TodayRow["state"]) => boolean }> = [
  { value: "all", label: "All", match: () => true },
  { value: "waiting", label: "Needs OK", match: (state) => state === "waiting" },
  { value: "todo", label: "To do", match: (state) => state === "todo" || state === "in_progress" || state === "sent_back" },
  { value: "done", label: "Done", match: (state) => state === "done" },
]

const ORDER: Record<TodayRow["state"], number> = { waiting: 0, sent_back: 1, in_progress: 2, todo: 3, done: 4 }
function order(row: TodayRow) {
  return ORDER[row.state]
}

/** One chore for one kid, small enough to fit several in a row. */
function ChoreTile({ row, profiles, review }: { row: TodayRow; profiles: FamilyProfile[]; review: ReturnType<typeof useReview> }) {
  const points = chorePoints(row.chore)
  const late = row.state !== "done" && isLate(row.chore, row.profile.id)
  return (
    <li className={cn("flex flex-col gap-2 rounded-[20px] bg-card p-3 shadow-soft", row.state === "done" && "opacity-75", row.state === "sent_back" && "ring-2 ring-coral/60", row.state === "waiting" && "ring-2 ring-accent")}>
      <div className="flex items-start justify-between gap-2">
        <ChoreIconTile title={row.chore.title} size={40} className="rounded-xl" />
        <Avatar profile={row.profile} size={28} />
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] font-display font-semibold leading-tight">{row.chore.title}</p>
      <p className="truncate text-xs font-bold text-muted-foreground">{firstName(row.profile)} · {whenLabel(row)}{late ? <span className="text-coral"> · Late</span> : null}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <StateChip state={row.state} label={row.state === "todo" ? "Not started" : row.state === "sent_back" ? "Trying again" : row.state === "waiting" ? "Ready" : undefined} />
        {row.state === "waiting" ? <StepsDone row={row} profiles={profiles} /> : null}
        {points > 0 && row.state !== "done" ? <TokenPill amount={points} token={getKidTheme(row.profile.theme_key).token} prefix="+" className="px-2 py-0.5 text-xs" /> : null}
      </div>
      {row.state === "done" ? <p className="text-xs text-muted-foreground">{relativeTime(row.completion?.verified_at ?? row.completion?.completed_at)}</p> : null}
      {row.state === "waiting" ? (
        <div className="flex gap-2">
          <button type="button" onClick={() => row.completion && review.sendBack(row.completion)} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-coral/10 text-coral hover:bg-coral/20" aria-label={`Send back ${row.chore.title}`}><RotateCcw className="h-4 w-4" /></button>
          <Button size="sm" disabled={review.busyId === row.completion?.id} onClick={() => row.completion && void review.approve(row.completion)} className="flex-1"><Check className="h-4 w-4" />OK</Button>
        </div>
      ) : null}
    </li>
  )
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function StepsDone({ row, profiles }: { row: TodayRow; profiles: FamilyProfile[] }) {
  const steps = subtasksFor(row.chore, row.profile.id, profiles)
  if (steps.length === 0) return null
  const checked = parseCompletedTaskIds(row.completion?.completed_task_ids).filter((id) => steps.some((step) => step.id === id)).length
  return <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-muted px-2.5 py-1 text-xs font-bold"><Check className="h-3.5 w-3.5" />{checked}/{steps.length} steps</span>
}

function KidCard({ kid, rows, points }: { kid: TodayRow["profile"]; rows: TodayRow[]; points: number }) {
  const theme = getKidTheme(kid.theme_key)
  const daily = rows.filter((row) => isTodayFor(row.chore, row.profile.id))
  const doneCount = daily.filter((row) => row.state === "done").length
  const waiting = rows.filter((row) => row.state === "waiting").length
  const sentBack = rows.filter((row) => row.state === "sent_back").length
  const left = rows.filter((row) => row.state === "todo" || row.state === "in_progress").length
  return (
    <li className="w-[78%] shrink-0 snap-start rounded-[22px] bg-card p-4 shadow-soft sm:w-auto">
      <div className="flex items-start justify-between gap-3">
        <Avatar profile={kid} size={52} />
        <Ring value={doneCount} max={daily.length} size={52} color={theme.colors.primary}>{doneCount}/{daily.length}</Ring>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="truncate font-display text-xl font-semibold">{kid.display_name}</p>
        <TokenPill amount={points} token={theme.token} prefix="+" />
      </div>
      <p className="text-sm text-muted-foreground">{theme.name}</p>
      <p className={cn("mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold",
        waiting ? "bg-accent/25" : sentBack ? "bg-coral/10 text-coral" : left ? "bg-muted" : "bg-success/10 text-success")}>
        {waiting ? <><Clock3 className="h-4 w-4" />{waiting} waiting for you</>
          : sentBack ? <><RotateCcw className="h-4 w-4" />{sentBack} trying again</>
            : left ? <>{left} still to do</>
              : <><Check className="h-4 w-4" />All caught up</>}
      </p>
    </li>
  )
}
