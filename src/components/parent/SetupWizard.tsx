import { useEffect, useMemo, useState, type ReactNode } from "react"
import { ArrowRight, Check, Gift, Home, KeyRound, Lightbulb, Minus, Plus, Smartphone, Sparkles, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, Chip, ErrorNote, Field, inputClass } from "@/components/kit"
import type { ChoreRecord, FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { firstName, isActive, kidsOf } from "@/lib/family"
import { db } from "@/lib/db"
import { fitsAge, loadCatalog, type CatalogChore } from "@/lib/catalog"
import { makeTaskId } from "@/lib/choreUtils"
import { ageFromBirthYear, familySettings, saveFamilySettings } from "@/lib/familySettings"
import { getKidTheme, ensureThemeFonts } from "@/lib/themes"
import { isTeenKey, teenKey } from "@/lib/teen"
import { cn } from "@/lib/utils"

/*
 * First-run setup for a new family (Stitch 3.4): add kids, pick starter chores,
 * set a first reward, then hand the phone over. Each step saves as it goes, and
 * "Skip for now" closes it for good (families.settings.setup.finished).
 */

interface SetupWizardProps {
  profile: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  rewards: FamilyReward[]
  onRefresh: () => Promise<void>
  onFinish: (next: "kids" | "parent") => void
}

const SKIP_KEY = "responsibilities.setupFinished"

/** Whether to show the wizard: a family with no kids that hasn't finished or skipped it. */
export function needsSetupWizard(profiles: FamilyProfile[]): boolean {
  if (kidsOf(profiles).length > 0 || familySettings().setup.finished) return false
  try {
    return localStorage.getItem(SKIP_KEY) !== "1"
  } catch {
    return true
  }
}

async function markFinished() {
  try {
    localStorage.setItem(SKIP_KEY, "1")
  } catch {
    // Storage can be blocked; the family setting below is what counts.
  }
  try {
    await saveFamilySettings({ ...familySettings(), setup: { finished: true } })
  } catch (error) {
    console.warn("Saving setup as finished failed:", error)
  }
}

const AGE_BANDS = [
  { id: "4-6", label: "4–6", age: 5 },
  { id: "7-9", label: "7–9", age: 8 },
  { id: "10-12", label: "10–12", age: 11 },
  { id: "13+", label: "13+", age: 14 },
] as const
type AgeBandId = (typeof AGE_BANDS)[number]["id"]

const WORLDS = ["sunny-room", "space-mission", "dino-valley", "ocean-explorer", "fairy-garden", "superhero-city", "pixel-arcade", "candy-shop"]

const GROUPS = ["Bedroom & self-care", "Kitchen", "Laundry", "Around the house"]
// Checked in this order, so "Clean bathrooms" lands in the house and "Wash bedding" in laundry.
const GROUP_WORDS: Array<[string, string[]]> = [
  ["Laundry", ["laundry", "clothes", "washing", "dryer", "fold", "bedding"]],
  ["Kitchen", ["dish", "table", "dinner", "kitchen", "counter", "lunch", "breakfast", "cook", "dining"]],
  ["Around the house", ["bathroom", "living room", "floor", "trash", "recycl", "sweep", "vacuum", "porch", "yard", "pet", "dog", "cat"]],
  ["Bedroom & self-care", ["bed", "teeth", "shower", "bath", "dress", "bedroom", "prayer", "read", "homework", "ready"]],
]
const groupOf = (title: string) => GROUP_WORDS.find(([, words]) => words.some((word) => title.toLowerCase().includes(word)))?.[0] ?? "Around the house"

// Chores most families start with, picked for them when they're on the list.
const STARTERS = ["Make your bed", "Brush teeth", "Get ready for bed", "Set table for dinner", "Read book"]

const REWARD_IDEAS = [
  { title: "Pick the family movie", description: "Choose Friday's movie and the snacks.", cost: 50 },
  { title: "Extra 30 min screen time", description: "Weekend video games or tablet time.", cost: 30 },
  { title: "Ice cream trip", description: "A special treat out together.", cost: 75 },
  { title: "Stay up 30 min later", description: "One night, any night this week.", cost: 40 },
]

export function SetupWizard({ profile, profiles, chores, rewards, onRefresh, onFinish }: SetupWizardProps) {
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const kids = kidsOf(profiles)

  const skip = async () => {
    setBusy(true)
    await markFinished()
    onFinish("parent")
  }

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      return true
    } catch (caught) {
      console.error(failure, caught)
      setError(failure)
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-10 pt-5 text-foreground">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <ol className="flex items-center gap-1.5" aria-label={`Step ${step + 1} of 4`}>
            {[0, 1, 2, 3].map((index) => <li key={index} className={cn("h-2 rounded-full transition-all", index === step ? "w-10 bg-primary" : index < step ? "w-2 bg-primary" : "w-2 bg-primary/25")} />)}
          </ol>
          {step < 3 ? <button type="button" onClick={() => void skip()} disabled={busy} className="text-sm font-bold text-muted-foreground hover:text-foreground">Skip for now</button> : null}
        </div>

        {step === 0 ? <KidsStep kids={kids} busy={busy} error={error} run={run} onRefresh={onRefresh} onNext={() => { setError(null); setStep(1) }} /> : null}
        {step === 1 ? <ChoresStep kids={kids} chores={chores} busy={busy} error={error} run={run} onRefresh={onRefresh} onNext={() => { setError(null); setStep(2) }} /> : null}
        {step === 2 ? <RewardStep rewards={rewards} busy={busy} error={error} run={run} onRefresh={onRefresh} onNext={() => { setError(null); setStep(3) }} /> : null}
        {step === 3 ? <ReadyStep profile={profile} kids={kids} chores={chores} rewards={rewards} busy={busy} onFinish={async (next) => { setBusy(true); await markFinished(); onFinish(next) }} /> : null}
      </div>
    </main>
  )
}

type Run = (action: () => Promise<unknown>, failure: string) => Promise<boolean>

function StepHeader({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <header className="mt-6 space-y-1">
      <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-primary">Step {step} of 4</p>
      <h1 className="font-display text-3xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{children}</p>
    </header>
  )
}

function KidsStep({ kids, busy, error, run, onRefresh, onNext }: { kids: FamilyProfile[]; busy: boolean; error: string | null; run: Run; onRefresh: () => Promise<void>; onNext: () => void }) {
  const [name, setName] = useState("")
  const [band, setBand] = useState<AgeBandId>("7-9")
  const [world, setWorld] = useState("sunny-room")
  const teen = band === "13+"
  useEffect(() => { WORLDS.forEach(ensureThemeFonts) }, [])

  const add = async () => {
    if (!name.trim()) return
    const age = AGE_BANDS.find((item) => item.id === band)?.age ?? 8
    const ok = await run(async () => {
      await db.family_profile.create({
        display_name: name.trim(), profile_type: "child", theme_key: teen ? teenKey() : world, pin_hash: "", is_active: true,
        // An estimate from the age band; parents can set the real year later. Used for age-fit chore ideas.
        birth_year: new Date().getFullYear() - age,
      })
      await onRefresh()
    }, "We couldn't add that kid. Try again.")
    if (ok) setName("")
  }

  const remove = (kid: FamilyProfile) => void run(async () => {
    await db.family_profile.update(kid.id, { is_active: false })
    await onRefresh()
  }, "We couldn't remove that kid.")

  return (
    <>
      <StepHeader step={1} title="Add your kids">Each kid gets their own profile, chores and points.</StepHeader>
      <section className="mt-5 space-y-4 rounded-[22px] bg-card p-5 shadow-soft">
        <Field label="Kid's name"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void add() }} placeholder="Sammy" maxLength={40} /></Field>
        <div className="space-y-1.5">
          <span className="flex items-center justify-between text-sm font-bold">Age<span className="font-normal text-muted-foreground">Used to suggest chores that fit</span></span>
          <div className="grid grid-cols-4 gap-2">
            {AGE_BANDS.map((item) => <Chip key={item.id} active={band === item.id} onClick={() => setBand(item.id)} className="justify-center">{item.label}</Chip>)}
          </div>
        </div>
        {teen ? (
          <p className="rounded-2xl bg-muted/60 p-3 text-sm">Kids 13 and up start in <b>Teen mode</b>: a clean dark look with XP instead of stars. You can switch it in Family later.</p>
        ) : (
          <div className="space-y-1.5">
            <span className="block text-sm font-bold">Pick a world</span>
            <div className="grid grid-cols-4 gap-2">
              {WORLDS.map((id) => {
                const theme = getKidTheme(id)
                return (
                  <button key={id} type="button" onClick={() => setWorld(id)} aria-pressed={world === id}
                    className={cn("flex flex-col items-center gap-1 rounded-2xl p-2 text-xs font-bold transition-transform active:scale-95", world === id ? "ring-2 ring-primary" : "ring-1 ring-border")}
                    style={{ background: theme.colors.bg, color: theme.colors.ink }}>
                    <span className="text-2xl" aria-hidden="true">{theme.token}</span>
                    <span className="truncate" style={{ fontFamily: theme.displayStack }}>{theme.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
        <Button variant="outline" onClick={() => void add()} disabled={busy || !name.trim()} className="w-full"><Plus className="h-5 w-5" />{name.trim() ? `Add ${name.trim()}` : "Add kid"}</Button>
      </section>

      {kids.length > 0 ? (
        <section className="mt-5 space-y-2">
          <h2 className="flex items-center gap-2 font-display text-xl font-semibold">Kids in your family<span className="rounded-full bg-primary/10 px-2 text-base text-primary">{kids.length}</span></h2>
          <ul className="space-y-2">
            {kids.map((kid) => {
              const age = ageFromBirthYear(kid.birth_year)
              return (
                <li key={kid.id} className="flex items-center gap-3 rounded-[22px] bg-card p-3 shadow-soft">
                  <Avatar profile={kid} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-lg font-semibold">{kid.display_name}</span>
                    <span className="block text-sm text-muted-foreground">{getKidTheme(kid.theme_key).name}{age !== null ? ` · about ${age}` : ""}</span>
                  </span>
                  <button type="button" onClick={() => remove(kid)} disabled={busy} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-coral/10 hover:text-coral" aria-label={`Remove ${kid.display_name}`}><Trash2 className="h-4 w-4" /></button>
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}

      <ErrorNote>{error}</ErrorNote>
      <Button size="lg" onClick={onNext} disabled={busy || kids.length === 0} className="mt-6 w-full">Next: pick chores<ArrowRight className="h-5 w-5" /></Button>
      <p className="mt-2 text-center text-sm text-muted-foreground">{kids.length === 0 ? "Add at least one kid to keep going." : "You can add or change kids any time in Family."}</p>
    </>
  )
}

function ChoresStep({ kids, chores, busy, error, run, onRefresh, onNext }: { kids: FamilyProfile[]; chores: ChoreRecord[]; busy: boolean; error: string | null; run: Run; onRefresh: () => Promise<void>; onNext: () => void }) {
  const [catalog, setCatalog] = useState<CatalogChore[] | null>(null)
  // Chore title -> the kids it goes to.
  const [picked, setPicked] = useState<Record<string, string[]>>({})
  const points = familySettings().points.defaultPoints
  const kidsFor = (item: CatalogChore) => kids.filter((kid) => fitsAge(item, ageFromBirthYear(kid.birth_year))).map((kid) => kid.id)

  useEffect(() => {
    void loadCatalog().then((items) => {
      const fitting = items.filter((item) => kids.some((kid) => fitsAge(item, ageFromBirthYear(kid.birth_year))))
      setCatalog(fitting)
      setPicked(Object.fromEntries(fitting.filter((item) => STARTERS.includes(item.title)).map((item) => [item.title, kidsFor(item)])))
    })
    // Loaded once when the step opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const groups = useMemo(() => GROUPS.map((name) => ({ name, items: (catalog ?? []).filter((item) => groupOf(item.title) === name) })).filter((group) => group.items.length > 0), [catalog])
  const count = Object.values(picked).filter((ids) => ids.length > 0).length

  const toggle = (item: CatalogChore) => setPicked((current) => {
    const next = { ...current }
    if (next[item.title]?.length) delete next[item.title]
    else next[item.title] = kidsFor(item)
    return next
  })
  const toggleKid = (title: string, kidId: string) => setPicked((current) => {
    const ids = current[title] ?? []
    return { ...current, [title]: ids.includes(kidId) ? ids.filter((id) => id !== kidId) : [...ids, kidId] }
  })

  const save = async () => {
    const have = new Set(chores.filter(isActive).map((chore) => chore.title.toLowerCase()))
    const ok = await run(async () => {
      for (const item of catalog ?? []) {
        const assigned = picked[item.title] ?? []
        if (assigned.length === 0 || have.has(item.title.toLowerCase())) continue
        await db.chore.create({
          title: item.title, frequency: item.frequency, target_profile_id: assigned[0], assigned_profile_ids: JSON.stringify(assigned),
          subtasks: JSON.stringify(item.subtasks.map((step) => ({ ...step, id: makeTaskId() }))), reward: "", reward_id: "", reward_points: points,
          time_limit_minutes: null, requires_verification: false, random_assignment_enabled: false, assignment_rotation_enabled: false,
          assignment_change_frequency: "weekly", is_active: true,
        })
      }
      await onRefresh()
    }, "We couldn't add those chores. Try again.")
    if (ok) onNext()
  }

  return (
    <>
      <StepHeader step={2} title="Pick starter chores">Tap the ones that fit. You can change points, steps and schedules any time.</StepHeader>
      {catalog === null ? <p className="mt-6 text-muted-foreground">Loading chore ideas...</p> : null}
      <div className="mt-5 space-y-5">
        {groups.map((group) => (
          <section key={group.name} className="space-y-2">
            <h2 className="flex items-center justify-between font-display text-xl font-semibold">{group.name}<span className="text-sm font-bold text-muted-foreground">{group.items.filter((item) => picked[item.title]?.length).length || ""}{group.items.some((item) => picked[item.title]?.length) ? " picked" : ""}</span></h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const on = (picked[item.title]?.length ?? 0) > 0
                const fits = kidsFor(item)
                return (
                  <li key={item.id} className={cn("rounded-[22px] bg-card p-3 shadow-soft", on && "ring-2 ring-primary")}>
                    <button type="button" onClick={() => toggle(item)} aria-pressed={on} className="flex w-full items-center gap-3 text-left">
                      <ChoreIconTile title={item.title} size={44} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-lg font-semibold leading-tight">{item.title}</span>
                        <span className="block text-sm text-muted-foreground">{item.frequency === "daily" ? "Daily" : item.frequency === "weekly" ? "Weekly" : "Monthly"}{item.subtasks.length ? ` · ${item.subtasks.length} steps` : ""} · ⭐ {points}</span>
                      </span>
                      <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{on ? <Check className="h-5 w-5" strokeWidth={3} /> : <Plus className="h-5 w-5" />}</span>
                    </button>
                    {on && kids.length > 1 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-[56px]">
                        {kids.filter((kid) => fits.includes(kid.id)).map((kid) => (
                          <button key={kid.id} type="button" onClick={() => toggleKid(item.title, kid.id)} aria-pressed={picked[item.title]?.includes(kid.id)}
                            className={cn("rounded-full px-2.5 py-0.5 text-sm font-bold", picked[item.title]?.includes(kid.id) ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground line-through")}>
                            {firstName(kid)}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-5 flex items-start gap-3 rounded-[22px] bg-accent/25 p-4 text-sm"><Lightbulb className="h-5 w-5 shrink-0 text-accent-foreground" />Starting with 3 to 5 simple chores helps kids build the habit without feeling swamped.</p>
      <ErrorNote>{error}</ErrorNote>
      <div className="sticky bottom-0 -mx-4 mt-5 flex items-center gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur pb-safe">
        <span className="flex-1 font-bold">{count} {count === 1 ? "chore" : "chores"} picked</span>
        <Button onClick={() => void save()} disabled={busy}>{busy ? "Adding..." : count ? "Next: rewards" : "Skip chores"}<ArrowRight className="h-5 w-5" /></Button>
      </div>
    </>
  )
}

function RewardStep({ rewards, busy, error, run, onRefresh, onNext }: { rewards: FamilyReward[]; busy: boolean; error: string | null; run: Run; onRefresh: () => Promise<void>; onNext: () => void }) {
  const [picked, setPicked] = useState<string[]>([REWARD_IDEAS[0].title, REWARD_IDEAS[1].title])
  const [ownTitle, setOwnTitle] = useState("")
  const [ownCost, setOwnCost] = useState(40)

  const save = async () => {
    const have = new Set(rewards.filter(isActive).map((reward) => reward.title.toLowerCase()))
    const list = [
      ...REWARD_IDEAS.filter((idea) => picked.includes(idea.title)),
      ...(ownTitle.trim() ? [{ title: ownTitle.trim(), description: "", cost: ownCost }] : []),
    ].filter((idea) => !have.has(idea.title.toLowerCase()))
    const ok = await run(async () => {
      for (const idea of list) {
        await db.family_reward.create({ title: idea.title, description: idea.description, points_required: idea.cost, target_profile_id: "", reward_type: "participation", is_active: true })
      }
      await onRefresh()
    }, "We couldn't save those rewards. Try again.")
    if (ok) onNext()
  }

  return (
    <>
      <StepHeader step={3} title="Set a first reward">Give your kids something to save their points for. Every kid can earn these.</StepHeader>
      <ul className="mt-5 space-y-2">
        {REWARD_IDEAS.map((idea) => {
          const on = picked.includes(idea.title)
          return (
            <li key={idea.title}>
              <button type="button" onClick={() => setPicked((current) => on ? current.filter((title) => title !== idea.title) : [...current, idea.title])} aria-pressed={on}
                className={cn("flex w-full items-center gap-3 rounded-[22px] bg-card p-4 text-left shadow-soft", on && "ring-2 ring-primary")}>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-secondary"><Gift className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold leading-tight">{idea.title}</span>
                  <span className="block text-sm text-muted-foreground">{idea.description}</span>
                </span>
                <span className="shrink-0 rounded-full bg-accent/30 px-3 py-1 font-display text-sm font-semibold">⭐ {idea.cost}</span>
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{on ? <Check className="h-5 w-5" strokeWidth={3} /> : <Plus className="h-5 w-5" />}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <section className="mt-4 space-y-3 rounded-[22px] bg-card p-4 shadow-soft">
        <Field label="Or write your own"><input className={inputClass} value={ownTitle} onChange={(event) => setOwnTitle(event.target.value)} placeholder="Choose weekend breakfast" maxLength={80} /></Field>
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Points needed</span>
          <span className="flex items-center gap-2 rounded-full bg-accent/30 p-1">
            <button type="button" onClick={() => setOwnCost((cost) => Math.max(5, cost - 5))} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="Fewer points"><Minus className="h-4 w-4" /></button>
            <span className="w-12 text-center font-display font-semibold tabular-nums">⭐ {ownCost}</span>
            <button type="button" onClick={() => setOwnCost((cost) => cost + 5)} className="grid h-8 w-8 place-items-center rounded-full bg-card" aria-label="More points"><Plus className="h-4 w-4" /></button>
          </span>
        </div>
      </section>
      <ErrorNote>{error}</ErrorNote>
      <Button size="lg" onClick={() => void save()} disabled={busy} className="mt-6 w-full">{busy ? "Saving..." : "Review and finish"}<ArrowRight className="h-5 w-5" /></Button>
    </>
  )
}

function ReadyStep({ profile, kids, chores, rewards, busy, onFinish }: { profile: FamilyProfile; kids: FamilyProfile[]; chores: ChoreRecord[]; rewards: FamilyReward[]; busy: boolean; onFinish: (next: "kids" | "parent") => void }) {
  const active = chores.filter(isActive)
  const prizes = rewards.filter(isActive)
  const names = kids.map(firstName)
  const list = names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "your kids"
  return (
    <div className="mt-6 text-center">
      <span className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-accent/40"><Sparkles className="h-11 w-11 text-accent-foreground" /></span>
      <h1 className="mt-4 font-display text-3xl font-semibold">Your family is ready!</h1>
      <p className="mt-1 text-muted-foreground">Everything is set up for {list} to start.</p>

      <section className="mt-6 space-y-4 rounded-[26px] bg-card p-5 text-left shadow-soft">
        <SummaryRow icon={<Users className="h-5 w-5" />} title={`${kids.length} ${kids.length === 1 ? "kid" : "kids"}`}>
          <div className="flex flex-wrap gap-2">{kids.map((kid) => <span key={kid.id} className="inline-flex items-center gap-2 rounded-full bg-muted/70 py-1 pl-1 pr-3 text-sm font-bold"><Avatar profile={kid} size={28} />{kid.display_name}<span className="font-normal text-muted-foreground">{isTeenKey(kid.theme_key) ? "Teen" : getKidTheme(kid.theme_key).name}</span></span>)}</div>
        </SummaryRow>
        <SummaryRow icon={<Home className="h-5 w-5" />} title={`${active.length} ${active.length === 1 ? "chore" : "chores"}`}>
          {active.length ? <div className="flex flex-wrap gap-2">{active.slice(0, 8).map((chore) => <span key={chore.id} className="rounded-full bg-muted/70 px-3 py-1 text-sm font-bold">{chore.title}</span>)}{active.length > 8 ? <span className="px-1 py-1 text-sm text-muted-foreground">+{active.length - 8} more</span> : null}</div> : <p className="text-sm text-muted-foreground">Add chores from the Chores tab.</p>}
        </SummaryRow>
        <SummaryRow icon={<Gift className="h-5 w-5" />} title={`${prizes.length} ${prizes.length === 1 ? "reward" : "rewards"}`}>
          {prizes.length ? <div className="flex flex-wrap gap-2">{prizes.map((reward) => <span key={reward.id} className="rounded-full bg-accent/25 px-3 py-1 text-sm font-bold">{reward.title} · ⭐ {Number(reward.points_required) || 0}</span>)}</div> : <p className="text-sm text-muted-foreground">Add rewards from the Rewards tab.</p>}
        </SummaryRow>
        <SummaryRow icon={<KeyRound className="h-5 w-5" />} title="Parent PIN">
          <p className="text-sm text-muted-foreground">{profile.pin_hash ? "Set. Kids can't open parent mode without it." : "Not set yet. Add one in Family so kids can't open parent mode."}</p>
        </SummaryRow>
      </section>

      <Button size="lg" onClick={() => onFinish("kids")} disabled={busy} className="mt-6 w-full"><Smartphone className="h-5 w-5" />Hand the phone to your kids<ArrowRight className="h-5 w-5" /></Button>
      <Button variant="ghost" onClick={() => onFinish("parent")} disabled={busy} className="mt-2 w-full">Open the parent dashboard instead</Button>
    </div>
  )
}

function SummaryRow({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="font-display text-lg font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}
