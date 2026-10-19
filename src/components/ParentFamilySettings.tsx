import { useCallback, useEffect, useState, type FormEvent } from "react"
import { Edit, Key, Plus, Save, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { overskill, useAuth } from "@/lib/auth"
import { hashPin, isValidPin, type FamilyProfile, type ProfileType, THEME_OPTIONS } from "@/lib/familyTypes"

type LoadStatus = "loading" | "success" | "error" | "signed-out"
type ProfileDraft = { display_name: string; profile_type: ProfileType; theme_key: string; pin: string }

export function ParentFamilySettings() {
  const { user, loading: authLoading } = useAuth()
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [status, setStatus] = useState<LoadStatus>("loading")
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProfileDraft | null>(null)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<ProfileType>("child")
  const [newTheme, setNewTheme] = useState<string>(THEME_OPTIONS[0].key)
  const [newPin, setNewPin] = useState("")
  const [saving, setSaving] = useState(false)

  const loadProfiles = useCallback(async () => {
    if (!user) {
      setStatus("signed-out")
      return
    }
    setStatus("loading")
    setError(null)
    try {
      const rows = await overskill.entities.family_profile.list({ orderBy: "-created_at", all: true })
      setProfiles(rows as unknown as FamilyProfile[])
      setStatus("success")
    } catch (caught) {
      console.error("Family profile settings load failed:", caught)
      setStatus("error")
      setError("We couldn't load family profiles. Please try again.")
    }
  }, [user])

  useEffect(() => {
    if (authLoading) {
      setStatus("loading")
      return
    }
    if (!user) {
      setStatus("signed-out")
      return
    }
    void loadProfiles()
  }, [authLoading, user, loadProfiles])

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !newName.trim() || (newPin && !isValidPin(newPin))) return
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.family_profile.create({
        display_name: newName.trim(),
        profile_type: newType,
        theme_key: newTheme,
        pin_hash: newPin ? await hashPin(newPin) : "",
        is_active: true,
      })
      setNewName("")
      setNewPin("")
      await loadProfiles()
    } catch (caught) {
      console.error("Family profile creation failed:", caught)
      setError("We couldn't add that family profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (profile: FamilyProfile) => {
    setEditingId(profile.id)
    setDraft({ display_name: profile.display_name, profile_type: profile.profile_type, theme_key: profile.theme_key, pin: "" })
    setError(null)
  }

  const saveEdit = async (profile: FamilyProfile) => {
    if (!user || !draft || !draft.display_name.trim() || (draft.pin && !isValidPin(draft.pin))) return
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.family_profile.update(profile.id, {
        display_name: draft.display_name.trim(),
        profile_type: draft.profile_type,
        theme_key: draft.theme_key,
        ...(draft.pin ? { pin_hash: await hashPin(draft.pin) } : {}),
      })
      setEditingId(null)
      setDraft(null)
      await loadProfiles()
    } catch (caught) {
      console.error("Family profile update failed:", caught)
      setError("We couldn't save that profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const deactivateProfile = async (profile: FamilyProfile) => {
    if (!user || profile.is_active === false) return
    const activeParentCount = profiles.filter((item) => item.is_active !== false && item.profile_type === "parent").length
    if (profile.profile_type === "parent" && activeParentCount <= 1) {
      setError("You must keep at least one parent profile active.")
      return
    }
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.family_profile.update(profile.id, { is_active: false })
      await loadProfiles()
    } catch (caught) {
      console.error("Family profile deactivation failed:", caught)
      setError("We couldn't deactivate that profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const reactivateProfile = async (profile: FamilyProfile) => {
    if (!user || profile.is_active === true) return
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.family_profile.update(profile.id, { is_active: true })
      await loadProfiles()
    } catch (caught) {
      console.error("Family profile reactivation failed:", caught)
      setError("We couldn't reactivate that profile. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="family-profiles-settings-heading" data-element-id="family-profiles-settings">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Users className="h-5 w-5" /></span>
        <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Parent controls</p><h2 id="family-profiles-settings-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Family profiles</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Manage the parent and child profiles used on this household device. Child profiles use a PIN; they are not separate Overskill sign-ins.</p></div>
      </div>

      {status === "loading" ? <p className="mt-6 text-sm text-muted-foreground">Loading family profiles…</p> : null}
      {status === "signed-out" ? <p className="mt-6 text-sm text-muted-foreground">Sign in as the parent account to manage this family.</p> : null}
      {status === "error" ? <div className="mt-6"><p className="text-sm text-destructive" role="alert">{error}</p><Button type="button" variant="outline" className="mt-3" onClick={() => void loadProfiles()}>Try again</Button></div> : null}

      {status === "success" ? <>
        <div className="mt-6 space-y-3">
          {profiles.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No family profiles yet. Add the first parent or child profile below.</p> : profiles.map((profile) => {
            const isEditing = editingId === profile.id && draft !== null
            const isInactive = profile.is_active === false
            const activeParentCount = profiles.filter((item) => item.is_active !== false && item.profile_type === "parent").length
            return <article key={profile.id} className="min-w-0 rounded-2xl border border-border p-4" data-element-id={`family-profile-${profile.id}`}>
              {isEditing ? <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium text-card-foreground">Name<Input value={draft.display_name} onChange={(event) => setDraft({ ...draft, display_name: event.target.value })} /></label>
                <label className="space-y-1.5 text-sm font-medium text-card-foreground">Profile type<select value={draft.profile_type} onChange={(event) => setDraft({ ...draft, profile_type: event.target.value as ProfileType })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="parent">Parent</option><option value="child">Child</option></select></label>
                <label className="space-y-1.5 text-sm font-medium text-card-foreground">Theme<select value={draft.theme_key} onChange={(event) => setDraft({ ...draft, theme_key: event.target.value })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{THEME_OPTIONS.map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</select></label>
                <label className="space-y-1.5 text-sm font-medium text-card-foreground">Reset PIN (optional)<Input type="password" inputMode="numeric" value={draft.pin} onChange={(event) => setDraft({ ...draft, pin: event.target.value })} placeholder="Leave blank to keep current PIN" /><span className="block text-xs text-muted-foreground">Enter a new four-digit PIN to replace the current one.</span></label>
                <div className="flex items-center gap-2 sm:col-span-2"><Button type="button" onClick={() => void saveEdit(profile)} disabled={saving || !draft.display_name.trim() || (!!draft.pin && !isValidPin(draft.pin))}><Save className="h-4 w-4" />{saving ? "Saving…" : "Save profile"}</Button><Button type="button" variant="outline" onClick={() => { setEditingId(null); setDraft(null) }}><X className="h-4 w-4" />Cancel</Button>{draft.pin && !isValidPin(draft.pin) ? <span className="text-sm text-destructive">PIN must be exactly four digits.</span> : null}</div>
              </div> : isInactive ? <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{profile.display_name}</h3><p className="mt-1 text-sm capitalize text-muted-foreground">{profile.profile_type} · {THEME_OPTIONS.find((theme) => theme.key === profile.theme_key)?.label ?? "Family theme"}{profile.profile_type === "child" ? ` · ${profile.pin_hash ? "PIN protected" : "No PIN set"}` : ""}</p><span className="mt-1 inline-block text-xs font-medium text-muted-foreground">Inactive</span></div><Button type="button" variant="outline" size="sm" onClick={() => reactivateProfile(profile)} disabled={saving}><Save className="h-4 w-4" />Reactivate</Button></div> : <div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-semibold text-card-foreground">{profile.display_name}</h3><p className="mt-1 text-sm capitalize text-muted-foreground">{profile.profile_type} · {THEME_OPTIONS.find((theme) => theme.key === profile.theme_key)?.label ?? "Family theme"}{profile.profile_type === "child" ? ` · ${profile.pin_hash ? "PIN protected" : "No PIN set"}` : ""}</p></div><div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" onClick={() => startEdit(profile)} disabled={saving}><Edit className="h-4 w-4" />Edit</Button><Button type="button" variant="outline" size="sm" onClick={() => deactivateProfile(profile)} disabled={saving || (profile.profile_type === "parent" && activeParentCount <= 1)} title={profile.profile_type === "parent" && activeParentCount <= 1 ? "Keep at least one parent profile active" : "Deactivate profile"}><X className="h-4 w-4" />Deactivate</Button></div></div>}
            </article>
          })}
        </div>

        <form onSubmit={createProfile} className="mt-6 rounded-2xl bg-muted/60 p-4" data-element-id="settings-add-family-profile">
          <h3 className="font-semibold text-card-foreground">Add a family profile</h3>
          <div className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="space-y-1.5 text-sm font-medium text-card-foreground">Name<Input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Child or parent name" /></label>
            <label className="space-y-1.5 text-sm font-medium text-card-foreground">Profile type<select value={newType} onChange={(event) => setNewType(event.target.value as ProfileType)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="child">Child</option><option value="parent">Parent</option></select></label>
            <label className="space-y-1.5 text-sm font-medium text-card-foreground">Theme<select value={newTheme} onChange={(event) => setNewTheme(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{THEME_OPTIONS.map((theme) => <option key={theme.key} value={theme.key}>{theme.label}</option>)}</select></label>
            <label className="space-y-1.5 text-sm font-medium text-card-foreground">PIN (optional)<span className="relative block"><Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input type="password" inputMode="numeric" value={newPin} onChange={(event) => setNewPin(event.target.value)} placeholder="Four digits" className="pl-9" /></span></label>
          </div>
          {newPin && !isValidPin(newPin) ? <p className="mt-2 text-sm text-destructive">PIN must be exactly four digits.</p> : null}
          {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" disabled={saving || !newName.trim() || (!!newPin && !isValidPin(newPin))} className="mt-4"><Plus className="h-4 w-4" />{saving ? "Adding…" : "Add profile"}</Button>
        </form>
      </> : null}
    </section>
  )
}
