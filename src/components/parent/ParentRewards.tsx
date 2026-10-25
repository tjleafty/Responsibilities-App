import { useEffect, useState } from "react"
import { CalendarDays, Check, Gift, PencilLine, Plus, Target, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, Chip, EmptyState, ErrorNote, Field, inputClass, ProgressBar, Segmented, Sheet, Stepper, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import type { FamilyReward } from "@/lib/familyTypes"
import type { FamilyProfile, GoalFrequency, GoalRecord } from "@/lib/familyTypes"
import { firstName, isActive, kidsOf, pointsEarned } from "@/lib/family"
import { prepareCelebration } from "@/lib/celebration"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"

type View = "prizes" | "goals"
const FREQUENCIES: Array<{ value: GoalFrequency; label: string; hint: string }> = [
  { value: "daily", label: "Daily", hint: "Every day" },
  { value: "weekly", label: "Weekly", hint: "Mon to Sun" },
  { value: "monthly", label: "Monthly", hint: "Each month" },
]

export function ParentRewards({ profiles, completions, rewards, goals, onRefresh }: ParentScreenProps) {
  const [view, setView] = useState<View>("prizes")
  const [prizeSheet, setPrizeSheet] = useState<{ reward: FamilyReward | null } | null>(null)
  const [goalSheet, setGoalSheet] = useState<{ goal: GoalRecord | null } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const kids = kidsOf(profiles)
  const liveGoals = goals.filter(isActive)

  const act = async (id: string, action: () => Promise<unknown>, failure: string) => {
    setBusyId(id)
    setError(null)
    try {
      await action()
      await onRefresh()
    } catch (caught) {
      console.error(failure, caught)
      setError(failure)
    } finally {
      setBusyId(null)
    }
  }

  const addProgress = (goal: GoalRecord) => {
    const celebrate = prepareCelebration()
    const kid = profiles.find((profile) => profile.id === goal.target_profile_id)
    const before = Math.min(Number(goal.progress), Number(goal.target_count))
    const after = Math.min(before + 1, Number(goal.target_count))
    void act(goal.id, async () => {
      await db.goal.update(goal.id, { progress: after })
      if (before < goal.target_count && after >= goal.target_count) celebrate(`${firstName(kid) || "Your kid"} reached the goal: ${goal.title}!`, { themeKey: kid?.theme_key, reward: "trophy" })
    }, "We couldn't update that goal.")
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">Rewards</h1>
          <p className="text-muted-foreground">Prizes kids save up for, and goals they work toward.</p>
        </div>
        <Button onClick={() => view === "prizes" ? setPrizeSheet({ reward: null }) : setGoalSheet({ goal: null })}><Plus className="h-5 w-5" />{view === "prizes" ? "Add prize" : "Add goal"}</Button>
      </header>

      <Segmented value={view} onChange={setView} size="lg" className="max-w-md" options={[{ value: "prizes", label: `Prizes (${rewards.filter(isActive).length})` }, { value: "goals", label: `Goals (${liveGoals.length})` }]} />
      <ErrorNote>{error}</ErrorNote>

      {view === "prizes" ? (
        rewards.length === 0 ? (
          <EmptyState emoji="🎁" title="No prizes yet" action={<Button onClick={() => setPrizeSheet({ reward: null })}><Plus className="h-5 w-5" />Add a prize</Button>}>Movie night, a trip for ice cream, extra screen time... Kids see these on their Prizes tab.</EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {rewards.map((reward) => {
              const cost = Number(reward.points_required) || 0
              const forKids = reward.target_profile_id ? kids.filter((kid) => kid.id === reward.target_profile_id) : kids
              const ready = forKids.filter((kid) => pointsEarned(kid.id, completions) >= cost)
              return (
                <li key={reward.id} className={cn("rounded-[22px] bg-card p-4 shadow-soft", !isActive(reward) && "opacity-60")}>
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-2xl" aria-hidden="true">🎁</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg font-semibold leading-tight">{reward.title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{reward.target_profile_id ? `Just for ${forKids[0]?.display_name ?? "one kid"}` : "For everyone"}</p>
                    </div>
                    <Switch checked={isActive(reward)} disabled={busyId === reward.id} onCheckedChange={(on) => void act(reward.id, () => db.family_reward.update(reward.id, { is_active: on }), "We couldn't update that prize.")} aria-label={`${reward.title} is ${isActive(reward) ? "on" : "off"}`} />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <TokenPill amount={cost} />
                    {ready.length > 0 && isActive(reward) ? <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success"><Check className="h-3.5 w-3.5" />Ready for {ready.map(firstName).join(", ")}</span> : null}
                    <button type="button" onClick={() => setPrizeSheet({ reward })} className="ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-primary hover:bg-primary/10"><PencilLine className="h-4 w-4" />Edit</button>
                  </div>
                </li>
              )
            })}
          </ul>
        )
      ) : liveGoals.length === 0 ? (
        <EmptyState emoji="🎯" title="No goals yet" action={<Button onClick={() => setGoalSheet({ goal: null })}><Plus className="h-5 w-5" />Add a goal</Button>}>Goals count up to a prize, like "Read 10 books this month".</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map((kid) => {
            const theirs = liveGoals.filter((goal) => goal.target_profile_id === kid.id)
            if (theirs.length === 0) return null
            return (
              <section key={kid.id} className="space-y-3 rounded-[22px] bg-card p-4 shadow-soft">
                <h2 className="flex items-center gap-3 font-display text-xl font-semibold"><Avatar profile={kid} size={40} />{kid.display_name}</h2>
                {theirs.map((goal) => {
                  const reached = goal.progress >= goal.target_count
                  return (
                    <article key={goal.id} className="rounded-2xl bg-muted/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => setGoalSheet({ goal })} className="min-w-0 text-left">
                          <p className="font-bold">{goal.title}</p>
                          <p className="text-xs font-bold capitalize text-muted-foreground">{goal.frequency}{goal.prize ? ` · Prize: ${goal.prize}` : ""}</p>
                        </button>
                        <span className="shrink-0 font-display font-semibold tabular-nums">{Math.min(goal.progress, goal.target_count)}/{goal.target_count}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-3">
                        <ProgressBar value={goal.progress} max={goal.target_count} className="flex-1" color={reached ? "hsl(var(--success))" : undefined} />
                        {reached
                          ? <span className="text-sm font-bold text-success">Reached!</span>
                          : <Button size="sm" variant="outline" disabled={busyId === goal.id} onClick={() => addProgress(goal)} aria-label={`Add one to ${goal.title}`}><Plus className="h-4 w-4" />1</Button>}
                      </div>
                    </article>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}

      <PrizeSheet state={prizeSheet} onClose={() => setPrizeSheet(null)} kids={kids} onRefresh={onRefresh} />
      <GoalSheet state={goalSheet} onClose={() => setGoalSheet(null)} kids={kids} onRefresh={onRefresh} />
    </div>
  )
}

function useSave(onRefresh: () => Promise<void>, onClose: () => void) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (action: () => Promise<unknown>, failure: string) => {
    setSaving(true)
    setError(null)
    try {
      await action()
      await onRefresh()
      onClose()
    } catch (caught) {
      console.error(failure, caught)
      setError(failure)
    } finally {
      setSaving(false)
    }
  }
  return { saving, error, setError, run }
}

function ForWhom({ kids, value, onChange, allowEveryone }: { kids: FamilyProfile[]; value: string; onChange: (id: string) => void; allowEveryone: boolean }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-bold">For</span>
      <div className="flex flex-wrap gap-2">
        {allowEveryone ? <Chip active={!value} onClick={() => onChange("")}>Everyone</Chip> : null}
        {kids.map((kid) => <Chip key={kid.id} active={value === kid.id} onClick={() => onChange(kid.id)}>{kid.display_name}</Chip>)}
      </div>
    </div>
  )
}

function PrizeSheet({ state, onClose, kids, onRefresh }: { state: { reward: FamilyReward | null } | null; onClose: () => void; kids: FamilyProfile[]; onRefresh: () => Promise<void> }) {
  const reward = state?.reward ?? null
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [cost, setCost] = useState(50)
  const [kidId, setKidId] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)
  const { saving, error, setError, run } = useSave(onRefresh, onClose)

  useEffect(() => {
    if (!state) return
    setTitle(reward?.title ?? "")
    setDescription(reward?.description ?? "")
    setCost(reward ? Number(reward.points_required) || 0 : 50)
    setKidId(reward?.target_profile_id ?? "")
    setConfirmDelete(false)
    setError(null)
  }, [state, reward, setError])

  const save = () => {
    if (!title.trim()) return setError("Give the prize a name.")
    const data = { title: title.trim(), description: description.trim(), points_required: cost, target_profile_id: kidId, reward_type: reward?.reward_type ?? "participation", is_active: reward ? isActive(reward) : true }
    void run(() => reward ? db.family_reward.update(reward.id, data) : db.family_reward.create(data), "We couldn't save that prize.")
  }

  return (
    <Sheet open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }} title={reward ? "Edit prize" : "New prize"} footer={
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3">
          {reward ? (confirmDelete
            ? <Button variant="ghost" disabled={saving} onClick={() => void run(() => db.family_reward.delete(reward.id), "We couldn't delete that prize.")} className="bg-coral/10 text-coral hover:bg-coral/20 hover:text-coral">Yes, delete</Button>
            : <Button variant="ghost" onClick={() => setConfirmDelete(true)} className="text-coral hover:bg-coral/10 hover:text-coral" aria-label="Delete prize"><Trash2 className="h-5 w-5" /></Button>) : null}
          <Button onClick={save} disabled={saving} className="flex-1"><Gift className="h-5 w-5" />{saving ? "Saving..." : "Save prize"}</Button>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <Field label="Prize"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Pick the family movie" maxLength={80} /></Field>
        <Field label="Details (optional)"><Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} maxLength={200} placeholder="Choose Friday's movie and the popcorn." /></Field>
        <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span><span className="block font-bold">Points needed</span><span className="block text-sm text-muted-foreground">Kids see it in their own token.</span></span>
            <Stepper value={cost} onChange={setCost} step={5} max={5000} label="points" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-muted-foreground">Quick add</span>
            {[5, 10, 25, 50].map((amount) => <Chip key={amount} onClick={() => setCost((value) => Math.min(5000, value + amount))}>+{amount}</Chip>)}
          </div>
        </div>
        <ForWhom kids={kids} value={kidId} onChange={setKidId} allowEveryone />
      </div>
    </Sheet>
  )
}

function GoalSheet({ state, onClose, kids, onRefresh }: { state: { goal: GoalRecord | null } | null; onClose: () => void; kids: FamilyProfile[]; onRefresh: () => Promise<void> }) {
  const goal = state?.goal ?? null
  const [title, setTitle] = useState("")
  const [kidId, setKidId] = useState("")
  const [frequency, setFrequency] = useState<GoalFrequency>("weekly")
  const [target, setTarget] = useState(5)
  const [prize, setPrize] = useState("")
  const { saving, error, setError, run } = useSave(onRefresh, onClose)

  useEffect(() => {
    if (!state) return
    setTitle(goal?.title ?? "")
    setKidId(goal?.target_profile_id ?? kids[0]?.id ?? "")
    setFrequency(goal?.frequency ?? "weekly")
    setTarget(goal ? Number(goal.target_count) || 1 : 5)
    setPrize(goal?.prize ?? "")
    setError(null)
  }, [state, goal, kids, setError])

  const save = () => {
    if (!title.trim()) return setError("Give the goal a name.")
    if (!kidId) return setError("Pick a kid for this goal.")
    const data = { title: title.trim(), target_profile_id: kidId, frequency, target_count: target, prize: prize.trim(), is_active: true }
    void run(() => goal ? db.goal.update(goal.id, data) : db.goal.create({ ...data, description: "", progress: 0 }), "We couldn't save that goal.")
  }

  return (
    <Sheet open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }} title={goal ? "Edit goal" : "New goal"} footer={
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3">
          {goal ? <Button variant="outline" disabled={saving} onClick={() => void run(() => db.goal.update(goal.id, { is_active: false }), "We couldn't archive that goal.")}>Archive</Button> : null}
          {goal ? <Button variant="outline" disabled={saving} onClick={() => void run(() => db.goal.update(goal.id, { progress: 0 }), "We couldn't reset that goal.")}>Reset</Button> : null}
          <Button onClick={save} disabled={saving} className="flex-1"><Target className="h-5 w-5" />{saving ? "Saving..." : "Save goal"}</Button>
        </div>
      </div>
    }>
      <div className="space-y-4">
        <Field label="Goal"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Read 10 books" maxLength={80} /></Field>
        <ForWhom kids={kids} value={kidId} onChange={setKidId} allowEveryone={false} />
        <div className="space-y-1.5">
          <span className="block text-sm font-bold">Starts over</span>
          <div className="grid grid-cols-3 gap-2">
            {FREQUENCIES.map((option) => (
              <button key={option.value} type="button" onClick={() => setFrequency(option.value)} aria-pressed={frequency === option.value}
                className={cn("flex flex-col items-center gap-0.5 rounded-2xl p-3 transition-colors", frequency === option.value ? "bg-primary text-primary-foreground shadow-soft" : "bg-muted/60 hover:bg-muted")}>
                <CalendarDays className="h-5 w-5" />
                <span className="font-display font-semibold">{option.label}</span>
                <span className="text-xs opacity-80">{option.hint}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3"><span className="font-bold">Times to reach it</span><Stepper value={target} onChange={setTarget} min={1} max={100} label="times" /></div>
        <Field label="Prize when reached (optional)"><input className={inputClass} value={prize} onChange={(event) => setPrize(event.target.value)} placeholder="Ice cream trip" maxLength={80} /></Field>
      </div>
    </Sheet>
  )
}
