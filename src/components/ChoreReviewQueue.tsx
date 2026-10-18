import { useState } from "react"
import { Check, Clock3, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { overskill } from "@/lib/auth"
import { areDailyChoresApproved, parseChoreSubtasks, parseCompletedTaskIds } from "@/lib/choreUtils"
import { parseUTC } from "@/lib/utils"
import { prepareCelebration } from "@/lib/celebration"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"

const REJECTION_REASONS = [
  "Not fully completed",
  "Needs more attention",
  "Some steps were skipped",
  "Please redo this chore",
  "Please check with me",
]

interface ChoreReviewQueueProps {
  completions: ChoreCompletionRecord[]
  chores: ChoreRecord[]
  profiles: FamilyProfile[]
  onRefresh: () => Promise<void>
}

export function ChoreReviewQueue({ completions, chores, profiles, onRefresh }: ChoreReviewQueueProps) {
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [feedback, setFeedback] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const reviewRows = completions
    .filter((row) => Boolean(row.completed_at) && row.review_status !== "approved" && row.review_status !== "rejected")
    .map((row) => ({ row, chore: chores.find((item) => item.id === row.chore_id), profile: profiles.find((item) => item.id === row.profile_id) }))
    .filter((item): item is { row: ChoreCompletionRecord; chore: ChoreRecord; profile: FamilyProfile | undefined } => Boolean(item.chore))

  const historyRows = completions
    .filter((row) => Boolean(row.completed_at) && (row.review_status === "approved" || row.review_status === "rejected"))
    .map((row) => ({ row, profile: profiles.find((item) => item.id === row.profile_id), chore: chores.find((item) => item.id === row.chore_id) }))
    .filter((item): item is { row: ChoreCompletionRecord; profile: FamilyProfile; chore: ChoreRecord } => Boolean(item.profile) && Boolean(item.chore))
    .sort((a, b) => {
      const aVerified = a.row.verified_at ? parseUTC(a.row.verified_at).getTime() : a.row.completed_at ? parseUTC(a.row.completed_at).getTime() : Infinity
      const bVerified = b.row.verified_at ? parseUTC(b.row.verified_at).getTime() : b.row.completed_at ? parseUTC(b.row.completed_at).getTime() : Infinity
      return bVerified - aVerified
    })

  const review = async (completion: ChoreCompletionRecord, decision: "approved" | "rejected") => {
    const reason = reasons[completion.id]
    if (decision === "rejected" && !reason) return
    setSavingId(completion.id)
    setError(null)
    try {
      const child = profiles.find((profile) => profile.id === completion.profile_id)
      const celebrate = decision === "approved" ? prepareCelebration({ themeKey: child?.theme_key, reward: "star-shower" }) : null
      const updated = await overskill.entities.chore_completion.update(completion.id, {
        status: decision,
        review_status: decision,
        rejection_reason: decision === "rejected" ? reason : "",
        parent_feedback: feedback[completion.id]?.trim() ?? "",
        verified_at: new Date().toISOString(),
      })
      if (!updated) throw new Error("Review could not be saved")
      await onRefresh()
      if (decision === "approved") {
        const approved = updated as unknown as ChoreCompletionRecord
        const allDailyDone = areDailyChoresApproved(chores, completions, profiles, completion.profile_id, new Date(), approved)
        const points = Number(approved.reward_points_snapshot) || 0
        const reward = allDailyDone ? "trophy" : points > 0 ? "coin-jar" : "star-shower"
        const message = allDailyDone
          ? `${child?.display_name ?? "Your child"} finished today's chores!`
          : `${child?.display_name ?? "Your child"} got parent approval!`
        const text = reward === "trophy"
          ? { title: "All chores done!", subtitle: points > 0 ? `+${points} points · Champion!` : "Champion!" }
          : reward === "coin-jar"
            ? { title: "Points earned!", points, coins: Math.min(20, Math.max(1, Math.round(points))) }
            : { title: message, subtitle: "Approved by your parent", stars: 1 }
        celebrate?.(message, { themeKey: child?.theme_key, reward, text })
      }
    } catch (caught) {
      console.error("Chore review failed:", caught)
      setError("We couldn't save this review. Please try again.")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="chore-review-heading" data-element-id="parent-chore-review">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Check className="h-5 w-5" aria-hidden="true" /></span>
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Parent review</p><h2 id="chore-review-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Chore completions</h2><p className="mt-1 text-sm text-muted-foreground">Check each submission, approve it, or send it back with a reason.</p></div>
      </div>
      {error ? <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
      {reviewRows.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">All completed chores have been reviewed. New submissions will appear here.</p> : <ul className="mt-5 space-y-4">{reviewRows.map(({ row, chore, profile }) => {
        const completedIds = new Set(parseCompletedTaskIds(row.completed_task_ids))
        const subtasks = parseChoreSubtasks(chore.subtasks)
        const busy = savingId === row.id
        return <li key={row.id} className="min-w-0 rounded-2xl border border-border bg-background p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="break-words font-semibold text-card-foreground">{chore.title}</h3><p className="mt-1 text-sm text-muted-foreground">{profile?.display_name ?? "Family profile"} · <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{row.completed_at ? parseUTC(row.completed_at).toLocaleString() : "Completed"}</span></p><p className="mt-1 text-xs text-muted-foreground">{chore.requires_verification ? "Approval was requested" : "Completed chore · parent check-in"}</p></div>
            <span className="shrink-0 rounded-full bg-secondary/60 px-3 py-1 text-xs font-semibold text-secondary-foreground">Needs review</span>
          </div>
          <div className="mt-4 rounded-xl bg-muted/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Submitted steps</p>
            {subtasks.length ? <ul className="space-y-2">{subtasks.map((task) => { const checked = completedIds.has(task.id); return <li key={task.id} className="flex min-w-0 items-start gap-2 text-sm"><span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border ${checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground"}`}>{checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}</span><span className={checked ? "text-card-foreground" : "text-muted-foreground"}>{task.title}{checked ? " · done" : " · not checked"}</span></li> })}</ul> : <p className="text-sm text-muted-foreground">This chore has no checklist steps.</p>}
          </div>
          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5 text-sm font-medium text-card-foreground">Reason to send back<Select value={reasons[row.id] ?? ""} onValueChange={(value) => setReasons((current) => ({ ...current, [row.id]: value }))}><SelectTrigger aria-label={`Choose a rejection reason for ${chore.title}`} disabled={busy}><SelectValue placeholder="Choose a reason" /></SelectTrigger><SelectContent>{REJECTION_REASONS.map((reason) => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}</SelectContent></Select></label>
            <label className="block space-y-1.5 text-sm font-medium text-card-foreground">
              <span>Note for your child <span className="font-normal text-muted-foreground">(optional)</span></span>
              <Textarea
                value={feedback[row.id] ?? ""}
                onChange={(event) => setFeedback((current) => ({ ...current, [row.id]: event.target.value }))}
                placeholder="Recognize their effort or add a helpful reminder."
                disabled={busy}
                className="min-h-20 text-base md:text-sm"
              />
              <span className="block text-xs font-normal text-muted-foreground">This note is separate from the reason to send a chore back.</span>
            </label>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" onClick={() => void review(row, "approved")} disabled={busy} className="active:scale-[0.96]"><Check className="h-4 w-4" aria-hidden="true" />{busy ? "Saving…" : "Approve"}</Button>
              <Button type="button" variant="outline" onClick={() => void review(row, "rejected")} disabled={busy || !reasons[row.id]} className="active:scale-[0.96]"><RotateCcw className="h-4 w-4" aria-hidden="true" />Send back</Button>
            </div>
          </div>
        </li>
      })}</ul>}

      <div className="mt-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Past approval history</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          View a list of previous approvals and rejections.
        </p>
        <ul className="mt-3 space-y-3">
          {historyRows.length === 0 ? (
            <li className="rounded-2xl border border-border bg-background p-3 text-center text-muted-foreground">
              No approval history available.
            </li>
          ) : (
            historyRows.map(({ row, profile, chore }) => {
              const verifiedAt = row.verified_at ? parseUTC(row.verified_at) : row.completed_at ? parseUTC(row.completed_at) : new Date()
              const completedAt = row.completed_at ? parseUTC(row.completed_at) : new Date()
              return (
                <li key={row.id} className="rounded-2xl border border-border bg-background p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-medium text-card-foreground">{chore.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {profile.display_name ?? "Family profile"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {row.review_status === "approved" ? (
                          <span className="text-primary">Approved</span>
                        ) : (
                          <span className="text-destructive">Rejected</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-sm text-muted-foreground">
                        Verified: {verifiedAt.toLocaleString()}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Completed: {completedAt.toLocaleString()}
                      </p>
                      {row.parent_feedback && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Parent note: {row.parent_feedback}
                        </p>
                      )}
                      {row.rejection_reason && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Reason: {row.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </section>
  )
}

export default ChoreReviewQueue
