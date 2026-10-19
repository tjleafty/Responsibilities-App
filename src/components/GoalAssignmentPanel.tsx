import { type FormEvent, useEffect, useState } from "react"
import { Plus, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { db } from "@/lib/db"
import { GOAL_FREQUENCIES, type FamilyProfile, type GoalFrequency, type GoalRecord } from "@/lib/familyTypes"
import { prepareCelebration } from "@/lib/celebration"

interface GoalAssignmentPanelProps {
  profiles: FamilyProfile[]
  goals: GoalRecord[]
  goalTotal?: number
  loading: boolean
  error: string | null
  onRefresh: () => Promise<void>
}

export function GoalAssignmentPanel({ profiles, goals, goalTotal, loading, error, onRefresh }: GoalAssignmentPanelProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [frequency, setFrequency] = useState<GoalFrequency>("weekly")
  const [targetProfileId, setTargetProfileId] = useState("")
  const [targetCount, setTargetCount] = useState("3")
  const [prize, setPrize] = useState("")
  const [saving, setSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [progressSavingId, setProgressSavingId] = useState<string | null>(null)

  useEffect(() => {
    if (targetProfileId && profiles.some((profile) => profile.id === targetProfileId)) return
    setTargetProfileId(profiles.find((profile) => profile.profile_type === "parent")?.id ?? profiles[0]?.id ?? "")
  }, [profiles, targetProfileId])

  const createGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim() || !targetProfileId || Number(targetCount) < 1) return
    setSaving(true)
    setActionError(null)
    try {
      await db.goal.create({
        title: title.trim(),
        description: description.trim(),
        frequency,
        target_profile_id: targetProfileId,
        target_count: Number(targetCount),
        progress: 0,
        is_active: true,
        prize: prize.trim(),
      })
      setTitle("")
      setDescription("")
      setTargetCount("3")
      setPrize("")
      await onRefresh()
    } catch (caught) {
      console.error("Goal creation failed:", caught)
      setActionError("We couldn't save that goal. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const addProgress = async (goal: GoalRecord) => {
    setActionError(null)
    try {
      const celebrate = prepareCelebration()
      setProgressSavingId(goal.id)
      const target = profiles.find((profile) => profile.id === goal.target_profile_id)
      const previousProgress = Math.min(Number(goal.progress), Number(goal.target_count))
      const nextProgress = Math.min(previousProgress + 1, Number(goal.target_count))
      await db.goal.update(goal.id, { progress: nextProgress })
      if (previousProgress < Number(goal.target_count) && nextProgress >= Number(goal.target_count)) {
        celebrate(`${target?.display_name ?? "Your child"} reached the goal: ${goal.title}!`)
      }
      await onRefresh()
    } catch (caught) {
      console.error("Goal progress update failed:", caught)
      setActionError("We couldn't update that goal. Please try again.")
    } finally {
      setProgressSavingId(null)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]" aria-labelledby="goals-heading" data-element-id="goal-assignment-panel">
      <form onSubmit={createGoal} className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Target className="h-5 w-5" /></span>
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">New family goal</p><h2 id="goals-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Set the next milestone</h2></div>
        </div>
        <div className="mt-5 space-y-4">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Example: Finish the morning routine" aria-label="Goal title" />
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Add a little encouragement or context" aria-label="Goal description" className="min-h-24 text-base md:text-sm" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-card-foreground">Frequency<select value={frequency} onChange={(event) => setFrequency(event.target.value as GoalFrequency)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{GOAL_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            <label className="space-y-2 text-sm font-medium text-card-foreground">Target count<Input type="number" min="1" value={targetCount} onChange={(event) => setTargetCount(event.target.value)} aria-label="Goal target count" /></label>
          </div>
          <label className="space-y-2 text-sm font-medium text-card-foreground">Prize<Input type="text" value={prize} onChange={(event) => setPrize(event.target.value)} aria-label="Goal prize" className="mt-1" /></label>
          <label className="space-y-2 text-sm font-medium text-card-foreground">Assign to<select value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.profile_type}</option>)}</select></label>
          <Button type="submit" disabled={saving || !title.trim() || !targetProfileId} className="w-full active:scale-[0.96]"><Plus className="h-4 w-4" />{saving ? "Saving goal…" : "Add goal"}</Button>
          {actionError ? <p className="text-sm text-destructive" role="alert">{actionError}</p> : null}
        </div>
      </form>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">All rhythms</p><h2 className="mt-1 font-display text-2xl font-bold text-card-foreground">Daily, weekly, monthly</h2></div><span className="tabular-nums text-sm text-muted-foreground">{goalTotal === undefined ? "Goals" : `${goalTotal} goals`}</span></div>
        {loading ? <p className="mt-8 text-sm text-muted-foreground">Loading family goals…</p> : error ? <p className="mt-8 text-sm text-destructive" role="alert">{error}</p> : goals.length === 0 ? <p className="mt-8 rounded-2xl bg-muted p-5 text-sm leading-6 text-muted-foreground">No goals yet. Create one for a parent or child and it will appear here.</p> : <div className="mt-6 space-y-3">{goals.map((goal) => { const target = profiles.find((profile) => profile.id === goal.target_profile_id); const progress = Math.min(Number(goal.progress), Number(goal.target_count)); const percent = Math.round((progress / Number(goal.target_count)) * 100); return <article key={goal.id} className="min-w-0 rounded-2xl border border-border p-4" data-element-id={`goal-card-${goal.id}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{goal.title}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{goal.frequency} · {target?.display_name ?? "Family profile"}</p>{goal.prize ? <p className="mt-1 text-sm text-primary">Prize: {goal.prize}</p> : null}</div><span className="tabular-nums shrink-0 text-sm font-semibold text-primary">{progress}/{goal.target_count}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} /></div><div className="mt-3 flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{percent}% complete</span><Button type="button" size="sm" variant="outline" onClick={() => addProgress(goal)} disabled={progress >= Number(goal.target_count) || progressSavingId === goal.id}>{progressSavingId === goal.id ? "Saving…" : "Log progress"}</Button></div></article> })}</div>}
      </div>
    </section>
  )
}
