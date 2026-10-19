import { useEffect, useMemo, useRef, useState } from "react"
import { Play, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ChoreCompletionRecord, ChoreRecord } from "@/lib/familyTypes"
import { parseChoreSubtasks, parseCompletedTaskIds } from "@/lib/choreUtils"

interface ChoreTaskDialogProps {
  chore: ChoreRecord | null
  completion: ChoreCompletionRecord | null
  open: boolean
  readOnly: boolean
  busy: boolean
  onOpenChange: (open: boolean) => void
  onSave: (completedIds: string[]) => Promise<void>
  onComplete: (completedIds: string[]) => Promise<void>
}

export function ChoreTaskDialog({ chore, completion, open, readOnly, busy, onOpenChange, onSave, onComplete }: ChoreTaskDialogProps) {
  const subtasks = useMemo(() => parseChoreSubtasks(chore?.subtasks), [chore?.id, chore?.subtasks])
  const [completedIds, setCompletedIds] = useState<string[]>([])
  const [mainComplete, setMainComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const completedSet = useMemo(() => new Set(completedIds), [completedIds])
  const allSubtasksComplete = subtasks.length > 0 && subtasks.every((task) => completedSet.has(task.id))
  const requiresApproval = chore?.requires_verification === true || chore?.requires_verification === 1
  const isApproved = completion?.status === "approved"
  const isPendingApproval = completion?.status === "pending_verification"
  const canSubmitAsComplete = subtasks.length > 0 ? allSubtasksComplete : requiresApproval || mainComplete

  useEffect(() => {
    setCompletedIds(parseCompletedTaskIds(completion?.completed_task_ids))
    setMainComplete(completion?.status === "approved")
    setError(null)
  }, [chore?.id, completion?.id, completion?.completed_task_ids, completion?.status])

  const submittingRef = useRef(false)

  const saveOrComplete = async (ids: string[], complete: boolean) => {
    if (!chore || busy || readOnly || submittingRef.current) return
    submittingRef.current = true
    setError(null)
    try {
      if (complete) await onComplete(ids)
      else await onSave(ids)
    } catch (caught) {
      console.error("Chore progress save failed:", caught)
      setError("We couldn't save this chore. Please try again.")
    } finally {
      submittingRef.current = false
    }
  }

  const toggleSubtask = (taskId: string) => {
    const next = completedIds.includes(taskId)
      ? completedIds.filter((id) => id !== taskId)
      : [...completedIds, taskId]
    setCompletedIds(next)
    setMainComplete(false)
    if (subtasks.length > 0 && subtasks.every((task) => next.includes(task.id))) {
      void saveOrComplete(next, true)
    }
  }

  const toggleMainComplete = (checked: boolean) => {
    setMainComplete(checked)
    if (checked && subtasks.length === 0 && !requiresApproval) {
      void saveOrComplete(completedIds, true)
    }
  }

  const submit = () => saveOrComplete(completedIds, canSubmitAsComplete)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        {chore ? <>
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{chore.title}</DialogTitle>
            <DialogDescription>Check off each step as you finish it. Completing the last step submits this chore automatically. You can also save progress and return later.</DialogDescription>
          </DialogHeader>
          <section className="rounded-2xl border border-border bg-muted/40 p-4" aria-label="Instructional video">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground"><Play className="h-5 w-5" /></span>
              <div><p className="font-semibold text-card-foreground">How to do this chore</p><p className="text-sm text-muted-foreground">Instructional videos are coming soon.</p></div>
            </div>
          </section>
          {subtasks.length > 0 ? <section className="space-y-2" aria-label="Chore steps">
            <h3 className="text-sm font-semibold text-muted-foreground">Steps</h3>
            {subtasks.map((task) => <label key={task.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm">
              <Checkbox checked={completedSet.has(task.id)} disabled={readOnly || busy} onCheckedChange={() => toggleSubtask(task.id)} />
              <span className={`min-w-0 flex-1 ${completedSet.has(task.id) ? "text-muted-foreground line-through" : "text-card-foreground"}`}>{task.title}</span>
            </label>)}
          </section> : null}
          <label className={`flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 text-sm ${!allSubtasksComplete || readOnly || busy ? "opacity-60" : ""}`}>
            <Checkbox checked={isApproved || (!requiresApproval && ((subtasks.length > 0 && allSubtasksComplete) || (subtasks.length === 0 && mainComplete)))} disabled={readOnly || busy || requiresApproval || (subtasks.length > 0 && !allSubtasksComplete)} onCheckedChange={(checked) => toggleMainComplete(checked === true)} />
            <span className="flex-1 font-semibold text-card-foreground">{chore.title} — complete</span>
            {Number(chore.reward_points) > 0 ? <span className="flex items-center gap-1 text-xs font-semibold text-primary"><Trophy className="h-4 w-4" />{chore.reward_points}</span> : null}
          </label>
          {!allSubtasksComplete && !readOnly ? <p className="text-xs text-muted-foreground">Finish every step to unlock the chore checkbox.</p> : null}
          {isPendingApproval ? <p className="rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground">Submitted — waiting for parent approval.</p> : null}
          {isApproved ? <p className="rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground">Chore complete. Great work!</p> : null}
          {completion?.status === "rejected" ? <p className="rounded-xl bg-destructive/40 p-3 text-sm text-destructive" role="alert">Your parent asked for another look: {completion.rejection_reason || "Please check this chore and try again."}</p> : null}
          {completion?.parent_feedback ? <div className="rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground">
            <p className="font-semibold">A note from your parent</p>
            <div className="whitespace-pre-wrap">{completion.parent_feedback}</div>
          </div> : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">{completedIds.filter((id) => subtasks.some((task) => task.id === id)).length} of {subtasks.length} steps complete</span>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              {!readOnly ? <Button type="button" onClick={() => void submit()} disabled={busy || (requiresApproval && subtasks.length > 0 && !allSubtasksComplete)}>{busy ? "Saving…" : canSubmitAsComplete ? (requiresApproval ? "Submit for approval" : "Done") : "Save progress"}</Button> : null}
            </div>
          </div>
        </> : null}
      </DialogContent>
    </Dialog>
  )
}

export default ChoreTaskDialog
