import type { ReactNode } from "react"
import { Check, Circle, Clock3, Hourglass, MessageSquareText, Play, RotateCcw, ThumbsUp, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, ProgressBar, Sheet, StateChip, TokenPill } from "@/components/kit"
import type { useReview } from "@/components/parent/review"
import { firstName, relativeTime, requiresApproval, type TodayRow } from "@/lib/family"
import { parseCompletedTaskIds, subtasksFor } from "@/lib/choreUtils"
import { chorePoints } from "@/lib/difficulty"
import { getKidTheme } from "@/lib/themes"
import type { FamilyProfile } from "@/lib/familyTypes"
import { cn, parseUTC } from "@/lib/utils"

type StageStatus = "done" | "current" | "upcoming" | "problem"

interface Stage {
  key: string
  title: string
  detail?: ReactNode
  status: StageStatus
  icon: ReactNode
}

/** "3:42 PM · 20 min ago", with the day added when it wasn't today. */
function stamp(value?: string | null): string | null {
  if (!value) return null
  const date = parseUTC(value)
  if (Number.isNaN(date.getTime())) return null
  const today = new Date().toDateString() === date.toDateString()
  const clock = new Intl.DateTimeFormat("en-US", today ? { hour: "numeric", minute: "2-digit" } : { weekday: "short", hour: "numeric", minute: "2-digit" }).format(date)
  return `${clock} · ${relativeTime(value)}`
}

/** Where one kid is on one chore: not started, started, finished (waiting for an OK), approved. */
export function choreStages(row: TodayRow): Stage[] {
  const { completion, state } = row
  const needsOk = requiresApproval(row.chore)
  const name = firstName(row.profile)
  const started = Boolean(completion)
  const finished = state === "waiting" || state === "done"
  const stages: Stage[] = [
    {
      key: "start",
      title: started ? "Started" : "Not started yet",
      detail: started ? stamp(completion?.started_at) : `${name} hasn't opened this chore yet.`,
      status: started ? "done" : "current",
      icon: <Play className="h-4 w-4" />,
    },
  ]
  if (state === "sent_back") {
    stages.push({
      key: "sent-back",
      title: "Sent back to try again",
      detail: <>
        {completion?.rejection_reason ? <span className="block">{completion.rejection_reason}</span> : null}
        {completion?.parent_feedback ? <span className="mt-0.5 block italic">“{completion.parent_feedback}”</span> : null}
      </>,
      status: "problem",
      icon: <RotateCcw className="h-4 w-4" />,
    })
  }
  stages.push({
    key: "working",
    title: state === "in_progress" ? "Working on it" : state === "sent_back" ? "Trying again" : finished ? "Finished" : "Finish the chore",
    detail: finished ? stamp(completion?.completed_at) : state === "in_progress" || state === "sent_back" ? `${name} has started but hasn't marked it finished.` : undefined,
    status: finished ? "done" : state === "in_progress" || state === "sent_back" ? "current" : "upcoming",
    icon: <Hourglass className="h-4 w-4" />,
  })
  if (needsOk) {
    stages.push({
      key: "ok",
      title: state === "done" ? "Approved" : state === "waiting" ? "Waiting for your OK" : "Your OK",
      detail: state === "done" ? stamp(completion?.verified_at) : state === "waiting" ? `${name} is done and waiting for you to check it.` : "This chore needs a grown-up's OK before points count.",
      status: state === "done" ? "done" : state === "waiting" ? "current" : "upcoming",
      icon: <ThumbsUp className="h-4 w-4" />,
    })
  } else if (state === "done") {
    stages.push({ key: "points", title: "Points added", detail: "No OK needed for this chore.", status: "done", icon: <ThumbsUp className="h-4 w-4" /> })
  }
  return stages
}

export function ChoreProgressSheet({ row, profiles, review, whenLabel, onClose }: {
  row: TodayRow | null
  profiles: FamilyProfile[]
  review: ReturnType<typeof useReview>
  whenLabel: (row: TodayRow) => string
  onClose: () => void
}) {
  return (
    <Sheet
      open={Boolean(row)}
      onOpenChange={(open) => { if (!open) onClose() }}
      title={row?.chore.title ?? ""}
      description={row ? `${firstName(row.profile)} · ${whenLabel(row)}` : undefined}
      footer={row?.state === "waiting" && row.completion ? (
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 border-coral/40 text-coral hover:bg-coral/10 hover:text-coral" onClick={() => { const completion = row.completion!; onClose(); review.sendBack(completion) }}>
            <RotateCcw className="h-5 w-5" />Send back
          </Button>
          <Button className="flex-1" disabled={review.busyId === row.completion.id} onClick={async () => { await review.approve(row.completion!); onClose() }}>
            <Check className="h-5 w-5" />{review.busyId === row.completion.id ? "Saving..." : "OK it"}
          </Button>
        </div>
      ) : (
        <Button variant="outline" className="w-full" onClick={onClose}>Close</Button>
      )}
    >
      {row ? <ProgressBody row={row} profiles={profiles} /> : null}
    </Sheet>
  )
}

function ProgressBody({ row, profiles }: { row: TodayRow; profiles: FamilyProfile[] }) {
  const theme = getKidTheme(row.profile.theme_key)
  const points = Number(row.completion?.reward_points_snapshot ?? 0) || chorePoints(row.chore)
  const steps = subtasksFor(row.chore, row.profile.id, profiles)
  const checked = new Set(parseCompletedTaskIds(row.completion?.completed_task_ids))
  const checkedCount = steps.filter((step) => checked.has(step.id)).length
  const stages = choreStages(row)
  const deadline = row.completion?.deadline_at && row.state === "in_progress" ? parseUTC(row.completion.deadline_at) : null
  const overTime = deadline ? deadline.getTime() < Date.now() : false

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-[20px] bg-card p-3 shadow-soft">
        <ChoreIconTile title={row.chore.title} size={52} className="rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-bold"><Avatar profile={row.profile} size={24} />{row.profile.display_name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <StateChip state={row.state} label={row.state === "todo" ? "Not started" : row.state === "sent_back" ? "Trying again" : row.state === "waiting" ? "Needs your OK" : undefined} />
            {points > 0 ? <TokenPill amount={points} token={theme.token} prefix={row.state === "done" ? "+" : ""} className="px-2 py-0.5 text-xs" /> : null}
          </div>
        </div>
      </div>

      <section aria-label="Progress">
        <h3 className="mb-2 text-sm font-bold text-muted-foreground">Where it's at</h3>
        <ol className="relative space-y-0">
          {stages.map((stage, index) => (
            <li key={stage.key} className="relative flex gap-3 pb-4 last:pb-0">
              {index < stages.length - 1 ? <span className={cn("absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5", stage.status === "done" ? "bg-success/50" : "bg-border")} aria-hidden="true" /> : null}
              <span className={cn("relative grid h-9 w-9 shrink-0 place-items-center rounded-full",
                stage.status === "done" && "bg-success text-primary-foreground",
                stage.status === "current" && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                stage.status === "problem" && "bg-coral text-primary-foreground",
                stage.status === "upcoming" && "border-2 border-dashed border-border bg-card text-muted-foreground")}>
                {stage.status === "done" ? <Check className="h-4 w-4" /> : stage.icon}
              </span>
              <div className="min-w-0 pt-1.5">
                <p className={cn("font-display font-semibold leading-tight", stage.status === "upcoming" && "text-muted-foreground", stage.status === "problem" && "text-coral")}>{stage.title}</p>
                {stage.detail ? <p className="mt-0.5 text-sm text-muted-foreground">{stage.detail}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {deadline ? (
        <p className={cn("flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold", overTime ? "bg-coral/10 text-coral" : "bg-muted")}>
          <Timer className="h-4 w-4" />{overTime ? `Time's up: the ${row.chore.time_limit_minutes}-minute limit passed` : `Time limit: ${row.chore.time_limit_minutes} minutes, ends ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(deadline)}`}
        </p>
      ) : row.chore.time_limit_minutes && row.state === "todo" ? (
        <p className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-sm font-bold"><Clock3 className="h-4 w-4" />{row.chore.time_limit_minutes}-minute limit once started</p>
      ) : null}

      {steps.length > 0 ? (
        <section aria-label="Steps">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-muted-foreground">Steps</h3>
            <span className="text-sm font-bold">{checkedCount} of {steps.length} checked</span>
          </div>
          <ProgressBar value={checkedCount} max={steps.length} color={theme.colors.primary} className="mb-3" />
          <ul className="space-y-2">
            {steps.map((step) => {
              const isChecked = checked.has(step.id)
              return (
                <li key={step.id} className={cn("flex items-center gap-3 rounded-2xl bg-card px-3 py-2.5 shadow-soft", !isChecked && "opacity-80")}>
                  {isChecked
                    ? <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-success text-primary-foreground"><Check className="h-4 w-4" /></span>
                    : <Circle className="h-6 w-6 shrink-0 text-muted-foreground" />}
                  <span className={cn("font-semibold", isChecked ? "" : "text-muted-foreground")}>{step.title}</span>
                  <span className="sr-only">{isChecked ? "(checked)" : "(not checked)"}</span>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      {row.state !== "sent_back" && row.completion?.parent_feedback ? (
        <p className="flex items-start gap-2 rounded-xl bg-muted px-3 py-2 text-sm"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />{row.completion.parent_feedback}</p>
      ) : null}
    </div>
  )
}
