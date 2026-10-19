import { CalendarDays, Check, Clock3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { getAssignedProfileIds, getPeriodKey, getRandomlyAssignedProfileId, isRandomAssignmentEnabled } from "@/lib/choreUtils"

type DailyStatus = "todo" | "approval" | "done"

interface DailyChoreRow {
  id: string
  title: string
  profileName: string
  frequency: string
  status: DailyStatus
  note: string
}

interface ParentTodayOverviewProps {
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  loading: boolean
  onManageChores: () => void
}

function ChoreGroup({ title, rows, status }: { title: string; rows: DailyChoreRow[]; status: DailyStatus }) {
  const icon = status === "done" ? <Check className="h-4 w-4" aria-hidden="true" /> : status === "approval" ? <Clock3 className="h-4 w-4" aria-hidden="true" /> : null
  const marker = status === "done" ? "bg-primary text-primary-foreground" : status === "approval" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"

  return (
    <section className="min-w-0 rounded-2xl border border-border bg-background p-4" aria-label={`${title}: ${rows.length}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">{icon}<span>{title}</span></h3>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold tabular-nums text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length ? (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-0 items-start gap-3 py-3">
              <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${marker}`}>{status === "todo" ? <span className="h-2 w-2 rounded-full bg-current" /> : icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words text-sm font-semibold text-card-foreground">{row.title}</span>
                <span className="mt-0.5 block text-xs capitalize text-muted-foreground">{row.profileName} · {row.frequency}{row.note ? ` · ${row.note}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="py-5 text-sm text-muted-foreground">Nothing in this group today.</p>
      )}
    </section>
  )
}

export function ParentTodayOverview({ profiles, chores, completions, loading, onManageChores }: ParentTodayOverviewProps) {
  const today = new Date()
  const todayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(today)

  const rows: DailyChoreRow[] = chores.flatMap((chore) => {
    // Weekly/monthly chores lack a scheduled weekday in the current schema, so only daily chores are due in today's overview.
    if (chore.is_active === false || chore.frequency !== "daily") return []
    let assignedIds = getAssignedProfileIds(chore)
    if (isRandomAssignmentEnabled(chore)) {
      const assignedId = getRandomlyAssignedProfileId(chore, profiles, today)
      assignedIds = assignedId ? [assignedId] : []
    }

    return assignedIds.flatMap((profileId) => {
      const profile = profiles.find((item) => item.id === profileId && item.is_active !== false)
      if (!profile) return []
      const completion = completions.find((item) => item.chore_id === chore.id && item.profile_id === profileId && item.period_key === getPeriodKey(chore.frequency, today))
      const isPendingApproval = completion?.status === "pending_verification" || (completion?.status !== "approved" && completion?.status !== "rejected" && Boolean(completion?.completed_at && completion.review_status === "unreviewed"))
      const status: DailyStatus = isPendingApproval
        ? "approval"
        : completion?.status === "approved" || completion?.review_status === "approved"
          ? "done"
          : "todo"
      const note = completion?.status === "rejected"
        ? "Sent back · needs another look"
        : completion?.status === "in_progress"
          ? "In progress"
          : status === "approval"
            ? "Waiting for your review"
            : ""
      return [{ id: `${chore.id}:${profileId}`, title: chore.title, profileName: profile.display_name, frequency: chore.frequency, status, note }]
    })
  })

  const pending = rows.filter((row) => row.status === "todo")
  const approvals = rows.filter((row) => row.status === "approval")
  const completed = rows.filter((row) => row.status === "done")

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="today-overview-heading" data-element-id="parent-today-overview">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.15em] text-primary"><CalendarDays className="h-4 w-4" aria-hidden="true" />Today</p>
          <h2 id="today-overview-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Today's chore check-in</h2>
          <p className="mt-1 text-sm text-muted-foreground">{todayLabel} · See what is left, finished, or waiting for your approval.</p>
        </div>
        <Button type="button" variant="outline" onClick={onManageChores}>Manage chores</Button>
      </header>

      {loading ? (
        <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground" role="status">Updating today's chore list…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-center">
          <p className="font-semibold text-card-foreground">No chores assigned for today</p>
          <p className="mt-1 text-sm text-muted-foreground">Add an active chore and assign it to a family profile to see today's progress here.</p>
        </div>
      ) : (
        <div className="grid min-w-0 gap-3 lg:grid-cols-3">
          <ChoreGroup title="Still to do" rows={pending} status="todo" />
          <ChoreGroup title="Needs your approval" rows={approvals} status="approval" />
          <ChoreGroup title="Completed today" rows={completed} status="done" />
        </div>
      )}
    </section>
  )
}

export default ParentTodayOverview
