import { useState } from "react"
import { ArrowRight, Check, ChevronDown, Clock3, Gift, MessageSquareText, Plus, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, EmptyState, ErrorNote, Ring, SectionTitle, StateChip, TokenPill } from "@/components/kit"
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
  const [showDone, setShowDone] = useState(false)
  const review = useReview(props)
  const rows = familyRows(chores, completions, profiles)
  const kids = kidsOf(profiles)
  const daily = rows.filter((row) => isTodayFor(row.chore, row.profile.id))
  const dailyDone = daily.filter((row) => row.state === "done").length
  const waiting = rows.filter((row) => row.state === "waiting")
  const toDo = rows.filter((row) => row.state === "todo" || row.state === "in_progress" || row.state === "sent_back")
    .sort((a, b) => order(a) - order(b))
  const done = rows.filter((row) => row.state === "done")
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

      <div className="space-y-6 xl:grid xl:grid-cols-3 xl:items-start xl:gap-4 xl:space-y-0">
      {waiting.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle count={waiting.length}><span className="h-2.5 w-2.5 rounded-full bg-accent" aria-hidden="true" />Waiting for you</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            {waiting.map((row) => (
              <li key={`${row.chore.id}-${row.profile.id}`} className="rounded-[22px] bg-card p-4 shadow-soft">
                <div className="flex items-start gap-3">
                  <ChoreIconTile title={row.chore.title} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold">{row.chore.title}</p>
                    <p className="text-sm text-muted-foreground">{row.profile.display_name} · {relativeTime(row.completion?.completed_at)}</p>
                  </div>
                  <StateChip state="waiting" label="Ready" />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StepsDone row={row} profiles={profiles} />
                  {chorePoints(row.chore) > 0 ? <TokenPill amount={chorePoints(row.chore)} token={getKidTheme(row.profile.theme_key).token} prefix="+" /> : null}
                  <span className="flex-1" />
                  <button type="button" onClick={() => row.completion && review.sendBack(row.completion)} className="grid h-11 w-11 place-items-center rounded-full bg-coral/10 text-coral hover:bg-coral/20" aria-label={`Send back ${row.chore.title}`}><RotateCcw className="h-5 w-5" /></button>
                  <Button size="sm" disabled={review.busyId === row.completion?.id} onClick={() => row.completion && void review.approve(row.completion)}><Check className="h-4 w-4" />Approve</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {toDo.length > 0 ? (
        <section className="space-y-3">
          <SectionTitle count={toDo.length}><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" aria-hidden="true" />Still to do</SectionTitle>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-1">
            {toDo.map((row) => (
              <li key={`${row.chore.id}-${row.profile.id}`} className={cn("rounded-[22px] bg-card p-4 shadow-soft", row.state === "sent_back" && "border-l-[6px] border-coral")}>
                <div className="flex items-center gap-3">
                  <ChoreIconTile title={row.chore.title} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold">{row.chore.title}</p>
                    <p className="text-sm text-muted-foreground">{row.profile.display_name} · {whenLabel(row)}{isLate(row.chore, row.profile.id) ? <span className="font-bold text-coral"> · Late</span> : null}</p>
                  </div>
                  <StateChip state={row.state} label={row.state === "todo" ? "Not started" : row.state === "sent_back" ? "Trying again" : undefined} />
                </div>
                {row.state === "sent_back" && row.completion?.parent_feedback ? <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-sm">Note: “{row.completion.parent_feedback}”</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {done.length > 0 ? (
        <section className="rounded-[22px] bg-card shadow-soft">
          <button type="button" onClick={() => setShowDone((open) => !open)} aria-expanded={showDone} className="flex w-full items-center gap-3 p-4 text-left">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-success/15 text-success"><Check className="h-5 w-5" strokeWidth={3} /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-lg font-semibold">{done.length} {done.length === 1 ? "chore" : "chores"} done</span>
              <span className="block text-sm text-muted-foreground">{doneSummary(done)}</span>
            </span>
            <ChevronDown className={cn("h-5 w-5 transition-transform xl:hidden", showDone && "rotate-180")} />
          </button>
          <ul className={cn("space-y-2 px-4 pb-4", !showDone && "hidden xl:block")}>
            {done.map((row) => (
              <li key={`${row.chore.id}-${row.profile.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
                <Avatar profile={row.profile} size={32} />
                <span className="min-w-0 flex-1 truncate font-semibold">{row.chore.title}</span>
                <span className="text-sm text-muted-foreground">{relativeTime(row.completion?.verified_at ?? row.completion?.completed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      </div>

      <button type="button" onClick={onAddChore} className="fixed bottom-24 right-5 z-30 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95 lg:hidden" aria-label="Add chore"><Plus className="h-8 w-8" /></button>
      {review.sheet}
    </div>
  )
}

function order(row: TodayRow) {
  return row.state === "sent_back" ? 0 : row.state === "in_progress" ? 1 : 2
}

function listNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? ""
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`
}

function doneSummary(rows: TodayRow[]) {
  const counts = new Map<string, number>()
  rows.forEach((row) => counts.set(firstName(row.profile), (counts.get(firstName(row.profile)) ?? 0) + 1))
  return [...counts].map(([name, count]) => `${name} (${count})`).join(", ")
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
