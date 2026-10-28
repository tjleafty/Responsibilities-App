import { useEffect, useState, type ReactNode } from "react"
import { Check, Pause, Play, Plus, ShieldCheck, Timer, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Avatar, Chip, ChoreIconTile, ErrorNote, Field, inputClass, Segmented, Sheet, Stepper, TokenPill } from "@/components/kit"
import type { FamilyReward } from "@/lib/familyTypes"
import type { ChoreRecord, ChoreSubtask, FamilyProfile, GoalFrequency, RandomMode } from "@/lib/familyTypes"
import { getAssignedProfileIds, isRandomAssignmentEnabled, makeTaskId, parseChoreSubtasks, randomModeOf } from "@/lib/choreUtils"
import { isActive, kidsOf, grownUpsOf, requiresApproval } from "@/lib/family"
import { choreVideo } from "@/lib/choreIcons"
import { baseSchedule, kidSchedules, serializeSchedule, startOfWeek, isoDate, isOnWeek, WEEKDAYS, type ChoreSchedule } from "@/lib/choreSchedule"
import { db } from "@/lib/db"
import { suggestFromChore } from "@/lib/catalog"
import { familySettings } from "@/lib/familySettings"
import { cn } from "@/lib/utils"

const FREQUENCIES: Array<{ value: GoalFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]
const RANDOM_MODES: Array<{ value: RandomMode; label: string }> = [
  { value: "chore", label: "Chore only" },
  { value: "chore_and_subtasks", label: "Chore and subtasks" },
  { value: "subtasks", label: "Subtasks only" },
]
const RANDOM_MODE_HINT: Record<RandomMode, string> = {
  chore: "One kid at a time does the whole chore.",
  chore_and_subtasks: "A random group of kids is picked, and the steps are split between them.",
  subtasks: "Every kid you picked does the chore, and the steps are split between them.",
}
const TIME_LIMITS = [0, 5, 10, 15, 30, 60]

export interface ChoreDraftSeed {
  title?: string
  frequency?: GoalFrequency
  steps?: ChoreSubtask[]
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
  const [schedule, setSchedule] = useState<ChoreSchedule>(DEFAULT_SCHEDULE)
  const [perKid, setPerKid] = useState<Record<string, ChoreSchedule> | null>(null)
  const [assigned, setAssigned] = useState<string[]>([])
  const [takeTurns, setTakeTurns] = useState(false)
  const [turnEvery, setTurnEvery] = useState<GoalFrequency>("weekly")
  const [randomMode, setRandomMode] = useState<RandomMode>("chore")
  const [groupSize, setGroupSize] = useState(2)
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
    setSchedule(chore ? baseSchedule(chore) : { ...DEFAULT_SCHEDULE, frequency: seed?.frequency ?? "daily" })
    const own = chore ? kidSchedules(chore) : {}
    setPerKid(Object.keys(own).length > 0 ? own : null)
    setAssigned(chore ? getAssignedProfileIds(chore) : [])
    setTakeTurns(chore ? isRandomAssignmentEnabled(chore) : false)
    setTurnEvery(chore?.assignment_change_frequency ?? "weekly")
    setRandomMode(chore ? randomModeOf(chore) : "chore")
    setGroupSize(Number(chore?.random_group_size) || 2)
    setSteps(chore ? parseChoreSubtasks(chore.subtasks) : seed?.steps?.map((step) => ({ ...step, id: makeTaskId() })) ?? [])
    setPoints(chore ? Number(chore.reward_points) || 0 : familySettings().points.defaultPoints)
    setRewardId(chore?.reward_id ?? "")
    setApproval(chore ? requiresApproval(chore) : false)
    setTimeLimit(Number(chore?.time_limit_minutes) || 0)
    setConfirmDelete(false)
    setError(null)
  }, [open, chore, seed])

  const kidsPicked = assigned.filter((id) => kidsOf(profiles).some((kid) => kid.id === id))
  const cleanSteps = steps.map((step) => ({ ...step, title: step.title.trim() })).filter((step) => step.title)
  const kidsForSchedules = kidsPicked.length > 1 && !takeTurns ? kidsPicked : []
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
    const ownSchedules = perKid && kidsForSchedules.length > 0
      ? Object.fromEntries(kidsForSchedules.map((id) => [id, perKid[id] ?? schedule]))
      : null
    const scheduleJson = serializeSchedule(schedule, ownSchedules)
    const data = {
      title: title.trim(),
      frequency: schedule.frequency,
      // Only sent when used, so plain chores still save on a database without the schedule column.
      ...(scheduleJson || chore?.schedule ? { schedule: scheduleJson } : {}),
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
      // Only sent when used, so chores still save on a database without these columns.
      ...(takeTurns && randomMode !== "chore" ? { random_mode: randomMode, random_group_size: randomMode === "chore_and_subtasks" ? Math.min(groupSize, kidsPicked.length) : null } : {}),
      ...(chore?.random_mode && (!takeTurns || randomMode === "chore") ? { random_mode: "chore", random_group_size: null } : {}),
      is_active: chore ? isActive(chore) : true,
    }
    void run(async () => {
      await (chore ? db.chore.update(chore.id, data) : db.chore.create(data))
      // New chores and steps go to the app's team to consider for the starter list.
      void suggestFromChore({ title: data.title, frequency: schedule.frequency, steps: cleanSteps })
    }, "We couldn't save that chore. Please try again.")
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
            <ScheduleFields value={schedule} onChange={setSchedule} />
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
            {kidsForSchedules.length > 0 ? (
              <div className="rounded-2xl bg-muted/60 p-4">
                <label className="flex items-center justify-between gap-3">
                  <span><span className="block font-bold">Different schedule for each kid</span><span className="block text-sm text-muted-foreground">For example, one kid daily and another every Tuesday.</span></span>
                  <Switch checked={!!perKid} onCheckedChange={(on) => setPerKid(on ? Object.fromEntries(kidsForSchedules.map((id) => [id, schedule])) : null)} />
                </label>
                {perKid ? (
                  <ul className="mt-3 space-y-3">
                    {kidsForSchedules.map((id) => {
                      const kid = profiles.find((item) => item.id === id)
                      if (!kid) return null
                      return (
                        <li key={id} className="space-y-2 rounded-2xl bg-card p-3">
                          <span className="flex items-center gap-2 font-bold"><Avatar profile={kid} size={32} />{kid.display_name}</span>
                          <ScheduleFields value={perKid[id] ?? schedule} onChange={(next) => setPerKid((current) => ({ ...(current ?? {}), [id]: next }))} />
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-2xl bg-muted/60 p-4">
              <label className="flex items-center justify-between gap-3">
                <span><span className="block font-bold">Randomly assign</span><span className="block text-sm text-muted-foreground">Pick kids at random from the ones you chose, and change who's up over time.</span></span>
                <Switch checked={takeTurns} onCheckedChange={setTakeTurns} />
              </label>
              {takeTurns ? (
                <div className="mt-3 space-y-3">
                  <div className="space-y-1.5">
                    <span className="block text-sm font-bold">What's random</span>
                    <Segmented value={randomMode} onChange={setRandomMode} options={RANDOM_MODES} />
                    <p className="text-xs text-muted-foreground">{RANDOM_MODE_HINT[randomMode]}</p>
                  </div>
                  {randomMode === "chore_and_subtasks" ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-sm font-bold">Kids each time</span>
                      <Stepper value={Math.min(groupSize, Math.max(kidsPicked.length, 1))} onChange={setGroupSize} min={1} max={Math.max(kidsPicked.length, 1)} label="kids" />
                    </div>
                  ) : null}
                  {randomMode !== "chore" && cleanSteps.length < 2 ? <p className="text-sm font-semibold text-coral">Add at least two steps so they can be split.</p> : null}
                  <div className="space-y-1.5">
                    <span className="block text-sm font-bold">Change who's up</span>
                    <Segmented value={turnEvery} onChange={setTurnEvery} options={FREQUENCIES} />
                  </div>
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

const DEFAULT_SCHEDULE: ChoreSchedule = { frequency: "daily", weekday: null, every: 1, anchor: null }

/** How often a chore repeats; weekly chores can have a due day and repeat every week or every other week. */
function ScheduleFields({ value, onChange }: { value: ChoreSchedule; onChange: (next: ChoreSchedule) => void }) {
  const thisWeek = isoDate(startOfWeek(new Date()))
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  const startsThisWeek = isOnWeek({ ...value, anchor: value.anchor ?? thisWeek }, new Date())
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <span className="block text-sm font-bold">How often</span>
        <Segmented value={value.frequency} onChange={(frequency) => onChange({ ...value, frequency })} options={FREQUENCIES} />
      </div>
      {value.frequency === "weekly" ? (
        <>
          <div className="space-y-1.5">
            <span className="block text-sm font-bold">Due day</span>
            <div className="flex flex-wrap gap-2">
              <Chip active={value.weekday === null} onClick={() => onChange({ ...value, weekday: null })}>Any day</Chip>
              {WEEKDAYS.map((day) => <Chip key={day.value} active={value.weekday === day.value} onClick={() => onChange({ ...value, weekday: day.value })}>{day.short}</Chip>)}
            </div>
            <p className="text-xs text-muted-foreground">{value.weekday === null ? "Kids can do it any day that week." : "Shows up on that day. If it's not done, it stays on the list as late until the week ends."}</p>
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-bold">Repeats</span>
            <Segmented value={String(value.every)} onChange={(every) => onChange({ ...value, every: every === "2" ? 2 : 1, anchor: every === "2" ? value.anchor ?? thisWeek : null })} options={[{ value: "1", label: "Every week" }, { value: "2", label: "Every other week" }]} />
          </div>
          {value.every === 2 ? (
            <div className="space-y-1.5">
              <span className="block text-sm font-bold">Starting</span>
              <div className="flex flex-wrap gap-2">
                <Chip active={startsThisWeek} onClick={() => onChange({ ...value, anchor: thisWeek })}>This week</Chip>
                <Chip active={!startsThisWeek} onClick={() => onChange({ ...value, anchor: isoDate(startOfWeek(nextWeek)) })}>Next week</Chip>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
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
