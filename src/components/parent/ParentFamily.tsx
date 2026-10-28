import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Check, ChevronRight, CreditCard, HeartHandshake, KeyRound, LifeBuoy, LogOut, Plus, Settings, Share2, ShieldCheck, SlidersHorizontal, UserRoundCog, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AppearancePicker, Avatar, Chip, ErrorNote, Field, inputClass, Segmented, Sheet } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { FamilyLogins } from "@/components/parent/FamilyLogins"
import { ThemePicker } from "@/components/ThemePicker"
import { FamilySettingsSheet } from "@/components/parent/FamilySettingsSheet"
import { BillingSheet } from "@/components/parent/Billing"
import { useBilling } from "@/lib/billing"
import { isAppAdmin } from "@/lib/catalog"
import { hashPin, isValidPin, type FamilyProfile, type ProfileType } from "@/lib/familyTypes"
import { choresFor, grownUpsOf, kidsOf } from "@/lib/family"
import { pointsBalance } from "@/lib/prizeRequests"
import { KID_THEME_IDS, ensureThemeFonts, getKidTheme } from "@/lib/themes"
import { getAuthToken } from "@/lib/auth"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"

export function ParentFamily({ profiles, inactiveProfiles, chores, completions, prizeRequests, sharingAvailable, onRefresh, onSwitchProfile, onSignOut }: ParentScreenProps) {
  const [editing, setEditing] = useState<{ profile: FamilyProfile | null; type: ProfileType } | null>(null)
  const [support, setSupport] = useState(false)
  const [share, setShare] = useState(false)
  const [rules, setRules] = useState(false)
  const [admin, setAdmin] = useState(false)
  const [billing, setBilling] = useState(false)
  const { billingOn, subscription } = useBilling()
  useEffect(() => { void isAppAdmin().then(setAdmin) }, [])
  const [busy, setBusy] = useState<string | null>(null)
  const kids = kidsOf(profiles)
  const grownUps = grownUpsOf(profiles)

  const reactivate = async (profile: FamilyProfile) => {
    setBusy(profile.id)
    try {
      await db.family_profile.update(profile.id, { is_active: true })
      await onRefresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold sm:text-4xl">Family</h1>
        <p className="text-muted-foreground">Profiles, themes, PINs and your account.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Kids</h2>
              <Button size="sm" variant="outline" onClick={() => setEditing({ profile: null, type: "child" })}><Plus className="h-4 w-4" />Add kid</Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {kids.map((kid) => {
                const theme = getKidTheme(kid.theme_key)
                return (
                  <li key={kid.id}>
                    <button type="button" onClick={() => setEditing({ profile: kid, type: "child" })} className="flex w-full items-center gap-3 rounded-[22px] bg-card p-4 text-left shadow-soft">
                      <Avatar profile={kid} size={56} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-display text-xl font-semibold">{kid.display_name}</span>
                        <span className="block text-sm text-muted-foreground">{theme.name} · {choresFor(kid.id, chores, profiles).length} chores</span>
                        <span className="mt-1 inline-flex items-center gap-1 text-sm font-bold">{theme.token} {pointsBalance(kid.id, completions, prizeRequests)} {theme.tokenName}</span>
                      </span>
                      {kid.pin_hash ? <KeyRound className="h-4 w-4 text-muted-foreground" aria-label="Has a PIN" /> : null}
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    </button>
                  </li>
                )
              })}
              {kids.length === 0 ? <li className="rounded-[22px] bg-card p-5 text-muted-foreground shadow-soft sm:col-span-2">No kids yet. Add one to start giving out chores.</li> : null}
            </ul>
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Grown-ups</h2>
              <Button size="sm" variant="outline" onClick={() => setEditing({ profile: null, type: "parent" })}><Plus className="h-4 w-4" />Add grown-up</Button>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {grownUps.map((parent) => (
                <li key={parent.id}>
                  <button type="button" onClick={() => setEditing({ profile: parent, type: "parent" })} className="flex w-full items-center gap-3 rounded-[22px] bg-card p-4 text-left shadow-soft">
                    <Avatar profile={parent} size={48} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-display text-lg font-semibold">{parent.display_name}</span>
                      <span className="block text-sm text-muted-foreground">{parent.pin_hash ? "PIN on" : "No PIN"}</span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {sharingAvailable ? <FamilyLogins onLeft={() => void onRefresh()} /> : null}

          {inactiveProfiles.length > 0 ? (
            <section className="space-y-2 rounded-[22px] bg-muted/60 p-4">
              <h2 className="font-display text-lg font-semibold">Turned off</h2>
              {inactiveProfiles.map((profile) => (
                <div key={profile.id} className="flex items-center gap-3">
                  <Avatar profile={profile} size={36} className="opacity-60" />
                  <span className="flex-1 font-semibold">{profile.display_name}</span>
                  <Button size="sm" variant="outline" disabled={busy === profile.id} onClick={() => void reactivate(profile)}>Turn back on</Button>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <aside className="space-y-3">
          <h2 className="font-display text-xl font-semibold">Appearance</h2>
          <div className="rounded-[22px] bg-card p-3 shadow-soft">
            <AppearancePicker />
            <p className="px-1 pt-2 text-sm text-muted-foreground">For grown-up screens. Kids always see their own theme.</p>
          </div>
          <h2 className="pt-2 font-display text-xl font-semibold">More</h2>
          <ul className="overflow-hidden rounded-[22px] bg-card shadow-soft">
            <MenuRow icon={<SlidersHorizontal className="h-5 w-5" />} label="Family settings" onClick={() => setRules(true)} />
            {billingOn || subscription ? <MenuRow icon={<CreditCard className="h-5 w-5" />} label="Plan and billing" onClick={() => setBilling(true)} /> : null}
            {admin ? <li><Link to="/admin" className="flex min-h-14 items-center gap-3 border-t border-border px-4 font-semibold hover:bg-muted/60"><span className="text-primary"><ShieldCheck className="h-5 w-5" /></span><span className="flex-1">Company admin</span><ChevronRight className="h-5 w-5 text-muted-foreground" /></Link></li> : null}
            <MenuRow icon={<LifeBuoy className="h-5 w-5" />} label="Help and ideas" onClick={() => setSupport(true)} />
            <MenuRow icon={<Share2 className="h-5 w-5" />} label="Share with a friend" onClick={() => setShare(true)} />
            <li><Link to="/settings" className="flex min-h-14 items-center gap-3 border-t border-border px-4 font-semibold hover:bg-muted/60"><span className="text-primary"><Settings className="h-5 w-5" /></span><span className="flex-1">Account settings</span><ChevronRight className="h-5 w-5 text-muted-foreground" /></Link></li>
            <MenuRow icon={<Users className="h-5 w-5" />} label="Switch profile" onClick={onSwitchProfile} />
            <MenuRow icon={<LogOut className="h-5 w-5" />} label="Log out" onClick={onSignOut} danger />
          </ul>
        </aside>
      </div>

      <ProfileSheet state={editing} onClose={() => setEditing(null)} profiles={profiles} onRefresh={onRefresh} />
      <SupportSheet open={support} onOpenChange={setSupport} />
      <BillingSheet open={billing} onOpenChange={setBilling} />
      <FamilySettingsSheet open={rules} onOpenChange={setRules} profiles={profiles} chores={chores} onRefresh={onRefresh} />
      <ShareSheet open={share} onOpenChange={setShare} />
    </div>
  )
}

function MenuRow({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <li className="border-t border-border first:border-t-0">
      <button type="button" onClick={onClick} className={cn("flex min-h-14 w-full items-center gap-3 px-4 text-left font-semibold hover:bg-muted/60", danger && "text-coral")}>
        <span className={danger ? "" : "text-primary"}>{icon}</span><span className="flex-1">{label}</span>{danger ? null : <ChevronRight className="h-5 w-5 text-muted-foreground" />}
      </button>
    </li>
  )
}

function ProfileSheet({ state, onClose, profiles, onRefresh }: { state: { profile: FamilyProfile | null; type: ProfileType } | null; onClose: () => void; profiles: FamilyProfile[]; onRefresh: () => Promise<void> }) {
  const profile = state?.profile ?? null
  const [name, setName] = useState("")
  const [type, setType] = useState<ProfileType>("child")
  const [themeKey, setThemeKey] = useState("sunny-room")
  const [pin, setPin] = useState("")
  const [clearPin, setClearPin] = useState(false)
  const [birthYear, setBirthYear] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!state) return
    setName(profile?.display_name ?? "")
    setType(profile?.profile_type ?? state.type)
    setThemeKey(profile?.theme_key ?? "sunny-room")
    setPin("")
    setClearPin(false)
    setBirthYear(profile?.birth_year ? String(profile.birth_year) : "")
    setError(null)
    KID_THEME_IDS.forEach(ensureThemeFonts)
  }, [state, profile])

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

  const save = async () => {
    if (!name.trim()) return setError("Add a name.")
    if (pin && !isValidPin(pin)) return setError("A PIN is 4 numbers.")
    const pinUpdate = pin ? { pin_hash: await hashPin(pin) } : clearPin ? { pin_hash: "" } : {}
    const year = Number(birthYear)
    const thisYear = new Date().getFullYear()
    if (birthYear && (!Number.isInteger(year) || year < thisYear - 25 || year > thisYear)) return setError("Enter a birth year like 2017.")
    // Only sent when used, so profiles still save on a database without the birth_year column.
    const yearUpdate = type === "child" && (birthYear || profile?.birth_year) ? { birth_year: birthYear ? year : null } : {}
    const data = { display_name: name.trim(), profile_type: type, theme_key: themeKey, ...pinUpdate, ...yearUpdate }
    void run(() => profile ? db.family_profile.update(profile.id, data) : db.family_profile.create({ pin_hash: "", ...data, is_active: true }), "We couldn't save that profile.")
  }

  const turnOff = () => {
    const parents = profiles.filter((item) => item.profile_type === "parent").length
    if (profile?.profile_type === "parent" && parents <= 1) return setError("Keep at least one grown-up profile on.")
    if (profile) void run(() => db.family_profile.update(profile.id, { is_active: false }), "We couldn't turn off that profile.")
  }

  return (
    <Sheet open={Boolean(state)} onOpenChange={(open) => { if (!open) onClose() }} wide title={profile ? `Edit ${profile.display_name}` : type === "child" ? "Add a kid" : "Add a grown-up"} footer={
      <div className="space-y-3">
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-3">
          {profile ? <Button variant="ghost" disabled={saving} onClick={turnOff} className="text-coral hover:bg-coral/10 hover:text-coral">Turn off</Button> : null}
          <Button onClick={() => void save()} disabled={saving} className="flex-1"><Check className="h-5 w-5" />{saving ? "Saving..." : "Save"}</Button>
        </div>
      </div>
    }>
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar profile={{ id: "preview", display_name: name || "?", profile_type: type, theme_key: themeKey }} size={72} />
          <Field label="Name" className="flex-1"><input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} placeholder={type === "child" ? "Ava" : "Sarah"} maxLength={40} /></Field>
        </div>
        <div className="space-y-1.5">
          <span className="block text-sm font-bold">Profile type</span>
          <Segmented value={type} onChange={setType} options={[{ value: "child", label: "Kid" }, { value: "parent", label: "Grown-up" }]} className="max-w-xs" />
        </div>
        {type === "child" ? (
          <div className="space-y-2">
            <span className="block text-sm font-bold">Theme</span>
            <ThemePicker value={themeKey} onChange={setThemeKey} kidName={name.trim() || "Kid"} />
            <Field label="Birth year (optional)" hint="Used to suggest chores that fit their age." className="max-w-48">
              <input className={inputClass} value={birthYear} onChange={(event) => setBirthYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="2017" aria-label="Birth year" />
            </Field>
          </div>
        ) : null}
        <div className="space-y-2 rounded-2xl bg-muted/60 p-4">
          <p className="flex items-center gap-2 font-bold"><UserRoundCog className="h-4 w-4 text-primary" />PIN</p>
          <p className="text-sm text-muted-foreground">{profile?.pin_hash && !clearPin ? "This profile has a PIN. Type a new one to change it." : type === "child" ? "Kids can pick their own the first time, or you can set one here." : "Add a PIN so kids can't open parent mode."}</p>
          <input className={cn(inputClass, "max-w-40 text-center font-display text-xl tracking-[0.5em]")} value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="off" placeholder="••••" aria-label="New PIN" />
          {profile?.pin_hash ? <Chip active={clearPin} onClick={() => { setClearPin((on) => !on); setPin("") }}>{clearPin ? <Check className="h-4 w-4" /> : null}Remove PIN</Chip> : null}
        </div>
      </div>
    </Sheet>
  )
}

async function postJson(url: string, body: unknown, fallback: string) {
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data.success) throw new Error(`${data.error || fallback}${data.ref ? ` (ref: ${data.ref})` : ""}`)
  return data
}

function SupportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [kind, setKind] = useState<"support" | "feature">("support")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => { if (open) { setSent(false); setError(null) } }, [open])

  const send = async () => {
    if (!subject.trim() || !message.trim()) return setError("Add a subject and a message.")
    setSending(true)
    setError(null)
    try {
      await postJson("/api/support/request", { kind, subject: subject.trim(), message: message.trim() }, "We couldn't send your message.")
      setSent(true)
      setSubject("")
      setMessage("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't send your message.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Help and ideas" description="Ask a question or tell us what would make the app better." footer={sent ? <Button onClick={() => onOpenChange(false)} className="w-full">Done</Button> : <Button onClick={() => void send()} disabled={sending} className="w-full">{sending ? "Sending..." : "Send"}</Button>}>
      {sent ? (
        <div className="py-6 text-center"><HeartHandshake className="mx-auto h-12 w-12 text-primary" /><p className="mt-3 font-display text-xl font-semibold">Thanks! We got it.</p><p className="text-muted-foreground">We'll reply by email.</p></div>
      ) : (
        <div className="space-y-4">
          <Segmented value={kind} onChange={setKind} options={[{ value: "support", label: "I need help" }, { value: "feature", label: "I have an idea" }]} />
          <Field label="Subject"><input className={inputClass} value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={120} /></Field>
          <Field label="Message" hint={`${message.length}/5000`}><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={5} maxLength={5000} /></Field>
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </Sheet>
  )
}

function ShareSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [addresses, setAddresses] = useState("")
  const [message, setMessage] = useState("Our family uses Responsibilities App to keep chores, progress and rewards organized. Take a look!")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => { if (open) { setNotice(null); setError(null) } }, [open])

  const send = async () => {
    const emails = addresses.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean)
    if (emails.length === 0 || emails.length > 5) return setError("Enter between one and five email addresses.")
    setSending(true)
    setError(null)
    try {
      const data = await postJson("/api/family/invite", { emails, message: message.trim() }, "We couldn't send the invitation.")
      setNotice(`Sent to ${data.accepted} ${data.accepted === 1 ? "friend" : "friends"}.`)
      setAddresses("")
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We couldn't send the invitation.")
    } finally {
      setSending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Share with a friend" description="We'll email them a short note from you." footer={<Button onClick={() => void send()} disabled={sending} className="w-full"><Share2 className="h-5 w-5" />{sending ? "Sending..." : "Send invite"}</Button>}>
      <div className="space-y-4">
        <Field label="Email addresses" hint="Up to five, separated by commas."><input className={inputClass} value={addresses} onChange={(event) => setAddresses(event.target.value)} placeholder="friend@example.com" inputMode="email" /></Field>
        <Field label="Message"><Textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={3} maxLength={500} /></Field>
        <ErrorNote>{error}</ErrorNote>
        {notice ? <p className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success" role="status">{notice}</p> : null}
      </div>
    </Sheet>
  )
}
