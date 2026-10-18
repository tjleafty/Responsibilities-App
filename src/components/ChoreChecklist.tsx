import { useEffect, useState } from "react"
import { ChevronRight, Clock3, Sparkles, Trophy } from "lucide-react"
import { overskill } from "@/lib/auth"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { getAssignedProfileIds, getRandomlyAssignedProfileId, getPeriodKey, getLocalPeriodKey, isRandomAssignmentEnabled, parseChoreSubtasks, parseCompletedTaskIds, areDailyChoresApproved } from "@/lib/choreUtils"
import { parseUTC } from "@/lib/utils"
import { prepareCelebration } from "@/lib/celebration"
import { ChoreTaskDialog } from "@/components/ChoreTaskDialog"

interface ChoreChecklistProps {
  activeProfile: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  onRefresh: () => Promise<void>
}

function periodLabel(frequency: ChoreRecord["frequency"]) {
  return frequency === "daily" ? "today" : frequency === "weekly" ? "this week" : "this month"
}

export function ChoreChecklist({ activeProfile, profiles, chores, completions, onRefresh }: ChoreChecklistProps) {
  const [localCompletions, setLocalCompletions] = useState<ChoreCompletionRecord[]>(completions)
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackerPeriod, setTrackerPeriod] = useState<"daily" | "weekly" | "monthly">("daily")
  const [, setClock] = useState(Date.now())
  const isParent = activeProfile.profile_type === "parent"

  useEffect(() => setLocalCompletions(completions), [completions])
  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  const assignedChores = isParent
    ? chores.filter((chore) => chore.is_active !== false)
    : chores.filter((chore) => chore.is_active !== false && (isRandomAssignmentEnabled(chore)
      ? getRandomlyAssignedProfileId(chore, profiles) === activeProfile.id
      : getAssignedProfileIds(chore).includes(activeProfile.id)))

  const completionFor = (chore: ChoreRecord) => localCompletions.find((row) =>
    row.chore_id === chore.id &&
    row.period_key === getPeriodKey(chore.frequency) &&
    (isParent || row.profile_id === activeProfile.id)
  )
  const selectedChore = chores.find((chore) => chore.id === selectedChoreId) ?? null
  const selectedCompletion = selectedChore ? completionFor(selectedChore) ?? null : null
  const selectedIsReadOnly = isParent || selectedCompletion?.status === "approved" || selectedCompletion?.status === "pending_verification"

  const upsertLocalCompletion = (updated: ChoreCompletionRecord) => {
    setLocalCompletions((current) => current.some((row) => row.id === updated.id)
      ? current.map((row) => row.id === updated.id ? updated : row)
      : [...current, updated])
  }

  const startChore = async (chore: ChoreRecord): Promise<ChoreCompletionRecord> => {
    const periodKey = getPeriodKey(chore.frequency)
    const existing = localCompletions.find((row) => row.chore_id === chore.id && row.period_key === periodKey && row.profile_id === activeProfile.id)
    if (existing) return existing
    const now = new Date()
    const deadline = chore.time_limit_minutes ? new Date(now.getTime() + Number(chore.time_limit_minutes) * 60_000) : null
    const created = await overskill.entities.chore_completion.create({
      chore_id: chore.id,
      profile_id: activeProfile.id,
      period_key: periodKey,
      completed_task_ids: JSON.stringify([]),
      status: "in_progress",
      started_at: now.toISOString(),
      deadline_at: deadline?.toISOString() ?? "",
      reward_points_snapshot: Number(chore.reward_points) || 0,
      __client_key: `${chore.id}:${activeProfile.id}:${periodKey}`,
    })
    return created as unknown as ChoreCompletionRecord
  }

  const finishChore = async (chore: ChoreRecord, completion: ChoreCompletionRecord, completedIds: string[]) => {
    const requiresApproval = chore.requires_verification === true || chore.requires_verification === 1
    const completedAt = new Date().toISOString()
    const updated = await overskill.entities.chore_completion.update(completion.id, {
      completed_task_ids: JSON.stringify(completedIds),
      status: requiresApproval ? "pending_verification" : "approved",
      completed_at: completedAt,
      review_status: requiresApproval ? "unreviewed" : "approved",
      verified_at: requiresApproval ? "" : completedAt,
      rejection_reason: "",
    })
    return updated as unknown as ChoreCompletionRecord
  }

  const saveProgress = async (chore: ChoreRecord, completedIds: string[]) => {
    setSavingId(chore.id)
    setError(null)
    try {
      const completion = completionFor(chore) ?? await startChore(chore)
      const wasRejected = completion.status === "rejected"
      const saved = await overskill.entities.chore_completion.update(completion.id, {
        completed_task_ids: JSON.stringify(completedIds),
        ...(wasRejected ? {
          status: "in_progress",
          completed_at: "",
          verified_at: "",
          review_status: "unreviewed",
          rejection_reason: "",
          parent_feedback: "",
        } : {}),
      })
      if (!saved) throw new Error("Chore progress was not saved")
      upsertLocalCompletion(saved as unknown as ChoreCompletionRecord)
    } catch (caught) {
      console.error("Chore save failed:", caught)
      setError("We couldn't save that chore. Please try again.")
      throw caught
    } finally {
      setSavingId(null)
    }
  }

  const completeChore = async (chore: ChoreRecord, completedIds: string[]) => {
    const subtasks = parseChoreSubtasks(chore.subtasks)
    if (!subtasks.every((task) => completedIds.includes(task.id))) {
      const validationError = new Error("Please complete all subtasks before finishing this chore.")
      setError(validationError.message)
      throw validationError
    }
    const celebrate = prepareCelebration({ themeKey: activeProfile.theme_key, reward: "star-shower" })
    setSavingId(chore.id)
    setError(null)
    try {
      const completion = completionFor(chore) ?? await startChore(chore)
      const updated = await finishChore(chore, completion, completedIds)
      if (!updated) throw new Error("Chore completion was not saved")
      upsertLocalCompletion(updated)
      const points = Number(updated.reward_points_snapshot ?? chore.reward_points) || 0
      const requiresApproval = chore.requires_verification === true || chore.requires_verification === 1
      const allDailyApproved = !requiresApproval && areDailyChoresApproved(chores, localCompletions, profiles, activeProfile.id, new Date(), updated)
      const reward = allDailyApproved ? "trophy" : requiresApproval ? "star-shower" : points > 0 ? "coin-jar" : "star-shower"
      const message = requiresApproval
        ? `Nice work, ${activeProfile.display_name}! ${chore.title} is ready for parent approval.`
        : allDailyApproved
          ? `All of today's chores are done, ${activeProfile.display_name}!`
          : points > 0
            ? `Chore complete, ${activeProfile.display_name}! You earned ${points} points.`
            : `Chore complete, ${activeProfile.display_name}! Great job finishing ${chore.title}.`
      const text = reward === "trophy"
        ? { title: "All chores done!", subtitle: points > 0 ? `+${points} points · Champion!` : "Champion!" }
        : reward === "coin-jar"
          ? { title: "Points earned!", points, coins: Math.min(20, Math.max(1, Math.round(points))) }
          : { title: message, subtitle: requiresApproval ? "Sent for parent review" : chore.title, stars: 1 }
      celebrate(message, { reward, text })
      await onRefresh()
    } catch (caught) {
      console.error("Chore completion failed:", caught)
      setError("We couldn't complete that chore. Please try again.")
      throw caught
    } finally {
      setSavingId(null)
    }
  }

  const approved = localCompletions.filter((row) => row.status === "approved" && row.completed_at)
  const trackerRows = isParent
    ? approved
    : approved.filter((row) => row.completed_at && getLocalPeriodKey(trackerPeriod, parseUTC(row.completed_at)) === getLocalPeriodKey(trackerPeriod))
  const points = trackerRows.reduce((sum, row) => sum + (Number(row.reward_points_snapshot) || 0), 0)

  return (
    <div className="space-y-6" data-element-id="chore-progress-and-verification">
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="progress-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Completion tracker</p><h2 id="progress-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">{isParent ? "Family progress" : `${activeProfile.display_name}'s progress`}</h2></div>
          <div className="flex rounded-xl border border-border p-1" aria-label="Progress period">{(["daily", "weekly", "monthly"] as const).map((period) => <button key={period} type="button" onClick={() => setTrackerPeriod(period)} className={`rounded-lg px-3 py-2 text-sm capitalize transition-colors ${trackerPeriod === period ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}>{period}</button>)}</div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-muted p-4"><p className="text-sm text-muted-foreground">Approved {trackerPeriod}</p><p className="mt-1 font-display text-3xl font-bold tabular-nums text-card-foreground">{trackerRows.length}</p></div><div className="rounded-2xl bg-muted p-4"><p className="flex items-center gap-2 text-sm text-muted-foreground"><Trophy className="h-4 w-4" />Reward points earned</p><p className="mt-1 font-display text-3xl font-bold tabular-nums text-card-foreground">{points}</p></div></div>
      </section>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="assigned-chores-heading">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">{isParent ? "Household assignments" : "Your checklist"}</p><h2 id="assigned-chores-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">{isParent ? "Assigned chores" : `Chores for ${activeProfile.display_name}`}</h2></div></div>
        {assignedChores.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{isParent ? "No chores have been assigned to this profile yet." : "No chores assigned yet. Ask a parent to add your first one."}</p> : <div className="mt-5 space-y-3">{assignedChores.map((chore) => {
          const subtasks = parseChoreSubtasks(chore.subtasks)
          const completion = completionFor(chore)
          const doneIds = new Set(parseCompletedTaskIds(completion?.completed_task_ids))
          const finished = completion?.status === "approved" || completion?.status === "pending_verification" || completion?.status === "rejected"
          const due = completion?.deadline_at ? new Date(completion.deadline_at) : null
          const expired = Boolean(due && !finished && due.getTime() < Date.now())
          const taskProgress = subtasks.length ? Math.round((doneIds.size / subtasks.length) * 100) : finished ? 100 : 0
          return <button type="button" key={chore.id} onClick={() => setSelectedChoreId(chore.id)} className="group flex min-h-20 w-full min-w-0 items-center gap-3 rounded-2xl border border-border p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]" data-element-id={`child-chore-${chore.id}`}>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-start justify-between gap-3"><span className="min-w-0"><span className="block truncate font-semibold text-card-foreground">{chore.title}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{chore.frequency} · {periodLabel(chore.frequency)}</span></span><span className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium capitalize text-muted-foreground">{completion?.status === "rejected" ? "Needs another look" : completion?.completed_at && completion.review_status === "unreviewed" ? "Parent can review" : completion?.status === "approved" ? "Approved" : completion?.status === "pending_verification" ? "Awaiting parent" : completion?.status === "in_progress" ? "In progress" : "Not started"}</span></span>
              {chore.reward ? <span className="mt-2 flex items-center gap-1.5 text-sm text-primary"><Trophy className="h-4 w-4" />{chore.reward}{Number(chore.reward_points) > 0 ? ` · ${chore.reward_points} points` : ""}</span> : Number(chore.reward_points) > 0 ? <span className="mt-2 block text-sm text-primary">{chore.reward_points} reward points</span> : null}
              {completion?.deadline_at ? <span className={`mt-3 flex items-center gap-2 text-xs ${expired ? "text-destructive" : "text-muted-foreground"}`}><Clock3 className="h-4 w-4" />{expired ? "Time limit passed · " : "Complete by "}{due?.toLocaleString()}</span> : chore.time_limit_minutes ? <span className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-4 w-4" />{chore.time_limit_minutes} minute time limit once started</span> : null}
              <span className="mt-3 block text-xs text-muted-foreground">{subtasks.length ? `${doneIds.size} of ${subtasks.length} tasks · ${taskProgress}%` : chore.requires_verification ? "Parent approval is required" : "Complete this chore to earn its reward"}</span>
              {completion?.status === "pending_verification" ? <span className="mt-3 block rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground">Nice work. A parent can approve this or send it back with a reason.</span> : null}
              {completion?.parent_feedback ? <span className="mt-3 block rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground whitespace-pre-wrap">A note from your parent: {completion.parent_feedback}</span> : null}
              {completion?.status === "rejected" ? <span role="alert" className="mt-3 block rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">{completion.rejection_reason || "Please check this chore and try again."}</span> : null}
              {completion?.completed_at && completion.review_status === "unreviewed" && completion.status !== "rejected" ? <span className="mt-3 block rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground">Your chore is complete. A parent can review it soon.</span> : null}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        })}</div>}
      </section>
      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}

      <ChoreTaskDialog
        chore={selectedChore}
        completion={selectedCompletion}
        open={Boolean(selectedChoreId)}
        readOnly={selectedIsReadOnly}
        busy={Boolean(selectedChoreId && savingId === selectedChoreId)}
        onOpenChange={(open) => { if (!open) setSelectedChoreId(null) }}
        onSave={(completedIds) => selectedChore ? saveProgress(selectedChore, completedIds) : Promise.resolve()}
        onComplete={(completedIds) => selectedChore ? completeChore(selectedChore, completedIds) : Promise.resolve()}
      />
    </div>
  )
}
