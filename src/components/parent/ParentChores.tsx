import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ChevronDown, ChevronRight, LayoutGrid, Lightbulb, List, PencilLine, Plus, Repeat, Search, ShieldCheck, Timer, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, Chip, ChoreIconTile, EmptyState, ErrorNote, Segmented, Sheet, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { ChoreEditorSheet, type ChoreDraftSeed } from "@/components/parent/ChoreEditorSheet"
import type { ChoreRecord, FamilyProfile, GoalFrequency } from "@/lib/familyTypes"
import { assigneesOf, isActive, kidsOf, requiresApproval } from "@/lib/family"
import { getAssignedProfileIds, isRandomAssignmentEnabled, makeTaskId } from "@/lib/choreUtils"
import { fitsAge, loadCatalog, type CatalogChore } from "@/lib/catalog"
import { ageFromBirthYear, useFamilySettings } from "@/lib/familySettings"
import { choreScheduleLabel } from "@/lib/choreSchedule"
import { choreVideo } from "@/lib/choreIcons"
import { db } from "@/lib/db"
import { chorePoints, DIFFICULTIES, difficultyOf } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

type View = "chore" | "kid"
type Layout = "tiles" | "list"
const LAYOUT_KEY = "responsibilities.choreLayout"

function savedLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "tiles"
  } catch {
    return "tiles"
  }
}

const byTitle = (a: ChoreRecord, b: ChoreRecord) => a.title.localeCompare(b.title, undefined, { sensitivity: "base", numeric: true })
type FrequencyFilter = "all" | GoalFrequency
const FREQUENCY_LABEL: Record<GoalFrequency, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }

export function ParentChores(props: ParentScreenProps & { openNew: number }) {
  const { profiles, chores, rewards, onRefresh, openNew } = props
  const [view, setView] = useState<View>("chore")
  const [layout, setLayoutState] = useState<Layout>(savedLayout)
  const setLayout = (next: Layout) => {
    setLayoutState(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {
      // Storage can be blocked; the choice just won't be remembered.
    }
  }
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FrequencyFilter>("all")
  const [showPaused, setShowPaused] = useState(false)
  const [editing, setEditing] = useState<ChoreRecord | null>(null)
  const [seed, setSeed] = useState<ChoreDraftSeed | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [chooserOpen, setChooserOpen] = useState(false)
  const [ideasOpen, setIdeasOpen] = useState(false)

  useEffect(() => { if (openNew > 0) setChooserOpen(true) }, [openNew])

  const active = chores.filter(isActive)
  const paused = chores.filter((chore) => !isActive(chore))
  const matches = (chore: ChoreRecord) => (filter === "all" || chore.frequency === filter) && chore.title.toLowerCase().includes(query.trim().toLowerCase())
  const shown = active.filter(matches).sort(byTitle)
  const kids = kidsOf(profiles)

  const edit = (chore: ChoreRecord) => { setEditing(chore); setSeed(null); setEditorOpen(true) }
  const create = (draft: ChoreDraftSeed | null = null) => { setEditing(null); setSeed(draft); setChooserOpen(false); setIdeasOpen(false); setEditorOpen(true) }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 font-display text-3xl font-semibold sm:text-4xl">Chores <span className="rounded-full bg-primary/10 px-3 py-1 text-base text-primary">{active.length} active</span></h1>
          <p className="text-muted-foreground">Tap a chore to edit it.</p>
        </div>
        <Button onClick={() => setChooserOpen(true)}><Plus className="h-5 w-5" />Add chore</Button>
      </header>

      <Segmented value={view} onChange={setView} size="lg" options={[{ value: "chore", label: `By chore (${active.length})` }, { value: "kid", label: `By kid (${kids.length})` }]} className="max-w-md" />

      {view === "chore" ? (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <span className="sr-only">Find a chore</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a chore..." className="flex min-h-12 w-full rounded-full bg-card pl-12 pr-4 shadow-soft outline-none focus:ring-2 focus:ring-ring" />
            </label>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
              {(["all", "daily", "weekly", "monthly"] as FrequencyFilter[]).map((value) => (
                <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
                  {value === "all" ? "All" : FREQUENCY_LABEL[value]} <span className="opacity-70">{value === "all" ? active.length : active.filter((chore) => chore.frequency === value).length}</span>
                </Chip>
              ))}
            </div>
            <LayoutToggle value={layout} onChange={setLayout} />
          </div>

          {active.length === 0 ? (
            <EmptyState title="No chores yet" action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={() => setIdeasOpen(true)}><Lightbulb className="h-5 w-5" />Pick from ideas</Button>
                <Button variant="outline" onClick={() => create()}><PencilLine className="h-5 w-5" />Create my own</Button>
              </div>
            }>
              Start your family's routine. Most families start with two easy morning chores, like making the bed and brushing teeth.
            </EmptyState>
          ) : shown.length === 0 ? (
            <p className="rounded-[22px] bg-card p-6 text-center text-muted-foreground shadow-soft">No chores match that search.</p>
          ) : layout === "list" ? (
            <ChoreList chores={shown} profiles={profiles} onOpen={edit} />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {shown.map((chore) => <li key={chore.id}><ChoreRow chore={chore} profiles={profiles} onOpen={() => edit(chore)} /></li>)}
            </ul>
          )}
        </>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kids.map((kid) => {
            const theirs = active.filter((chore) => getAssignedProfileIds(chore).includes(kid.id))
            return (
              <section key={kid.id} className="rounded-[22px] bg-card p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <Avatar profile={kid} size={44} />
                  <h2 className="flex-1 font-display text-xl font-semibold">{kid.display_name}</h2>
                  <span className="text-sm font-bold text-muted-foreground">{theirs.length} chores</span>
                </div>
                <ul className="mt-3 space-y-2">
                  {theirs.length === 0 ? <li className="text-sm text-muted-foreground">No chores yet.</li> : theirs.map((chore) => (
                    <li key={chore.id}>
                      <button type="button" onClick={() => edit(chore)} className="flex w-full items-center gap-3 rounded-2xl bg-muted/50 p-2.5 text-left hover:bg-muted">
                        <ChoreIconTile title={chore.title} size={36} className="rounded-xl" />
                        <span className="min-w-0 flex-1 truncate font-semibold">{chore.title}</span>
                        <span className="text-xs font-bold text-muted-foreground">{choreScheduleLabel(chore)}</span>
                        {isRandomAssignmentEnabled(chore) ? <Repeat className="h-4 w-4 text-primary" aria-label="Takes turns" /> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
          {kids.length === 0 ? <EmptyState title="No kids yet">Add kids in Family to give them chores.</EmptyState> : null}
        </div>
      )}

      {paused.length > 0 ? (
        <section className="rounded-[22px] bg-muted/70">
          <button type="button" onClick={() => setShowPaused((open) => !open)} aria-expanded={showPaused} className="flex w-full items-center gap-3 p-4 font-display text-lg font-semibold">
            Paused chores ({paused.length})<ChevronDown className={cn("ml-auto h-5 w-5 transition-transform", showPaused && "rotate-180")} />
          </button>
          {showPaused ? (view === "chore" && layout === "list"
            ? <div className="px-4 pb-4"><ChoreList chores={[...paused].sort(byTitle)} profiles={profiles} onOpen={edit} /></div>
            : <ul className="grid gap-3 px-4 pb-4 md:grid-cols-2">{[...paused].sort(byTitle).map((chore) => <li key={chore.id}><ChoreRow chore={chore} profiles={profiles} onOpen={() => edit(chore)} /></li>)}</ul>) : null}
        </section>
      ) : null}

      <Sheet open={chooserOpen} onOpenChange={setChooserOpen} title="Add a chore">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard icon={<Lightbulb className="h-7 w-7" />} title="Pick from ideas" text="Common chores you can add in one tap." onClick={() => { setChooserOpen(false); setIdeasOpen(true) }} />
          <ChoiceCard icon={<PencilLine className="h-7 w-7" />} title="Create my own" text="Name it, add steps, set points and rules." onClick={() => create()} />
        </div>
      </Sheet>

      <IdeasSheet open={ideasOpen} onOpenChange={setIdeasOpen} profiles={profiles} chores={chores} onRefresh={onRefresh} onCustomize={create} />
      <ChoreEditorSheet open={editorOpen} onOpenChange={setEditorOpen} chore={editing} seed={seed} profiles={profiles} rewards={rewards} onRefresh={onRefresh} />
    </div>
  )
}

/** The kids on a chore and, when they take turns, whose turn it is now. */
function choreDetails(chore: ChoreRecord, profiles: FamilyProfile[]) {
  const people = getAssignedProfileIds(chore).map((id) => profiles.find((profile) => profile.id === id)).filter((profile): profile is FamilyProfile => Boolean(profile))
  const turns = isRandomAssignmentEnabled(chore)
  const upNow = turns ? profiles.find((profile) => assigneesOf(chore, profiles).includes(profile.id)) ?? null : null
  return { people, turns, upNow, points: chorePoints(chore), level: DIFFICULTIES.find((option) => option.value === difficultyOf(chore)) }
}

function People({ people, size = 24, max = 4 }: { people: FamilyProfile[]; size?: number; max?: number }) {
  return (
    <span className="flex shrink-0 items-center -space-x-1.5" title={people.map((person) => person.display_name).join(", ")}>
      {people.slice(0, max).map((person) => <Avatar key={person.id} profile={person} size={size} className="ring-2 ring-card" />)}
      {people.length > max ? <span className="grid shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold ring-2 ring-card" style={{ width: size, height: size }}>+{people.length - max}</span> : null}
      <span className="sr-only">{people.map((person) => person.display_name).join(", ")}</span>
    </span>
  )
}

function ChoreFlags({ chore }: { chore: ChoreRecord }) {
  return (
    <>
      {requiresApproval(chore) ? <ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-label="Needs approval" /> : null}
      {chore.time_limit_minutes ? <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs font-bold"><Timer className="h-3 w-3" />{chore.time_limit_minutes}m</span> : null}
      {choreVideo(chore.title) ? <Video className="h-4 w-4 shrink-0 text-secondary" aria-label="Has a how-to video" /> : null}
    </>
  )
}

function LayoutToggle({ value, onChange }: { value: Layout; onChange: (layout: Layout) => void }) {
  const options = [
    { value: "tiles" as const, label: "Tiles", icon: LayoutGrid },
    { value: "list" as const, label: "List", icon: List },
  ]
  return (
    <div className="flex shrink-0 self-start rounded-full bg-card p-1 shadow-soft sm:self-auto" role="radiogroup" aria-label="Show chores as">
      {options.map(({ value: option, label, icon: Icon }) => (
        <button key={option} type="button" role="radio" aria-checked={value === option} onClick={() => onChange(option)}
          className={cn("inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold transition-colors", value === option ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
          <Icon className="h-4 w-4" />{label}
        </button>
      ))}
    </div>
  )
}

/** Every chore on one line each, A to Z, with the same details as the tiles. */
function ChoreList({ chores, profiles, onOpen }: { chores: ChoreRecord[]; profiles: FamilyProfile[]; onOpen: (chore: ChoreRecord) => void }) {
  const columns = "md:grid-cols-[minmax(0,1fr)_6.5rem_6.5rem_6rem_8.5rem_3rem_1.25rem]"
  return (
    <div className="overflow-hidden rounded-[22px] bg-card shadow-soft">
      <div className={cn("hidden gap-3 border-b border-border px-4 py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-muted-foreground md:grid", columns)} aria-hidden="true">
        <span>Chore</span><span>Schedule</span><span>Difficulty</span><span>Who</span><span>Turn</span><span className="text-right">Points</span><span />
      </div>
      <ul>
        {chores.map((chore) => {
          const { people, turns, upNow, points, level } = choreDetails(chore, profiles)
          return (
            <li key={chore.id} className="border-t border-border first:border-t-0">
              <button type="button" onClick={() => onOpen(chore)} className={cn("grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-muted/50 md:gap-y-0", columns, !isActive(chore) && "opacity-60")}>
                <span className="flex min-w-0 items-center gap-3">
                  <ChoreIconTile title={chore.title} size={36} className="rounded-xl" />
                  <span className="truncate font-display font-semibold">{chore.title}</span>
                  <span className="hidden md:contents"><ChoreFlags chore={chore} /></span>
                </span>
                {/* Phones: one line of details under the title. */}
                <span className="flex items-center gap-2 md:hidden">
                  <People people={people} size={22} max={3} />
                  {points > 0 ? <span className="text-sm font-bold tabular-nums">⭐ {points}</span> : null}
                </span>
                <span className="col-span-2 flex flex-wrap items-center gap-1.5 pl-12 text-xs font-bold text-muted-foreground md:hidden">
                  <span>{choreScheduleLabel(chore)}</span>
                  {level ? <span>· {level.label}</span> : null}
                  <ChoreFlags chore={chore} />
                  {turns ? <span className="inline-flex items-center gap-0.5">· <Repeat className="h-3 w-3" />{upNow ? `${upNow.display_name}'s turn` : "Takes turns"}</span> : null}
                </span>
                {/* Tablets and computers: columns. */}
                <span className="hidden truncate text-sm font-semibold md:block">{choreScheduleLabel(chore)}</span>
                <span className="hidden truncate text-sm font-semibold md:block">{level ? <><span aria-hidden="true">{level.emoji} </span>{level.label}</> : "—"}</span>
                <span className="hidden md:block"><People people={people} /></span>
                <span className="hidden min-w-0 items-center gap-1.5 text-sm md:flex">
                  {turns ? <>{upNow ? <Avatar profile={upNow} size={22} /> : <Repeat className="h-4 w-4 text-primary" />}<span className="truncate">{upNow ? `${upNow.display_name}'s turn` : "Takes turns"}</span></> : <span className="text-muted-foreground">—</span>}
                </span>
                <span className="hidden text-right font-display text-sm font-semibold tabular-nums md:block">{points > 0 ? `⭐ ${points}` : "—"}</span>
                <ChevronRight className="hidden h-5 w-5 text-muted-foreground md:block" />
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function ChoreRow({ chore, profiles, onOpen }: { chore: ChoreRecord; profiles: FamilyProfile[]; onOpen: () => void }) {
  const { people, turns, upNow, points, level } = choreDetails(chore, profiles)
  return (
    <button type="button" onClick={onOpen} className={cn("flex w-full items-center gap-3 rounded-[22px] bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.99]", !isActive(chore) && "opacity-60")}>
      <ChoreIconTile title={chore.title} size={52} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate font-display text-lg font-semibold">{chore.title}</span>
          <ChoreFlags chore={chore} />
        </span>
        <span className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden text-sm text-muted-foreground">
          <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-foreground">{choreScheduleLabel(chore)}</span>
          {level ? <span className="shrink-0 whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold text-foreground"><span aria-hidden="true">{level.emoji} </span>{level.label}</span> : null}
          <People people={people} />
          {/* Who has it is shown by the photos; only "whose turn" gets words, so every tile is one height. */}
          {turns ? <span className="min-w-0 truncate"><Repeat className="mr-0.5 inline h-3.5 w-3.5" />{upNow ? `${upNow.display_name}'s turn` : "Takes turns"}</span> : null}
        </span>
      </span>
      {points > 0 ? <TokenPill amount={points} prefix="+" /> : null}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  )
}

function ChoiceCard({ icon, title, text, onClick }: { icon: ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-start gap-2 rounded-[22px] bg-card p-5 text-left shadow-soft transition-transform hover:-translate-y-0.5 active:scale-[0.98]">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
      <span className="font-display text-xl font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{text}</span>
    </button>
  )
}

function IdeasSheet({ open, onOpenChange, profiles, chores, onRefresh, onCustomize }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  onRefresh: () => Promise<void>
  onCustomize: (seed: ChoreDraftSeed) => void
}) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<FrequencyFilter>("all")
  const [picked, setPicked] = useState<string[]>([])
  const [kids, setKids] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [catalog, setCatalog] = useState<CatalogChore[]>([])
  const settings = useFamilySettings()
  const allKids = kidsOf(profiles)
  const key = (preset: CatalogChore) => preset.id
  // Kids this idea suits, by age; only when the family turned age-based ideas on and kids have birth years.
  const ages = allKids.map((kid) => ({ kid, age: ageFromBirthYear(kid.birth_year) })).filter((item) => item.age !== null)
  const goodFor = (preset: CatalogChore) => settings.suggestions.ageBased && ages.length > 0 && (preset.min_age !== null || preset.max_age !== null)
    ? ages.filter((item) => fitsAge(preset, item.age)).map((item) => item.kid)
    : null
  const visible = useMemo(() => catalog
    .filter((preset) => (filter === "all" || preset.frequency === filter) && preset.title.toLowerCase().includes(query.trim().toLowerCase()))
    .map((preset) => ({ preset, fits: goodFor(preset) })),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [catalog, filter, query, settings, profiles])

  useEffect(() => {
    if (!open) return
    void loadCatalog().then(setCatalog)
    setPicked([])
    setKids(allKids.map((kid) => kid.id))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const add = async () => {
    const records = catalog.filter((preset) => picked.includes(key(preset))).flatMap((preset) => {
      const ids = kids.filter((id) => !chores.some((chore) => isActive(chore) && chore.frequency === preset.frequency && chore.title.toLowerCase() === preset.title.toLowerCase() && getAssignedProfileIds(chore).includes(id)))
      if (ids.length === 0) return []
      return [{ title: preset.title, frequency: preset.frequency, target_profile_id: ids[0], assigned_profile_ids: JSON.stringify(ids), subtasks: JSON.stringify(preset.subtasks.map((step) => ({ ...step, id: makeTaskId() }))), reward: "", reward_points: settings.points.difficultyPoints.easy, time_limit_minutes: null, requires_verification: false, random_assignment_enabled: false, assignment_rotation_enabled: false, assignment_change_frequency: "weekly", is_active: true }]
    })
    if (records.length === 0) {
      setError("Those chores are already set up for the kids you picked.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await db.chore.bulkCreate(records)
      await onRefresh()
      onOpenChange(false)
    } catch (caught) {
      console.error("Adding chore ideas failed:", caught)
      setError("We couldn't add those chores. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Chore ideas"
      description="Pick a few to start. You can add steps and change points later."
      footer={
        <div className="space-y-3">
          {allKids.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold">For</span>
              {allKids.map((kid) => <Chip key={kid.id} active={kids.includes(kid.id)} onClick={() => setKids((current) => current.includes(kid.id) ? current.filter((id) => id !== kid.id) : [...current, kid.id])}>{kid.display_name}</Chip>)}
            </div>
          ) : null}
          <ErrorNote>{error}</ErrorNote>
          <Button onClick={() => void add()} disabled={saving || picked.length === 0 || kids.length === 0} className="w-full">
            <Plus className="h-5 w-5" />{saving ? "Adding..." : picked.length ? `Add ${picked.length} ${picked.length === 1 ? "chore" : "chores"}` : "Pick some chores"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <span className="sr-only">Search ideas</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search ideas..." className="flex min-h-12 w-full rounded-full bg-card pl-12 pr-4 shadow-soft outline-none focus:ring-2 focus:ring-ring" />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["all", "daily", "weekly"] as FrequencyFilter[]).map((value) => <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>{value === "all" ? "All" : FREQUENCY_LABEL[value]}</Chip>)}
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map(({ preset, fits }) => {
            const selected = picked.includes(key(preset))
            return (
              <li key={key(preset)} className={cn("flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft", selected && "ring-2 ring-primary")}>
                <button type="button" onClick={() => setPicked((current) => selected ? current.filter((item) => item !== key(preset)) : [...current, key(preset)])} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <ChoreIconTile title={preset.title} size={40} className="rounded-xl" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{preset.title}</span>
                    <span className="text-xs font-bold text-muted-foreground">
                      {FREQUENCY_LABEL[preset.frequency]}{preset.subtasks.length ? ` · ${preset.subtasks.length} steps` : ""}
                      {fits?.length ? <span className="text-success"> · Good for {fits.map((kid) => kid.display_name).join(", ")}</span> : null}
                    </span>
                  </span>
                </button>
                <button type="button" onClick={() => onCustomize({ title: preset.title, frequency: preset.frequency, steps: preset.subtasks })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Customize ${preset.title}`}><PencilLine className="h-4 w-4" /></button>
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")} aria-hidden="true">{selected ? "✓" : ""}</span>
              </li>
            )
          })}
        </ul>
      </div>
    </Sheet>
  )
}
