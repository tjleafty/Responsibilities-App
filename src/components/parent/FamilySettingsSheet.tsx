import { useEffect, useState, type ReactNode } from "react"
import { Bell, BellRing, Check, Gift, Lightbulb, PartyPopper, Star } from "lucide-react"
import { DeviceReminders } from "@/components/DeviceReminders"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Chip, ChoreIconTile, ErrorNote, inputClass, Sheet, Stepper } from "@/components/kit"
import type { ChoreRecord, Difficulty, FamilyProfile } from "@/lib/familyTypes"
import { isActive, kidsOf } from "@/lib/family"
import { db } from "@/lib/db"
import { familySettings, familySettingsAvailable, saveFamilySettings, type FamilySettings } from "@/lib/familySettings"
import { DIFFICULTIES, difficultyOf } from "@/lib/difficulty"
import { cn } from "@/lib/utils"
import { listMembers, type FamilyMember } from "@/lib/familySharing"

const WEEKLY_LIMITS: Array<number | null> = [null, 1, 2, 3, 5]
const KID_TIMES = ["07:00", "15:30", "16:00", "17:00", "18:00", "19:00", "20:00"]
const PARENT_TIMES: Array<string | null> = [null, "18:00", "19:30", "20:30"]

/** "16:00" as "4:00 PM". */
const clock = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number)
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

interface FamilySettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The grown-up using the app, for "reminders on this device". */
  me: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  onRefresh: () => Promise<void>
}

/** Family-wide rules: points, prizes, emails, chore ideas and celebrations. */
export function FamilySettingsSheet({ open, onOpenChange, me, profiles, chores, onRefresh }: FamilySettingsSheetProps) {
  const [draft, setDraft] = useState<FamilySettings>(familySettings())
  const [points, setPoints] = useState<Record<string, number>>({})
  const [levels, setLevels] = useState<Record<string, Difficulty | null>>({})
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const available = familySettingsAvailable()
  const activeChores = chores.filter(isActive)
  const kidsWithoutAge = kidsOf(profiles).filter((kid) => !kid.birth_year)

  useEffect(() => {
    if (!open) return
    setDraft(familySettings())
    setPoints(Object.fromEntries(chores.map((chore) => [chore.id, Number(chore.reward_points) || 0])))
    setLevels(Object.fromEntries(chores.map((chore) => [chore.id, difficultyOf(chore)])))
    setError(null)
    listMembers().then(setMembers).catch(() => setMembers([]))
  }, [open, chores])

  const set = <K extends keyof FamilySettings>(group: K, value: Partial<FamilySettings[K]>) =>
    setDraft((current) => ({ ...current, [group]: { ...current[group], ...value } }))

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveFamilySettings(draft)
      const level = (chore: ChoreRecord) => levels[chore.id] ?? null
      const earns = (chore: ChoreRecord) => {
        const picked = level(chore)
        return picked ? draft.points.difficultyPoints[picked] : Math.max(0, points[chore.id] ?? 0)
      }
      const changed = activeChores.filter((chore) => level(chore) !== difficultyOf(chore) || earns(chore) !== (Number(chore.reward_points) || 0))
      await Promise.all(changed.map((chore) => db.chore.update(chore.id, {
        reward_points: earns(chore),
        // Only sent when used, so points still save on a database without the difficulty column.
        ...(level(chore) || chore.difficulty ? { difficulty: level(chore) } : {}),
      })))
      if (changed.length) await onRefresh()
      onOpenChange(false)
    } catch (caught) {
      console.error("Saving family settings failed:", caught)
      setError("We couldn't save your settings. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const muted = new Set(draft.notifications.mutedUserIds)
  const toggleMuted = (userId: string, emailsOn: boolean) =>
    set("notifications", { mutedUserIds: emailsOn ? [...muted].filter((id) => id !== userId) : [...muted, userId] })

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      wide
      title="Family settings"
      description="Rules for the whole family. Everyone's devices use them."
      footer={
        <div className="space-y-3">
          {!available ? <p className="text-sm font-semibold text-coral">These settings need the latest database update before they can be saved.</p> : null}
          <ErrorNote>{error}</ErrorNote>
          <Button onClick={() => void save()} disabled={saving || !available} className="w-full"><Check className="h-5 w-5" />{saving ? "Saving..." : "Save settings"}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Group icon={<Star className="h-5 w-5" />} title="Points">
          <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
            <span><span className="block font-bold">Points for each difficulty</span><span className="block text-sm text-muted-foreground">Chores marked easy, medium or hard earn this many points.</span></span>
            {DIFFICULTIES.map((option) => (
              <div key={option.value} className="flex items-center justify-between gap-3">
                <span className="font-semibold"><span aria-hidden="true">{option.emoji} </span>{option.label}</span>
                <Stepper value={draft.points.difficultyPoints[option.value]} onChange={(value) => set("points", { difficultyPoints: { ...draft.points.difficultyPoints, [option.value]: value } })} min={0} max={100} label={`${option.label} points`} />
              </div>
            ))}
          </div>
          {activeChores.length > 0 ? (
            <details className="rounded-2xl bg-muted/60 p-3">
              <summary className="cursor-pointer font-bold">Difficulty of each chore ({activeChores.length})</summary>
              <ul className="mt-3 space-y-2">
                {activeChores.map((chore) => {
                  const level = levels[chore.id] ?? null
                  return (
                    <li key={chore.id} className="flex flex-wrap items-center gap-3">
                      <ChoreIconTile title={chore.title} size={36} className="rounded-xl" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{chore.title}</span>
                      <select
                        className={cn(inputClass, "w-auto min-w-36")}
                        value={level ?? "custom"}
                        onChange={(event) => setLevels((current) => ({ ...current, [chore.id]: event.target.value === "custom" ? null : event.target.value as Difficulty }))}
                        aria-label={`Difficulty for ${chore.title}`}
                      >
                        {DIFFICULTIES.map((option) => <option key={option.value} value={option.value}>{option.label} ({draft.points.difficultyPoints[option.value]})</option>)}
                        <option value="custom">Custom</option>
                      </select>
                      {!level ? <Stepper value={points[chore.id] ?? 0} onChange={(value) => setPoints((current) => ({ ...current, [chore.id]: value }))} max={500} label={`points for ${chore.title}`} /> : null}
                    </li>
                  )
                })}
              </ul>
            </details>
          ) : null}
        </Group>

        <Group icon={<Gift className="h-5 w-5" />} title="Prizes">
          <Toggle label="Kids can ask for prizes" hint="When off, kids see what they can afford and tell a grown-up." checked={draft.prizes.kidsCanAsk} onChange={(on) => set("prizes", { kidsCanAsk: on })} />
          {draft.prizes.kidsCanAsk ? (
            <>
              <div className="space-y-1.5">
                <span className="block font-bold">Asks per kid each week</span>
                <div className="flex flex-wrap gap-2">
                  {WEEKLY_LIMITS.map((limit) => <Chip key={String(limit)} active={draft.prizes.maxAsksPerWeek === limit} onClick={() => set("prizes", { maxAsksPerWeek: limit })}>{limit === null ? "No limit" : limit}</Chip>)}
                </div>
              </div>
              <Toggle label="Grant small prizes automatically" hint="Cheap prizes are given right away, without waiting for you." checked={draft.prizes.autoGrantUpTo !== null} onChange={(on) => set("prizes", { autoGrantUpTo: on ? 10 : null })} />
              {draft.prizes.autoGrantUpTo !== null ? (
                <div className="flex flex-wrap items-center justify-between gap-3 pl-1">
                  <span className="text-sm font-bold">Prizes costing up to</span>
                  <Stepper value={draft.prizes.autoGrantUpTo} onChange={(value) => set("prizes", { autoGrantUpTo: value })} max={1000} step={5} label="points" />
                </div>
              ) : null}
            </>
          ) : null}
        </Group>

        <Group icon={<Bell className="h-5 w-5" />} title="Email notifications">
          <Toggle label="A chore is waiting for approval" checked={draft.notifications.approvalNeeded} onChange={(on) => set("notifications", { approvalNeeded: on })} />
          <Toggle label="A kid asks for a prize" checked={draft.notifications.prizeRequest} onChange={(on) => set("notifications", { prizeRequest: on })} />
          {(draft.notifications.approvalNeeded || draft.notifications.prizeRequest) && members.length > 0 ? (
            <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
              <span className="block text-sm font-bold">Who gets them</span>
              {members.map((member) => (
                <label key={member.user_id} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold">{member.email ?? "A grown-up"}</span>
                  <Switch checked={!muted.has(member.user_id)} onCheckedChange={(on) => toggleMuted(member.user_id, on)} />
                </label>
              ))}
            </div>
          ) : null}
        </Group>

        <Group icon={<BellRing className="h-5 w-5" />} title="Reminders">
          <Toggle label="Nudges in the app" hint="Kids see a friendly reminder on their Today page after the first reminder time, or when a chore is late." checked={draft.reminders.inApp} onChange={(on) => set("reminders", { inApp: on })} />
          <div className="space-y-1.5">
            <span className="block font-bold">Push reminders to kids at</span>
            <span className="block text-sm text-muted-foreground">Only goes out when they still have chores left. Pick up to 3.</span>
            <div className="flex flex-wrap gap-2">
              {KID_TIMES.map((time) => {
                const picked = draft.reminders.kidTimes.includes(time)
                return <Chip key={time} active={picked} onClick={() => set("reminders", { kidTimes: picked ? draft.reminders.kidTimes.filter((item) => item !== time) : [...draft.reminders.kidTimes, time].sort().slice(-3) })}>{clock(time)}</Chip>
              })}
            </div>
          </div>
          <Toggle label="Weekly chores on their day" hint="A morning reminder (8:00 AM) when a weekly chore is due." checked={draft.reminders.dueDayMorning} onChange={(on) => set("reminders", { dueDayMorning: on })} />
          <div className="space-y-1.5">
            <span className="block font-bold">Grown-ups' summary of what's left</span>
            <div className="flex flex-wrap gap-2">
              {PARENT_TIMES.map((time) => <Chip key={String(time)} active={draft.reminders.parentTime === time} onClick={() => set("reminders", { parentTime: time })}>{time ? clock(time) : "Off"}</Chip>)}
            </div>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <DeviceReminders profile={me} />
          </div>
          <p className="text-sm text-muted-foreground">Kids turn reminders on from the Me page on their own phone or tablet. Times use {draft.reminders.timeZone.replace(/_/g, " ")} time.</p>
        </Group>

        <Group icon={<Lightbulb className="h-5 w-5" />} title="Chore ideas">
          <Toggle label="Age-appropriate ideas" hint="Chore ideas that fit each kid's age are marked with their name." checked={draft.suggestions.ageBased} onChange={(on) => set("suggestions", { ageBased: on })} />
          {draft.suggestions.ageBased && kidsWithoutAge.length > 0 ? (
            <p className="text-sm text-muted-foreground">Add a birth year for {kidsWithoutAge.map((kid) => kid.display_name).join(", ")} in their profile on the Family page.</p>
          ) : null}
        </Group>

        <Group icon={<PartyPopper className="h-5 w-5" />} title="Celebrations">
          <Toggle label="Celebration animations" checked={draft.celebrations.animations} onChange={(on) => set("celebrations", { animations: on })} />
          <Toggle label="Celebration sounds" checked={draft.celebrations.sounds} onChange={(on) => set("celebrations", { sounds: on })} />
          <Toggle label={'"All done today" trophy'} hint="The big celebration when a kid finishes every daily chore." checked={draft.celebrations.allDoneTrophy} onChange={(on) => set("celebrations", { allDoneTrophy: on })} />
        </Group>
      </div>
    </Sheet>
  )
}

function Group({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-[22px] bg-card p-4 shadow-soft sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold"><span className="text-primary">{icon}</span>{title}</h3>
      {children}
    </section>
  )
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span><span className="block font-bold">{label}</span>{hint ? <span className="block text-sm text-muted-foreground">{hint}</span> : null}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  )
}
