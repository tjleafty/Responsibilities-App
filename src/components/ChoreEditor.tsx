import { useMemo, useState } from "react"
import { Check, Pencil, Plus, Search, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChoreFormDialog } from "@/components/ChoreFormDialog"
import { ChorePresetDialog } from "@/components/ChorePresetDialog"
import { FamilyRewardsPanel, type FamilyReward } from "@/components/FamilyRewardsPanel"
import type { ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { getAssignedProfileIds, parseChoreSubtasks } from "@/lib/choreUtils"
import { db } from "@/lib/db"

interface ChoreEditorProps {
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  rewards?: FamilyReward[]
  onRefresh: () => Promise<void>
  mode?: "current" | "create"
}

export function ChoreEditor({ profiles, chores, rewards = [], onRefresh, mode = "current" }: ChoreEditorProps) {
  const [search, setSearch] = useState("")
  const [presetOpen, setPresetOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<ChoreRecord | null>(null)
  const [error, setError] = useState<string | null>(null)
  const activeChores = chores.filter((chore) => chore.is_active !== false)
  const filtered = useMemo(() => activeChores.filter((chore) => chore.title.toLowerCase().includes(search.trim().toLowerCase())), [activeChores, search])

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (chore: ChoreRecord) => {
    setEditing(chore)
    setFormOpen(true)
  }

  const removeChore = async (chore: ChoreRecord) => {
    setError(null)
    try {
      await db.chore.delete(chore.id)
      await onRefresh()
    } catch (caught) {
      console.error("Chore deletion failed:", caught)
      setError("We couldn't remove that chore. Please try again.")
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="parent-chores-heading" data-element-id="parent-chore-controls">
      {mode === "current" ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Household checklist</p><h2 id="parent-chores-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Current chores</h2><p className="mt-1 text-sm text-muted-foreground">Review and edit active chores for each family profile.</p></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><label className="relative block min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a chore" aria-label="Search chores" className="pl-9" /></label></div>
          {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
          {filtered.length === 0 ? <p className="rounded-2xl bg-muted p-5 text-sm text-muted-foreground">No active chores yet. Open Create new chores to add one.</p> : <div className="grid gap-3 sm:grid-cols-2">{filtered.map((chore) => { const assigned = getAssignedProfileIds(chore).map((id) => profiles.find((profile) => profile.id === id)?.display_name).filter(Boolean); const subtasks = parseChoreSubtasks(chore.subtasks); return <article key={chore.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{chore.title}</h3><p className="mt-1 text-xs capitalize text-muted-foreground">{chore.frequency} · {assigned.join(", ") || "No profile assigned"}</p></div><div className="flex shrink-0 gap-2"><Button type="button" size="icon" variant="outline" onClick={() => openEdit(chore)} aria-label={`Edit ${chore.title}`}><Pencil className="h-4 w-4" /></Button><Button type="button" size="icon" variant="ghost" onClick={() => void removeChore(chore)} aria-label={`Remove ${chore.title}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash className="h-4 w-4" /></Button></div></div><p className="mt-3 text-xs text-muted-foreground">{subtasks.length} checklist {subtasks.length === 1 ? "task" : "tasks"} · {Number(chore.reward_points) || 0} points{chore.requires_verification ? " · parent approval" : ""}</p>{subtasks.length > 0 ? <ol className="mt-3 space-y-1">{subtasks.map((task, index) => <li key={task.id} className="min-w-0 break-words text-sm text-muted-foreground"><span className="font-medium text-card-foreground">Subtask {index + 1}:</span> {task.title}</li>)}</ol> : null}</article> })}</div>}
        </>
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Household checklist</p><h2 id="parent-chores-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Create new chores</h2><p className="mt-1 text-sm text-muted-foreground">Start from a ready-made chore or build a custom one.</p></div></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><Button type="button" onClick={openCreate}><Plus className="h-4 w-4" />Create custom chore</Button><Button type="button" variant="outline" onClick={() => setPresetOpen(true)}><Check className="h-4 w-4" />Add from chore list</Button></div>
          <p className="text-sm text-muted-foreground">Presets can be chosen or built from scratch. You can also add custom tasks that are not part of any preset.</p>
          {error ? <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive" role="alert">{error}</p> : null}
        </>
      )}
      <ChorePresetDialog open={presetOpen} onOpenChange={setPresetOpen} profiles={profiles} chores={chores} onRefresh={onRefresh} />
      <ChoreFormDialog open={formOpen} onOpenChange={setFormOpen} profiles={profiles} rewards={rewards} chore={editing} onRefresh={onRefresh} />
    </section>
  )
}
