import { useEffect, useState, type ReactNode } from "react"
import { Check, Pause, Play, Plus, ShieldCheck, Timer, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, Chip, ChoreIconTile, ErrorNote, Field, inputClass, Segmented, Sheet, Stepper, TokenPill } from "@/components/kit"
import type { FamilyReward } from "@/lib/familyTypes"
import type { ChoreRecord, ChoreSubtask, FamilyProfile, GoalFrequency } from "@/lib/familyTypes"
import { getAssignedProfileIds, isRandomAssignmentEnabled, makeTaskId, parseChoreSubtasks } from "@/lib/choreUtils"
import { isActive, kidsOf, grownUpsOf, requiresApproval } from "@/lib/family"
import { choreVideo } from "@/lib/choreIcons"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"

const FREQUENCIES: Array<{ value: GoalFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]
const TIME_LIMITS = [0, 5, 10, 15, 30, 60]

export interface ChoreDraftSeed {
  title?: string
  frequency?: GoalFrequency
}

interface ChoreEditorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  chore: ChoreRecord | null
  seed?: ChoreDraftSeed | null
  profiles: FamilyProfile[]
  rewards: FamilyReward[]
  onRefresh: () => Promise<void>
}

export function ChoreEditorSheet({ open, onOpenChange, chore, seed, profiles, rewards, onRefresh }: ChoreEditorSheetProps) {
  const [title, setTitle] = useState("")
  const [frequency, setFrequency] = useState<GoalFrequency>("daily")
  const [assigned, setAssigned] = useState<string[]>([])
  const [takeTurns, setTakeTurns] = useState(false)
  const [turnEvery, setTurnEvery] = useState<GoalFrequency>("weekly")
  const [steps, setSteps] = useState<ChoreSubtask[]>([])
  const [points, setPoints] = useState(5)
  const [rewardId, setRewardId] = useState("")
  const [approval, setApproval] = useState(false)
  const [timeLimit, setTimeLimit] = useState(0)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const people = [...kidsOf(profiles), ...grownUpsOf(profiles)]

  useEffect(() => {
    if (!open) return
    setTitle(chore?.title ?? seed?.title ?? "")
    setFrequency(chore?.frequency ?? seed?.frequency ?? "daily")
    setAssigned(chore ? getAssignedProfileIds(chore) : [])
    setTakeTurns(chore ? isRandomAssignmentEnabled(chore) : false)
    setTurnEvery(chore?.assignment_change_frequency ?? "weekly")
    setSteps(chore ? parseChoreSubtasks(chore.subtasks) : [])
    setPoints(chore ? Number(chore.reward_points) || 0 : 5)
    setRewardId(chore?.reward_id ?? "")
    setApproval(chore ? requiresApproval(chore) : false)
    setTimeLimit(Number(chore?.time_limit_minutes) || 0)
    setConfirmDelete(false)
    setError(null)
  }, [open, chore, seed])

  const kidsPicked = assigned.filter((id) => kidsOf(profiles).some((kid) => kid.id === id))
  const cleanSteps = steps.map((step) => ({ ...step, title: step.title.trim() })).filter((step) => step.title)
  const canSave = title.trim().length > 0 && assigned.length > 0 && (!takeTurns || kidsPicked.length > 0)

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setSaving(true)
    setError(null)
    try {
      await action()
      await onRefresh()
      onOpenChange(false)
    } catch (caught) {
      console.error(failure, caught)
      setError(failure)
    } finally {
      setSaving(false)
    }
  }

  const save = () => {
    if (!canSave) {
      setError(!title.trim() ? "Give the chore a name." : "Pick who does this chore.")
      return
    }
    const reward = rewards.find((item) => item.id === rewardId)
    const data = {
      title: title.trim(),
      frequency,
      target_profile_id: assigned[0],
      assigned_profile_ids: JSON.stringify(assigned),
      subtasks: JSON.stringify(cleanSteps),
      reward: reward?.title ?? "",
      reward_id: rewardId,
      reward_points: Math.max(0, points),
      time_limit_minutes: timeLimit || null,
      requires_verification: approval,
      random_assignment_enabled: takeTurns,
      assignment_rotation_enabled: takeTurns,
      assignment_change_frequency: turnEvery,
      is_active: chore ? isActive(chore) : true,
    }
    void run(() => chore ? db.chore.update(chore.id, data) : db.chore.create(data), "We couldn't save that chore. Please try again.")
  }

  const togglePerson = (id: string) => setAssigned((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  const video = choreVideo(title)

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={chore ? "Edit chore" : "New chore"}
      footer={
        <div className="space-y-3">
          <ErrorNote>{error}</ErrorNote>
          <div className="flex flex-wrap gap-3">
            {chore ? (
              confirmDelete ? (
                <Button variant="ghost" disabled={saving} onClick={() => void run(() => db.chore.delete(chore.id), "We couldn't delete that chore.")} className="bg-coral/10 text-coral hover:bg-coral/20 hover:text-coral"><Trash2 className="h-5 w-5" />Yes, delete</Button>
              ) : (
                <>
                  <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-coral hover:bg-coral/10 hover:text-coral" aria-label="Delete chore"><Trash2 className="h-5 w-5" /><span className="hidden sm:inline">Delete</span></Button>
                  <Button variant="outline" disabled={saving} onClick={() => void run(() => db.chore.update(chore.id, { is_active: !isActive(chore) }), "We couldn't update that chore.")}>
                    {isActive(chore) ? <><Pause className="h-5 w-5" />Pause</> : <><Play className="h-5 w-5" />Resume</>}
                  </Button>
                </>
              )
            ) : null}
            <Button onClick={save} disabled={saving} className="min-w-40 flex-1"><Check className="h-5 w-5" />{saving ? "Saving..." : "Save chore"}</Button>
          </div>
        </div>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <Section number={1} title="Basics">
            <Field label="Chore name">
              <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Put away clean dishes" maxLength={80} autoFocus={!chore} />
            </Field>
            <div className="space-y-1.5">
              <span className="block text-sm font-bold">How often</span>
              <Segmented value={frequency} onChange={setFrequency} options={FREQUENCIES} />
            </div>
          </Section>

          <Section number={2} title="Who does it">
            {people.length === 0 ? <p className="text-sm text-muted-foreground">Add a kid in Family first.</p> : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {people.map((person) => {
                  const picked = assigned.includes(person.id)
                  return (
                    <button key={person.id} type="button" onClick={() => togglePerson(person.id)} aria-pressed={picked}
                      className={cn("relative flex flex-col items-center gap-1.5 rounded-2xl p-3 transition-colors", picked ? "bg-primary/10 ring-2 ring-primary" : "bg-muted/60 opacity-70 hover:opacity-100")}>
                      <Avatar profile={person} size={48} />
                      <span className="truncate text-sm font-bold">{person.display_name}</span>
                      {picked ? <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" strokeWidth={3} /></span> : null}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="rounded-2xl bg-muted/60 p-4">
              <label className="flex items-center justify-between gap-3">
                <span><span className="block font-bold">Take turns</span><span className="block text-sm text-muted-foreground">One kid at a time, rotating between the kids you picked.</span></span>
                <Switch checked={takeTurns} onCheckedChange={setTakeTurns} />
              </label>
              {takeTurns ? (
                <div className="mt-3 space-y-1.5">
                  <span className="block text-sm font-bold">Change who's up</span>
                  <Segmented value={turnEvery} onChange={setTurnEvery} options={FREQUENCIES} />
                  {kidsPicked.length === 0 ? <p className="text-sm font-semibold text-coral">Pick at least one kid to take turns.</p> : null}
                </div>
              ) : null}
            </div>
          </Section>

          <Section number={3} title="Steps" aside={steps.length ? `${steps.length} total` : undefined}>
            <p className="text-sm text-muted-foreground">Short steps in the order your kid should do them. Kids check each one off.</p>
            <ol className="space-y-2">
              {steps.map((step, index) => (
                <li key={step.id} className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-extrabold text-primary">{index + 1}</span>
                  <input className={inputClass} value={step.title} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, title: event.target.value } : item))} placeholder="Describe this step" aria-label={`Step ${index + 1}`} maxLength={80} />
                  <button type="button" onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id))} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-coral" aria-label={`Remove step ${index + 1}`}><X className="h-5 w-5" /></button>
                </li>
              ))}
            </ol>
            <Button variant="outline" onClick={() => setSteps((current) => [...current, { id: makeTaskId(), title: "" }])} className="w-full border-2 border-dashed border-border shadow-none"><Plus className="h-5 w-5" />Add a step</Button>
          </Section>

          <Section number={4} title="Reward">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span><span className="block font-bold">Points earned</span><span className="block text-sm text-muted-foreground">Shown in each kid's theme (stars, shells, coins...)</span></span>
              <Stepper value={points} onChange={setPoints} max={500} label="points" />
            </div>
            {rewards.length > 0 ? (
              <Field label="Linked prize (optional)">
                <select className={inputClass} value={rewardId} onChange={(event) => setRewardId(event.target.value)}>
                  <option value="">None</option>
                  {rewards.filter((reward) => isActive(reward) || reward.id === rewardId).map((reward) => <option key={reward.id} value={reward.id}>{reward.title}</option>)}
                </select>
              </Field>
            ) : null}
          </Section>

          <Section number={5} title="Rules">
            <label className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 p-4">
              <span><span className="flex items-center gap-1.5 font-bold"><ShieldCheck className="h-4 w-4 text-primary" />Needs my approval</span><span className="block text-sm text-muted-foreground">Finished chores wait for you before points count.</span></span>
              <Switch checked={approval} onCheckedChange={setApproval} />
            </label>
            <div className="space-y-1.5">
              <span className="flex items-center gap-1.5 text-sm font-bold"><Timer className="h-4 w-4" />Time limit</span>
              <div className="flex flex-wrap gap-2">
                {TIME_LIMITS.map((minutes) => <Chip key={minutes} active={timeLimit === minutes} onClick={() => setTimeLimit(minutes)}>{minutes ? `${minutes} min` : "No limit"}</Chip>)}
              </div>
            </div>
          </Section>
        </div>

        <aside className="order-first lg:order-none">
          <div className="lg:sticky lg:top-0">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">How kids see it</p>
            <div className="rounded-[22px] bg-card p-4 shadow-soft">
              <div className="flex items-center gap-3">
                <ChoreIconTile title={title || "Chore"} size={52} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{title || "New chore"}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                    {cleanSteps.length ? <span>{cleanSteps.length} steps</span> : null}
                    {points ? <TokenPill amount={points} prefix="+" className="px-2 py-0.5 text-xs" /> : null}
                  </p>
                </div>
                <span className="h-11 w-11 shrink-0 rounded-full border-4 border-muted" aria-hidden="true" />
              </div>
              {video ? <img src={video.poster} alt="" className="mt-3 hidden aspect-video w-full rounded-2xl object-cover lg:block" /> : null}
              {cleanSteps.length ? (
                <ol className="mt-3 hidden space-y-1.5 lg:block">
                  {cleanSteps.map((step, index) => <li key={step.id} className="flex items-center gap-2 rounded-xl bg-muted/60 px-3 py-2 text-sm font-semibold"><span className="text-muted-foreground">{index + 1}</span>{step.title}</li>)}
                </ol>
              ) : null}
            </div>
            <p className="mt-2 hidden text-xs text-muted-foreground lg:block">{video ? "A how-to video plays with this chore." : "How-to videos are coming for more chores."}</p>
          </div>
        </aside>
      </div>
    </Sheet>
  )
}

function Section({ number, title, aside, children }: { number: number; title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[22px] bg-card p-4 shadow-soft sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-sm text-primary">{number}</span>{title}
        {aside ? <span className="ml-auto text-sm font-bold text-muted-foreground">{aside}</span> : null}
      </h3>
      {children}
    </section>
  )
}
