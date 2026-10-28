import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, Check, CreditCard, Eye, EyeOff, Inbox, LayoutDashboard, ListChecks, Plus, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip, ChoreIconTile, EmptyState, ErrorNote, Field, inputClass, MASCOT, Segmented, Stepper } from "@/components/kit"
import {
  approveSuggestions, isAppAdmin, listAllCatalog, listSuggestions, rejectSuggestions, setCatalogActive,
  type CatalogChore, type ChoreSuggestion,
} from "@/lib/catalog"
import { makeTaskId } from "@/lib/choreUtils"
import type { ChoreSubtask, GoalFrequency } from "@/lib/familyTypes"
import { relativeTime } from "@/lib/family"
import { cn } from "@/lib/utils"
import { listFamilies, listPlans, type FamilyAccount } from "@/lib/companyAdmin"
import type { Plan } from "@/lib/billing"
import { AdminOverview } from "@/components/admin/AdminOverview"
import { AdminFamilies } from "@/components/admin/AdminFamilies"
import { AdminPlans } from "@/components/admin/AdminPlans"

const FREQUENCIES: Array<{ value: GoalFrequency; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

interface Group {
  key: string
  kind: ChoreSuggestion["kind"]
  rows: ChoreSuggestion[]
}

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ")

/** The same chore suggested by several families is reviewed once. */
function groupSuggestions(rows: ChoreSuggestion[]): Group[] {
  const groups = new Map<string, Group>()
  rows.forEach((row) => {
    const key = `${row.kind}:${norm(row.title)}`
    const group = groups.get(key) ?? { key, kind: row.kind, rows: [] }
    group.rows.push(row)
    groups.set(key, group)
  })
  return [...groups.values()].sort((a, b) => b.rows.length - a.rows.length)
}

type AdminTab = "overview" | "families" | "plans" | "chores"

export default function AdminPage() {
  const navigate = useNavigate()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [tab, setTab] = useState<AdminTab>("overview")
  const [focusId, setFocusId] = useState<string | null>(null)
  const [families, setFamilies] = useState<FamilyAccount[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadAccounts = useCallback(async () => {
    try {
      const [rows, items] = await Promise.all([listFamilies(), listPlans()])
      setFamilies(rows)
      setPlans(items)
      setError(null)
    } catch (caught) {
      console.error("Loading families failed:", caught)
      setError("We couldn't load families and plans. Has the latest database update been run?")
    }
  }, [])

  useEffect(() => {
    void isAppAdmin().then((ok) => {
      setAllowed(ok)
      if (ok) void loadAccounts()
    })
  }, [loadAccounts])

  if (allowed === null) return <main className="grid min-h-dvh place-items-center bg-background"><span className="float-soft text-6xl" aria-hidden="true">{MASCOT}</span></main>
  if (!allowed) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <EmptyState title="This page is for the app's team" action={<Button onClick={() => navigate("/dashboard")}>Back to the app</Button>}>Your login isn't on the company team.</EmptyState>
      </main>
    )
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/dashboard")} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card shadow-soft" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <div>
            <h1 className="font-display text-3xl font-semibold">Company admin</h1>
            <p className="text-muted-foreground">Every family, their subscriptions, pricing, and the starter chore list.</p>
          </div>
        </header>

        <div className="-mx-4 overflow-x-auto px-4">
          <Segmented value={tab} onChange={(next) => { setFocusId(null); setTab(next) }} options={[
            { value: "overview", label: <span className="inline-flex items-center gap-1.5"><LayoutDashboard className="hidden h-4 w-4 sm:block" />Overview</span> },
            { value: "families", label: <span className="inline-flex items-center gap-1.5"><Users className="hidden h-4 w-4 sm:block" />Families</span> },
            { value: "plans", label: <span className="inline-flex items-center gap-1.5"><CreditCard className="hidden h-4 w-4 sm:block" />Plans</span> },
            { value: "chores", label: <span className="inline-flex items-center gap-1.5"><ListChecks className="hidden h-4 w-4 sm:block" />Chore list</span> },
          ]} size="lg" />
        </div>

        <ErrorNote>{tab === "chores" ? null : error}</ErrorNote>

        {tab === "overview" ? <AdminOverview families={families} plans={plans} onOpenFamilies={(id) => { setFocusId(id); setTab("families") }} /> : null}
        {tab === "families" ? <AdminFamilies families={families} plans={plans} focusId={focusId} onChanged={loadAccounts} /> : null}
        {tab === "plans" ? <AdminPlans plans={plans} onChanged={loadAccounts} /> : null}
        {tab === "chores" ? <ChoreSuggestions /> : null}
      </div>
    </main>
  )
}

function ChoreSuggestions() {
  const [tab, setTab] = useState<"waiting" | "list">("waiting")
  const [pending, setPending] = useState<ChoreSuggestion[]>([])
  const [catalog, setCatalog] = useState<CatalogChore[]>([])
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [rows, items] = await Promise.all([listSuggestions("pending"), listAllCatalog()])
      setPending(rows)
      setCatalog(items)
      setError(null)
    } catch (caught) {
      console.error("Loading suggestions failed:", caught)
      setError("We couldn't load suggestions. Has the latest database update been run?")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const groups = useMemo(() => groupSuggestions(pending), [pending])

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground">New chores and steps parents made. Approved ones join the starter list for every family.</p>
      <Segmented value={tab} onChange={setTab} options={[
        { value: "waiting", label: <span className="inline-flex items-center gap-1.5"><Inbox className="h-4 w-4" />Waiting ({groups.length})</span> },
        { value: "list", label: <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" />Starter list ({catalog.filter((item) => item.is_active).length})</span> },
      ]} />

      <ErrorNote>{error}</ErrorNote>

      {tab === "waiting" ? (
        groups.length === 0
          ? <EmptyState emoji="🎉" title="Nothing waiting">New chores parents create will show up here.</EmptyState>
          : <ul className="space-y-4">{groups.map((group) => <li key={group.key}><SuggestionCard group={group} catalog={catalog} onDone={load} /></li>)}</ul>
      ) : (
        <ul className="space-y-2">
          {catalog.map((item) => (
            <li key={item.id} className={cn("flex items-center gap-3 rounded-[20px] bg-card p-3 shadow-soft", !item.is_active && "opacity-60")}>
              <ChoreIconTile title={item.title} size={40} className="rounded-xl" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{item.title}</span>
                <span className="block text-xs font-bold text-muted-foreground">
                  {FREQUENCIES.find((option) => option.value === item.frequency)?.label}
                  {item.subtasks.length ? ` · ${item.subtasks.length} steps` : ""}
                  {item.min_age !== null || item.max_age !== null ? ` · Ages ${item.min_age ?? "any"}-${item.max_age ?? "any"}` : ""}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => void setCatalogActive(item.id, !item.is_active).then(load)}>
                {item.is_active ? <><EyeOff className="h-4 w-4" />Hide</> : <><Eye className="h-4 w-4" />Show</>}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SuggestionCard({ group, catalog, onDone }: { group: Group; catalog: CatalogChore[]; onDone: () => Promise<void> }) {
  const first = group.rows[group.rows.length - 1]
  const existing = catalog.find((item) => norm(item.title) === norm(first.title))
  // Every distinct step any family suggested, ticked by default.
  const suggestedSteps = useMemo(() => {
    const seen = new Map<string, ChoreSubtask>()
    group.rows.forEach((row) => row.subtasks.forEach((step) => { if (!seen.has(norm(step.title))) seen.set(norm(step.title), { id: makeTaskId(), title: step.title }) }))
    return [...seen.values()]
  }, [group])
  const [title, setTitle] = useState(() => {
    const named = group.rows.find((row) => /^[A-Z]/.test(row.title.trim()))?.title ?? first.title
    return named.trim().charAt(0).toUpperCase() + named.trim().slice(1)
  })
  const [frequency, setFrequency] = useState<GoalFrequency>(first.frequency)
  const [steps, setSteps] = useState(suggestedSteps)
  const [keep, setKeep] = useState<string[]>(suggestedSteps.map((step) => step.id))
  const [ages, setAges] = useState<{ min: number; max: number } | null>(existing && existing.min_age !== null ? { min: existing.min_age, max: existing.max_age ?? 17 } : null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const ids = group.rows.map((row) => row.id)
  const families = new Set(group.rows.map((row) => row.family_id)).size

  const act = async (action: () => Promise<void>) => {
    setBusy(true)
    setProblem(null)
    try {
      await action()
      await onDone()
    } catch (caught) {
      console.error("Reviewing a suggestion failed:", caught)
      setProblem("That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const approve = () => act(() => approveSuggestions(ids, {
    title: group.kind === "steps" && existing ? existing.title : title,
    frequency: group.kind === "steps" && existing ? existing.frequency : frequency,
    subtasks: steps.filter((step) => keep.includes(step.id)),
    min_age: ages ? ages.min : existing?.min_age ?? null,
    max_age: ages ? ages.max : existing?.max_age ?? null,
  }))

  return (
    <article className="space-y-4 rounded-[24px] bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <ChoreIconTile title={title} size={48} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-primary">{group.kind === "chore" ? "New chore" : `New steps for ${existing?.title ?? first.title}`}</p>
          <p className="text-sm text-muted-foreground">Suggested by {families} {families === 1 ? "family" : "families"} · {relativeTime(first.created_at)}</p>
        </div>
      </div>

      {group.kind === "chore" ? (
        <>
          <Field label="Name on the starter list"><input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} maxLength={80} /></Field>
          <Segmented value={frequency} onChange={setFrequency} options={FREQUENCIES} />
        </>
      ) : null}

      {steps.length > 0 ? (
        <div className="space-y-2">
          <span className="block text-sm font-bold">Steps to include</span>
          {steps.map((step) => (
            <div key={step.id} className="flex items-center gap-2">
              <button type="button" onClick={() => setKeep((current) => current.includes(step.id) ? current.filter((id) => id !== step.id) : [...current, step.id])} aria-pressed={keep.includes(step.id)} aria-label={keep.includes(step.id) ? "Leave out this step" : "Include this step"}
                className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full border-2", keep.includes(step.id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {keep.includes(step.id) ? <Check className="h-4 w-4" strokeWidth={3} /> : null}
              </button>
              <input className={inputClass} value={step.title} onChange={(event) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, title: event.target.value } : item))} maxLength={80} />
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold">Ages</span>
          <Chip active={!ages} onClick={() => setAges(null)}>{existing && existing.min_age !== null ? "Keep current" : "Any age"}</Chip>
          <Chip active={!!ages} onClick={() => setAges((current) => current ?? { min: 6, max: 17 })}><Plus className="h-4 w-4" />Set a range</Chip>
        </div>
        {ages ? (
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-bold">From <Stepper value={ages.min} onChange={(min) => setAges({ min, max: Math.max(min, ages.max) })} min={2} max={17} label="youngest age" /></span>
            <span className="flex items-center gap-2 text-sm font-bold">to <Stepper value={ages.max} onChange={(max) => setAges({ min: Math.min(ages.min, max), max })} min={2} max={17} label="oldest age" /></span>
          </div>
        ) : null}
      </div>

      <Field label="Note if you reject (optional, for your records)"><input className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} /></Field>
      <ErrorNote>{problem}</ErrorNote>
      <div className="flex gap-3">
        <Button variant="ghost" disabled={busy} onClick={() => void act(() => rejectSuggestions(ids, note))} className="text-coral hover:bg-coral/10 hover:text-coral"><X className="h-5 w-5" />Reject</Button>
        <Button disabled={busy || (group.kind === "chore" && !title.trim())} onClick={() => void approve()} className="flex-1"><Check className="h-5 w-5" />{busy ? "Saving..." : <>Approve<span className="hidden sm:inline">&nbsp;and add to the list</span></>}</Button>
      </div>
    </article>
  )
}
