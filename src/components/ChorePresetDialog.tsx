import { useMemo, useState } from "react"
import { Check, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { ChoreRecord, FamilyProfile, GoalFrequency } from "@/lib/familyTypes"
import { getAssignedProfileIds } from "@/lib/choreUtils"
import { overskill } from "@/lib/auth"

const PRESETS: Array<{ title: string; frequency: GoalFrequency }> = [
  { title: "Sweep porch", frequency: "daily" }, { title: "Personal morning prayer", frequency: "daily" },
  { title: "Take shower/bath", frequency: "daily" }, { title: "Unload dishwasher", frequency: "daily" },
  { title: "Get ready for bed", frequency: "daily" }, { title: "Empty out all trashes", frequency: "daily" },
  { title: "Bring trash bins in", frequency: "weekly" }, { title: "Help make dinner", frequency: "daily" },
  { title: "Set table for dinner", frequency: "daily" }, { title: "Clean dining room", frequency: "daily" },
  { title: "Wash bedding", frequency: "weekly" }, { title: "Put clothes in washing machine", frequency: "daily" },
  { title: "Clean bathrooms", frequency: "weekly" }, { title: "Clean bedroom", frequency: "daily" },
  { title: "Put clothes in dryer", frequency: "daily" }, { title: "Take out kitchen trash", frequency: "daily" },
  { title: "Personal evening prayer", frequency: "daily" }, { title: "Clean living room", frequency: "weekly" },
  { title: "Take out recycling", frequency: "daily" }, { title: "Take trash bins to the curb", frequency: "weekly" },
  { title: "Fold clothes and put away", frequency: "weekly" }, { title: "Load dishwasher", frequency: "daily" },
  { title: "Help clean up dinner", frequency: "daily" }, { title: "Read book", frequency: "daily" },
  { title: "Clean kitchen counters", frequency: "daily" }, { title: "Make your bed", frequency: "daily" },
  { title: "Sweep/vacuum floors", frequency: "weekly" },
]

interface ChorePresetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  onRefresh: () => Promise<void>
}

export function ChorePresetDialog({ open, onOpenChange, profiles, chores, onRefresh }: ChorePresetDialogProps) {
  const [query, setQuery] = useState("")
  const [selectedPresets, setSelectedPresets] = useState<string[]>([])
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const children = profiles.filter((profile) => profile.profile_type === "child" && profile.is_active !== false)
  const visible = useMemo(() => PRESETS.filter((item) => item.title.toLowerCase().includes(query.trim().toLowerCase())), [query])
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selectedPresets.includes(`${item.frequency}:${item.title}`))

  const togglePreset = (key: string, checked: boolean) => setSelectedPresets((current) => checked ? [...new Set([...current, key])] : current.filter((item) => item !== key))
  const toggleProfile = (id: string, checked: boolean) => setSelectedProfiles((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))
  const toggleVisible = () => {
    const visibleKeys = visible.map((item) => `${item.frequency}:${item.title}`)
    setSelectedPresets((current) => allVisibleSelected ? current.filter((key) => !visibleKeys.includes(key)) : [...new Set([...current, ...visibleKeys])])
  }

  const addSelected = async () => {
    if (selectedPresets.length === 0 || selectedProfiles.length === 0) return
    setSaving(true)
    setError(null)
    const selected = PRESETS.filter((item) => selectedPresets.includes(`${item.frequency}:${item.title}`))
    const records = selected.flatMap((preset) => {
      const profileIds = selectedProfiles.filter((id) => !chores.some((chore) => chore.is_active !== false && chore.frequency === preset.frequency && chore.title.toLowerCase() === preset.title.toLowerCase() && getAssignedProfileIds(chore).includes(id)))
      if (profileIds.length === 0) return []
      return [{ title: preset.title, frequency: preset.frequency, target_profile_id: profileIds[0], assigned_profile_ids: JSON.stringify(profileIds), subtasks: JSON.stringify([]), reward: "", reward_points: 0, time_limit_minutes: null, requires_verification: false, random_assignment_enabled: false, assignment_rotation_enabled: false, assignment_change_frequency: "weekly", is_active: true, __client_key: `preset:${preset.frequency}:${preset.title.toLowerCase()}:${profileIds.slice().sort().join(",")}` }]
    })
    if (records.length === 0) {
      setError("Those chores are already on the selected profiles.")
      setSaving(false)
      return
    }
    try {
      await overskill.entities.chore.bulkCreate(records)
      await onRefresh()
      setSelectedPresets([])
      setSelectedProfiles([])
      setQuery("")
      onOpenChange(false)
    } catch (caught) {
      console.error("Preset chore batch creation failed:", caught)
      setError("We couldn't add the selected chores. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader><DialogTitle className="font-display text-2xl">Add ready-made chores</DialogTitle><DialogDescription>Choose chores and profiles together, then add them as a batch.</DialogDescription></DialogHeader>
        <div className="space-y-5">
          <fieldset className="space-y-2"><legend className="text-sm font-semibold text-card-foreground">Add to children</legend>{children.length === 0 ? <p className="text-sm text-muted-foreground">Add a child profile first.</p> : <div className="flex flex-wrap gap-2">{children.map((child) => <label key={child.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 text-sm text-card-foreground"><Checkbox checked={selectedProfiles.includes(child.id)} onCheckedChange={(checked) => toggleProfile(child.id, checked === true)} /><span>{child.display_name}</span></label>)}</div>}</fieldset>
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3"><label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search chores" aria-label="Search chore presets" className="pl-9" /></label><Button type="button" size="sm" variant="outline" onClick={toggleVisible}>{allVisibleSelected ? "Clear visible" : "Select all visible"}</Button></div>
            <div className="mt-3 grid max-h-[42vh] gap-2 overflow-y-auto sm:grid-cols-2">{visible.map((preset) => { const key = `${preset.frequency}:${preset.title}`; const selected = selectedPresets.includes(key); return <label key={key} className="flex min-w-0 items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={selected} onCheckedChange={(checked) => togglePreset(key, checked === true)} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-card-foreground">{preset.title}</span><span className="text-xs capitalize text-muted-foreground">{preset.frequency}</span></span>{selected ? <Check className="h-4 w-4 text-primary" /> : null}</label> })}</div>
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><p className="text-sm text-muted-foreground">{selectedPresets.length} chores selected for {selectedProfiles.length} profiles</p><Button type="button" onClick={() => void addSelected()} disabled={saving || selectedPresets.length === 0 || selectedProfiles.length === 0}><Plus className="h-4 w-4" />{saving ? "Adding…" : "Add selected chores"}</Button></div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
