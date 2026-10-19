import { useEffect, useState, type FormEvent } from "react"
import { Check, Pencil, Plus, Trash, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { db } from "@/lib/db"
import type { ChoreRecord, ChoreSubtask, FamilyProfile, GoalFrequency } from "@/lib/familyTypes"
import { GOAL_FREQUENCIES } from "@/lib/familyTypes"
import { getAssignedProfileIds, isRandomAssignmentEnabled, makeTaskId, parseChoreSubtasks } from "@/lib/choreUtils"
import type { FamilyReward } from "@/components/FamilyRewardsPanel"

interface ChoreFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profiles: FamilyProfile[]
  rewards: FamilyReward[]
  chore?: ChoreRecord | null
  onRefresh: () => Promise<void>
}

export function ChoreFormDialog({ open, onOpenChange, profiles, rewards, chore, onRefresh }: ChoreFormDialogProps) {
  const [title, setTitle] = useState("")
  const [frequency, setFrequency] = useState<GoalFrequency>("daily")
  const [assignedIds, setAssignedIds] = useState<string[]>([])
  const [reward, setReward] = useState("")
  const [rewardPoints, setRewardPoints] = useState("0")
  const [timeLimit, setTimeLimit] = useState("")
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [rewardId, setRewardId] = useState("")
  const [randomAssignmentEnabled, setRandomAssignmentEnabled] = useState(false)
  const [rotationEnabled, setRotationEnabled] = useState(false)
  const [rotationFrequency, setRotationFrequency] = useState<GoalFrequency>("weekly")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subtasks, setSubtasks] = useState<ChoreSubtask[]>([])
  const activeProfiles = profiles.filter((profile) => profile.is_active !== false)
  const selectedChild = activeProfiles.some((profile) => profile.profile_type === "child" && assignedIds.includes(profile.id))

  useEffect(() => {
    if (!open) return
    setTitle(chore?.title ?? "")
    setFrequency(chore?.frequency ?? "daily")
    setAssignedIds(chore ? getAssignedProfileIds(chore) : [])
    setSubtasks(chore ? parseChoreSubtasks(chore.subtasks) : [])
    setReward(chore?.reward ?? "")
    setRewardPoints(String(chore?.reward_points ?? 0))
    setTimeLimit(chore?.time_limit_minutes ? String(chore.time_limit_minutes) : "")
    setRequiresVerification(chore?.requires_verification === true || chore?.requires_verification === 1)
    setRewardId(chore?.reward_id ?? "")
    setRandomAssignmentEnabled(chore ? isRandomAssignmentEnabled(chore) : false)
    setRotationEnabled(chore?.assignment_rotation_enabled === true || chore?.assignment_rotation_enabled === 1)
    setRotationFrequency(chore?.assignment_change_frequency ?? "weekly")
    setError(null)
  }, [open, chore])

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || assignedIds.length === 0 || (randomAssignmentEnabled && !selectedChild)) return
    setSaving(true)
    setError(null)
    const savedSubtasks = subtasks
      .map((task) => ({ ...task, title: task.title.trim() }))
      .filter((task) => task.title.length > 0)
    const data = { title: title.trim(), frequency, target_profile_id: assignedIds[0], assigned_profile_ids: JSON.stringify(assignedIds), subtasks: JSON.stringify(savedSubtasks), reward: reward.trim(), reward_id: rewardId, reward_points: Math.max(0, Number(rewardPoints) || 0), time_limit_minutes: timeLimit ? Math.max(1, Number(timeLimit)) : null, requires_verification: requiresVerification, random_assignment_enabled: randomAssignmentEnabled, assignment_rotation_enabled: rotationEnabled, assignment_change_frequency: rotationFrequency, is_active: true }
    try {
      if (chore) await db.chore.update(chore.id, data)
      else await db.chore.create(data)
      await onRefresh()
      onOpenChange(false)
    } catch (caught) {
      console.error("Chore save failed:", caught)
      setError("We couldn't save that chore. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleAssignee = (id: string, checked: boolean) => setAssignedIds((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))

  const addSubtask = () => setSubtasks((current) => [...current, { id: makeTaskId(), title: "" }])
  const updateSubtask = (id: string, title: string) => setSubtasks((current) => current.map((task) => task.id === id ? { ...task, title } : task))
  const removeSubtask = (id: string) => setSubtasks((current) => current.filter((task) => task.id !== id))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">{chore ? "Edit chore" : "Create a custom chore"}</DialogTitle><DialogDescription>Set the checklist and assign this chore to one or more children.</DialogDescription></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <label className="block space-y-2 text-sm font-medium text-card-foreground">Chore name<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Put away the clean dishes" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium text-card-foreground">Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value as GoalFrequency)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{GOAL_FREQUENCIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="block space-y-2 text-sm font-medium text-card-foreground">Reward points<Input type="number" min="0" value={rewardPoints} onChange={(event) => setRewardPoints(event.target.value)} /></label></div>
          <fieldset className="space-y-2"><legend className="text-sm font-medium text-card-foreground">Assign to children</legend><div className="grid gap-2 sm:grid-cols-2">{activeProfiles.filter((profile) => profile.profile_type === "child").map((profile) => <label key={profile.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm text-card-foreground"><Checkbox checked={assignedIds.includes(profile.id)} onCheckedChange={(checked) => toggleAssignee(profile.id, checked === true)} /><span className="truncate">{profile.display_name}</span></label>)}</div></fieldset>
          <fieldset className="space-y-3 rounded-2xl border border-border p-4" aria-label="Checklist tasks">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-card-foreground">Checklist tasks</p>
                <p className="mt-1 text-xs text-muted-foreground">Add each step in the order your child should do it.</p>
              </div>
              <Button type="button" variant="outline" onClick={addSubtask}>
                <Plus className="h-4 w-4" />Add task
              </Button>
            </div>
            {subtasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No checklist tasks yet. Add a task if this chore needs steps.</p>
            ) : (
              <ol className="space-y-2">
                {subtasks.map((task, index) => (
                  <li key={task.id} className="flex min-w-0 items-end gap-2">
                    <label htmlFor={`chore-subtask-${task.id}`} className="min-w-0 flex-1 space-y-1 text-sm font-medium text-card-foreground">
                      <span>Subtask {index + 1}</span>
                      <Input id={`chore-subtask-${task.id}`} value={task.title} onChange={(event) => updateSubtask(task.id, event.target.value)} placeholder={`Describe task ${index + 1}`} />
                    </label>
                    <Button type="button" size="icon" variant="outline" onClick={() => removeSubtask(task.id)} aria-label={`Remove subtask ${index + 1}`}>
                      <Trash className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block space-y-2 text-sm font-medium text-card-foreground">Reward description<Input value={reward} onChange={(event) => setReward(event.target.value)} placeholder="Choose a family movie" /></label><label className="block space-y-2 text-sm font-medium text-card-foreground">Link a reward<select value={rewardId} onChange={(event) => setRewardId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="">No linked reward</option>{rewards.filter((item) => item.is_active !== false).map((item) => <option key={item.id} value={item.id}>{item.title} · {item.reward_type}</option>)}</select></label></div>
          <label className="block space-y-2 text-sm font-medium text-card-foreground">Time limit in minutes (optional)<Input type="number" min="1" value={timeLimit} onChange={(event) => setTimeLimit(event.target.value)} placeholder="No time limit" /></label>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm text-card-foreground"><Checkbox checked={requiresVerification} onCheckedChange={(checked) => setRequiresVerification(checked === true)} /><span><span className="block font-medium">Parent verification required</span><span className="mt-1 block text-xs text-muted-foreground">Finished chores wait for a parent to approve them.</span></span></label>
          <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm text-card-foreground"><Checkbox checked={randomAssignmentEnabled} onCheckedChange={(checked) => setRandomAssignmentEnabled(checked === true)} /><span><span className="block font-medium">Randomly assign to one child</span><span className="mt-1 block text-xs text-muted-foreground">Only the eligible children above are included.</span></span></label>
          {randomAssignmentEnabled ? <div className="space-y-3 rounded-xl border border-border p-3"><label className="flex items-start gap-3 text-sm text-card-foreground"><Checkbox checked={rotationEnabled} onCheckedChange={(checked) => setRotationEnabled(checked === true)} /><span><span className="block font-medium">Rotate the assigned child</span><span className="mt-1 block text-xs text-muted-foreground">Turn this off to keep the selected child assigned.</span></span></label>{rotationEnabled ? <label className="block space-y-1 text-sm font-medium text-card-foreground">Rotate<select value={rotationFrequency} onChange={(event) => setRotationFrequency(event.target.value as GoalFrequency)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground md:text-sm"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label> : null}</div> : null}
          {randomAssignmentEnabled && !selectedChild ? <p className="text-sm text-destructive" role="alert">Choose at least one child for random assignment.</p> : null}
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}><X className="h-4 w-4" />Cancel</Button><Button type="submit" disabled={saving || !title.trim() || assignedIds.length === 0 || (randomAssignmentEnabled && !selectedChild)}>{chore ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{saving ? "Saving…" : chore ? "Save changes" : "Create chore"}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
