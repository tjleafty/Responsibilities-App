import { ArrowRight, CalendarDays, Check, Clock3, Lock, Play, RotateCcw, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, EmptyState, MASCOT, TokenPill } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import type { ChoreRecord } from "@/lib/familyTypes"
import { choreState, choresFor, completionFor, firstName, isTodayFor, type ChoreState } from "@/lib/family"
import { parseChoreSubtasks, subtasksFor } from "@/lib/choreUtils"
import { choreVideo } from "@/lib/choreIcons"
import { themeCopy, type ThemeCopy } from "@/lib/themeCopy"
import { cn } from "@/lib/utils"
import { chorePoints } from "@/lib/difficulty"

interface KidTodayProps extends KidAppProps {
  balance: number
  token: string
  onOpenChore: (choreId: string) => void
}

// What a kid should do next: fix sent-back chores first, then finish started ones, then new ones.
const NEXT_ORDER: ChoreState[] = ["sent_back", "in_progress", "todo"]

export function KidToday({ profile, profiles, chores, completions, balance, token, onOpenChore }: KidTodayProps) {
  const mine = choresFor(profile.id, chores, profiles)
  const rows = mine.map((chore) => {
    const completion = completionFor(chore, profile.id, completions)
    // When steps are split between kids, show this kid only their share.
    return { chore: { ...chore, subtasks: JSON.stringify(subtasksFor(chore, profile.id, profiles)) }, completion, state: choreState(completion) }
  })
  const daily = rows.filter((row) => isTodayFor(row.chore, profile.id))
  const later = rows.filter((row) => !isTodayFor(row.chore, profile.id))
  const doneCount = daily.filter((row) => row.state === "done" || row.state === "waiting").length
  const next = NEXT_ORDER.map((state) => daily.find((row) => row.state === state)).find(Boolean)
    ?? NEXT_ORDER.map((state) => later.find((row) => row.state === state)).find(Boolean)
  const others = daily.filter((row) => row !== next)
  const copy = themeCopy(profile.theme_key)

  return (
    <div className="mx-auto max-w-3xl space-y-5 lg:max-w-5xl">
      <header className="flex items-center gap-3">
        <span className="md:hidden"><Avatar profile={profile} size={52} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold leading-tight sm:text-3xl">{copy.greeting(firstName(profile), new Date().getHours())}</h1>
          <p className="text-muted-foreground">{new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</p>
        </div>
        <TokenPill amount={balance} token={token} className="bg-card px-4 py-2 text-lg shadow-soft" />
      </header>

      {rows.length === 0 ? (
        <EmptyState title="No chores today!" action={null}>Enjoy your day. Your grown-up will add chores here.</EmptyState>
      ) : (
        <>
          {daily.length > 0 ? (
            <section className="rounded-[22px] bg-card p-5 shadow-soft" aria-label="Today's progress">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-xl font-semibold">{copy.journey}</h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 font-display text-sm font-semibold text-primary">{copy.progress(doneCount, daily.length)}</span>
              </div>
              <ol className="mt-4 flex items-center" aria-label="Chores in order">
                {daily.map((row, index) => (
                  <li key={row.chore.id} className={cn("flex items-center", index < daily.length - 1 && "flex-1")}>
                    <JourneyStop state={row.state} current={row === next} token={token} title={row.chore.title} />
                    {index < daily.length - 1 ? <span className={cn("mx-1 h-1.5 flex-1 rounded-full", row.state === "done" || row.state === "waiting" ? "bg-primary" : "bg-muted")} aria-hidden="true" /> : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          {next ? <HeroChore chore={next.chore} state={next.state} note={next.completion?.rejection_reason} token={token} copy={copy} onOpen={() => onOpenChore(next.chore.id)} /> : <AllDone token={token} copy={copy} />}

          {rows.length > 0 ? <p className="flex items-center gap-3 rounded-[22px] bg-primary/10 px-4 py-3 font-display text-lg font-semibold text-primary"><span aria-hidden="true" className="text-2xl">{MASCOT}</span>{copy.cheer(firstName(profile))}</p> : null}

          {others.length > 0 ? (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-semibold">{copy.more}</h2>
              <div className="grid gap-3 lg:grid-cols-2">{others.map((row) => <ChoreRow key={row.chore.id} chore={row.chore} state={row.state} token={token} onOpen={() => onOpenChore(row.chore.id)} />)}</div>
            </section>
          ) : null}

          {later.filter((row) => row !== next).length > 0 ? (
            <section className="space-y-3">
              <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><CalendarDays className="h-5 w-5 text-primary" />{copy.later}</h2>
              <div className="grid gap-3 lg:grid-cols-2">{later.filter((row) => row !== next).map((row) => <ChoreRow key={row.chore.id} chore={row.chore} state={row.state} token={token} onOpen={() => onOpenChore(row.chore.id)} />)}</div>
            </section>
          ) : null}
        </>
      )}
    </div>
  )
}

function JourneyStop({ state, current, token, title }: { state: ChoreState; current: boolean; token: string; title: string }) {
  const done = state === "done"
  return (
    <span title={title} className={cn(
      "grid h-11 w-11 shrink-0 place-items-center rounded-full text-lg sm:h-12 sm:w-12",
      done ? "bg-primary text-primary-foreground" : state === "waiting" ? "bg-accent text-accent-foreground" : current ? "bg-card text-secondary ring-4 ring-secondary" : "bg-muted text-muted-foreground",
    )}>
      {done ? <span aria-hidden="true">{token}</span> : state === "waiting" ? <Clock3 className="h-5 w-5" /> : current ? <Play className="h-5 w-5 fill-current" /> : <Lock className="h-4 w-4" />}
      <span className="sr-only">{title}: {state.replace("_", " ")}</span>
    </span>
  )
}

function HeroChore({ chore, state, note, token, copy, onOpen }: { chore: ChoreRecord; state: ChoreState; note?: string | null; token: string; copy: ThemeCopy; onOpen: () => void }) {
  const steps = parseChoreSubtasks(chore.subtasks).length
  const video = choreVideo(chore.title)
  const points = chorePoints(chore)
  return (
    <article className="overflow-hidden rounded-[26px] bg-card shadow-soft">
      <button type="button" onClick={onOpen} className="relative block h-44 w-full overflow-hidden bg-primary/10 sm:h-56" aria-label={`Open ${chore.title}`}>
        {video ? <img src={video.poster} alt="" className="h-full w-full object-cover" /> : (
          <span className="grid h-full w-full place-items-center bg-gradient-to-br from-primary/20 via-secondary/15 to-accent/30">
            <ChoreIconTile title={chore.title} size={112} className="rounded-[32px] bg-card shadow-soft" />
          </span>
        )}
        {video ? <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-sm font-bold text-[#2D2A4A]"><Play className="h-4 w-4 fill-current" />Watch how</span> : null}
        <span className="absolute right-3 top-3 rounded-full bg-secondary px-3 py-1.5 font-display text-sm font-semibold uppercase tracking-wide text-secondary-foreground">{state === "sent_back" ? copy.tryAgain : state === "in_progress" ? copy.keepGoing : copy.upNext}</span>
      </button>
      <div className="p-5">
        <h2 className="font-display text-3xl font-semibold">{chore.title}</h2>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-lg text-muted-foreground">
          {steps > 0 ? <span>{steps} {steps === 1 ? "step" : "steps"}</span> : null}
          {points > 0 ? <TokenPill amount={points} token={token} prefix="+" /> : null}
        </p>
        {state === "sent_back" ? <p className="mt-3 flex items-center gap-2 rounded-2xl bg-coral/10 px-4 py-3 font-bold text-coral"><RotateCcw className="h-5 w-5 shrink-0" />{note || "Let's try that one again."}</p> : null}
        <Button size="lg" onClick={onOpen} className="mt-4 w-full">{state === "todo" ? copy.start : state === "sent_back" ? copy.tryAgain : copy.keepGoing}<ArrowRight className="h-5 w-5" /></Button>
      </div>
    </article>
  )
}

function AllDone({ token, copy }: { token: string; copy: ThemeCopy }) {
  return (
    <section className="flex flex-col items-center rounded-[26px] bg-card px-6 py-8 text-center shadow-soft">
      <span className="grid h-24 w-24 place-items-center rounded-full bg-accent/30"><Trophy className="h-12 w-12 text-accent-foreground" /></span>
      <h2 className="mt-4 font-display text-3xl font-semibold">{copy.allDone}</h2>
      <p className="mt-2 text-lg text-muted-foreground">{copy.allDoneSub} {token}</p>
    </section>
  )
}

function ChoreRow({ chore, state, token, onOpen }: { chore: ChoreRecord; state: ChoreState; token: string; onOpen: () => void }) {
  const points = chorePoints(chore)
  const steps = parseChoreSubtasks(chore.subtasks).length
  return (
    <button type="button" onClick={onOpen} className={cn(
      "flex w-full items-center gap-4 rounded-[22px] bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.98]",
      state === "done" && "opacity-70",
      state === "sent_back" && "border-l-[6px] border-coral",
    )}>
      <ChoreIconTile title={chore.title} size={56} />
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate font-display text-xl font-semibold", state === "done" && "line-through decoration-2")}>{chore.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
          {state === "waiting" ? <span className="inline-flex items-center gap-1 rounded-full bg-accent/30 px-2.5 py-0.5 text-sm font-bold text-foreground"><Clock3 className="h-4 w-4" />Waiting</span>
            : state === "sent_back" ? <span className="inline-flex items-center gap-1 rounded-full bg-coral/15 px-2.5 py-0.5 text-sm font-bold text-coral"><RotateCcw className="h-4 w-4" />Try again</span>
              : state === "done" ? <span className="text-sm font-bold text-success">Done!</span>
                : steps > 0 ? <span className="text-sm font-semibold">{steps} steps</span> : null}
          {points > 0 ? <span className="text-sm font-bold">+{points} {token}</span> : null}
        </span>
      </span>
      <span className={cn(
        "grid h-14 w-14 shrink-0 place-items-center rounded-full",
        state === "done" ? "bg-success text-white" : state === "waiting" ? "bg-accent/40 text-foreground" : state === "sent_back" ? "bg-coral text-white" : "border-4 border-muted",
      )} aria-hidden="true">
        {state === "done" ? <Check className="h-7 w-7" strokeWidth={3} /> : state === "waiting" ? <Clock3 className="h-6 w-6" /> : state === "sent_back" ? <ArrowRight className="h-6 w-6" /> : null}
      </span>
    </button>
  )
}
