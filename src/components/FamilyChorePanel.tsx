import { useEffect, useState, type FormEvent } from "react"
import { Check, Plus, Search, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { overskill } from "@/lib/auth"
import { GOAL_FREQUENCIES, type ChoreRecord, type FamilyProfile, type GoalFrequency } from "@/lib/familyTypes"

interface FamilyChorePanelProps {
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  activeProfile: FamilyProfile
  onRefresh: () => Promise<void>
}

const CHORE_PRESETS: Array<{ title: string; frequency: GoalFrequency }> = [
  { title: "Sweep porch", frequency: "daily" },
  { title: "Personal morning prayer", frequency: "daily" },
  { title: "Take shower/bath", frequency: "daily" },
  { title: "Unload dishwasher", frequency: "daily" },
  { title: "Get ready for bed", frequency: "daily" },
  { title: "Empty out all trashes", frequency: "daily" },
  { title: "Bring trash bins in", frequency: "weekly" },
  { title: "Help make dinner", frequency: "daily" },
  { title: "Set table for dinner", frequency: "daily" },
  { title: "Clean dining room", frequency: "daily" },
  { title: "Wash bedding", frequency: "daily" },
  { title: "Put clothes in washing machine", frequency: "daily" },
  { title: "Clean bathrooms", frequency: "weekly" },
  { title: "Clean bedroom", frequency: "daily" },
  { title: "Put clothes in dryer", frequency: "daily" },
  { title: "Take out kitchen trash", frequency: "daily" },
  { title: "Personal evening prayer", frequency: "daily" },
  { title: "Clean living room", frequency: "daily" },
  { title: "Take out recycling", frequency: "daily" },
  { title: "Take trash bins to the curb", frequency: "daily" },
  { title: "Fold clothes and put away", frequency: "daily" },
  { title: "Load dishwasher", frequency: "daily" },
  { title: "Help clean up dinner", frequency: "daily" },
  { title: "Read book", frequency: "daily" },
  { title: "Clean kitchen counters", frequency: "daily" },
  { title: "Make your bed", frequency: "daily" },
  { title: "Sweep/vacuum floors", frequency: "daily" },
]

export function FamilyChorePanel({ profiles, chores, completions, activeProfile, onRefresh }: FamilyChorePanelProps) {
  const [targetProfileId, setTargetProfileId] = useState("")
  const [frequency, setFrequency] = useState<GoalFrequency>("daily")
  const [customTitle, setCustomTitle] = useState("")
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activeProfiles = profiles.filter((profile) => profile.is_active !== false)
  const assignedToMe = chores.filter((chore) => chore.target_profile_id === activeProfile.id && chore.is_active !== false)

  useEffect(() => {
    if (targetProfileId && activeProfiles.some((profile) => profile.id === targetProfileId)) return
    setTargetProfileId(activeProfiles.find((profile) => profile.profile_type === "child")?.id ?? activeProfiles[0]?.id ?? "")
  }, [profiles, targetProfileId])

  const addChore = async (title: string, cadence: GoalFrequency) => {
    const trimmed = title.trim()
    if (!trimmed || !targetProfileId) return
    const duplicate = chores.some((chore) => chore.is_active !== false && chore.target_profile_id === targetProfileId && chore.frequency === cadence && chore.title.trim().toLocaleLowerCase() === trimmed.toLocaleLowerCase())
    if (duplicate) {
      setError("That chore is already assigned to this profile.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.chore.create({
        title: trimmed,
        frequency: cadence,
        target_profile_id: targetProfileId,
        is_active: true,
        __client_key: `${targetProfileId}:${cadence}:${trimmed.toLocaleLowerCase()}`,
      })
      if (trimmed === customTitle.trim()) setCustomTitle("")
      await onRefresh()
    } catch (caught) {
      console.error("Chore creation failed:", caught)
      setError("We couldn't add that chore. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const submitCustomChore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await addChore(customTitle, frequency)
  }

  const removeChore = async (chore: ChoreRecord) => {
    setError(null)
    try {
      await overskill.entities.chore.delete(chore.id)
      await onRefresh()
    } catch (caught) {
      console.error("Chore removal failed:", caught)
      setError("We couldn't remove that chore. Please try again.")
    }
  }

  const visiblePresets = CHORE_PRESETS.filter((preset) => preset.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()))

  if (activeProfile.profile_type !== "parent") {
    return (
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-8" aria-labelledby="child-chores-heading" data-element-id="child-chore-list">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Your checklist</p>
        <h2 id="child-chores-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Chores for {activeProfile.display_name}</h2>
        {assignedToMe.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No chores have been assigned yet. Ask a parent to add your first one.</p> : <ul className="mt-5 grid gap-3 sm:grid-cols-2">{assignedToMe.map((chore) => <li key={chore.id} className="flex min-w-0 items-center gap-3 rounded-2xl border border-border p-4"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/50 text-secondary-foreground"><Check className="h-4 w-4" /></span><span className="min-w-0"><span className="block truncate font-medium text-card-foreground">{chore.title}</span><span className="text-xs capitalize text-muted-foreground">{chore.frequency}</span></span></li>)}</ul>}
      </section>
    )
  }

  const parentChores = chores.filter((chore) => chore.is_active !== false)
  return (
    <section className="space-y-6" aria-labelledby="chore-library-heading" data-element-id="family-chore-library">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={submitCustomChore} className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" data-element-id="custom-chore-form">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Make it your own</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-card-foreground">Add a custom chore</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Create a household task that isn't in the starter list.</p>
          <div className="mt-5 space-y-4">
            <label className="block space-y-2 text-sm font-medium text-card-foreground">Chore name<Input value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} placeholder="e.g. Water the balcony plants" /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-card-foreground">Repeat<select value={frequency} onChange={(event) => setFrequency(event.target.value as GoalFrequency)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{GOAL_FREQUENCIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label className="block space-y-2 text-sm font-medium text-card-foreground">Assign to<select value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.profile_type}</option>)}</select></label>
            </div>
            <Button type="submit" disabled={saving || !customTitle.trim() || !targetProfileId} className="w-full"><Plus className="h-4 w-4" />{saving ? "Adding chore…" : "Add custom chore"}</Button>
          </div>
        </form>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Ready-made ideas</p><h2 id="chore-library-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Choose from the chore list</h2></div><span className="text-sm text-muted-foreground">{visiblePresets.length} chores</span></div>
          <label className="relative mt-4 block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a chore" aria-label="Search chore presets" className="pl-9" /></label>
          <label className="mt-3 block space-y-2 text-sm font-medium text-card-foreground">Assign presets to<select value={targetProfileId} onChange={(event) => setTargetProfileId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{activeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name} · {profile.profile_type}</option>)}</select></label>
          <div className="mt-4 max-h-[30rem] space-y-2 overflow-y-auto pr-1">{visiblePresets.map((preset) => {
            const alreadyAdded = chores.some((chore) => chore.is_active !== false && chore.target_profile_id === targetProfileId && chore.frequency === preset.frequency && chore.title.trim().toLocaleLowerCase() === preset.title.toLocaleLowerCase())
            return <div key={`${preset.frequency}-${preset.title}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border p-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-card-foreground">{preset.title}</p><p className="text-xs capitalize text-muted-foreground">{preset.frequency}</p></div><Button type="button" size="sm" variant={alreadyAdded ? "secondary" : "outline"} disabled={saving || alreadyAdded || !targetProfileId} onClick={() => void addChore(preset.title, preset.frequency)} className="shrink-0">{alreadyAdded ? <><Check className="h-4 w-4" />Added</> : <><Plus className="h-4 w-4" />Add</>}</Button></div>
          })}</div>
        </div>
      </div>

      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Household list</p><h2 className="mt-1 font-display text-2xl font-bold text-card-foreground">Assigned chores</h2></div><span className="tabular-nums text-sm text-muted-foreground">{parentChores.length} chores</span></div>
        {parentChores.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Choose a preset or add a custom chore to start your household list.</p> : <ul className="mt-5 grid gap-3 sm:grid-cols-2">{parentChores.map((chore) => { const assignee = profiles.find((profile) => profile.id === chore.target_profile_id); return <li key={chore.id} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border p-4"><div className="min-w-0"><p className="truncate font-medium text-card-foreground">{chore.title}</p><p className="mt-1 text-xs capitalize text-muted-foreground">{chore.frequency} · {assignee?.display_name ?? "Profile unavailable"}</p></div><Button type="button" size="icon" variant="ghost" aria-label={`Remove ${chore.title}`} onClick={() => void removeChore(chore)} className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash className="h-4 w-4" /></Button></li> })}</ul>}
      </div>
      {activeProfiles.length === 0 ? <p className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">Add or reactivate a family profile in Settings before assigning chores.</p> : null}
      {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
    </section>
  )
}
