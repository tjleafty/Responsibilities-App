import { useState } from "react"
import { ArrowRight, User, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ProfileThemeTile } from "@/components/ProfileThemeTile"
import { type FamilyProfile, hashPin, isValidPin } from "@/lib/familyTypes"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface ProfileLoginScreenProps {
  profiles: FamilyProfile[]
  onUnlocked: (profile: FamilyProfile) => void
  onSetPin: (profileId: string, pinHash: string) => Promise<void>
}

export function ProfileLoginScreen({ profiles, onUnlocked, onSetPin }: ProfileLoginScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pin, setPin] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [open, setOpen] = useState(false)
  const selected = profiles.find((profile) => profile.id === selectedId) ?? null

  const chooseProfile = (profile: FamilyProfile) => {
    setSelectedId(profile.id)
    setPin("")
    setError(null)
    setOpen(true)
    if (profile.profile_type === "parent" && !profile.pin_hash) {
      onUnlocked(profile)
    }
  }

  const continueToProfile = async () => {
    if (!selected) return
    setError(null)
    if (selected.profile_type === "parent" && !selected.pin_hash) {
      onUnlocked(selected)
      return
    }
    if (!isValidPin(pin)) {
      setError("Enter exactly 4 digits to continue.")
      return
    }
    setSaving(true)
    try {
      const pinHash = await hashPin(pin)
      if (!selected.pin_hash) {
        await onSetPin(selected.id, pinHash)
        onUnlocked({ ...selected, pin_hash: pinHash })
      } else if (pinHash === selected.pin_hash) {
        onUnlocked(selected)
      } else {
        setError("That PIN does not match this profile.")
      }
    } catch (caught) {
      console.error("Profile PIN action failed:", caught)
      setError("We couldn't save that PIN. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mx-auto max-w-5xl" aria-labelledby="profile-login-heading" data-element-id="profile-login-screen">
      <div className="mb-8 max-w-2xl">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-primary">Family check-in</p>
        <h1 id="profile-login-heading" className="font-display text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Who is on a quest today?
        </h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">Choose a profile to open its chores, goals, and theme.</p>
      </div>

      <div className="quest-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-element-id="profile-chooser-grid">
        {profiles.map((profile) => {
          const isSelected = selectedId === profile.id
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => chooseProfile(profile)}
              className={`min-w-0 rounded-3xl border bg-card p-3 text-left transition-[border-color,box-shadow,transform] duration-200 ${isSelected ? "border-primary shadow-lg ring-2 ring-primary/15" : "border-border hover:-translate-y-0.5 hover:border-primary/50"}`}
              data-element-id={`profile-card-${profile.id}`}
            >
              <ProfileThemeTile themeKey={profile.theme_key} />
              <div className="flex items-center justify-between gap-3 px-1 pb-1 pt-4">
                <span className="flex min-w-0 items-center gap-2">
                  {profile.profile_type === "parent" ? <Users className="h-4 w-4 shrink-0 text-primary" /> : <User className="h-4 w-4 shrink-0 text-primary" />}
                  <span className="truncate font-semibold text-card-foreground">{profile.display_name}</span>
                </span>
                <span className="shrink-0 text-xs font-medium capitalize text-muted-foreground">{profile.profile_type}</span>
              </div>
            </button>
          )
        })}
      </div>

      <Dialog open={open} onOpenChange={(open) => {
        if (!open) {
          setSelectedId(null)
          setPin("")
          setError(null)
        }
      }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.pin_hash ? `Enter ${selected.display_name}'s PIN` : `Choose a 4-digit PIN`}</DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-6 text-muted-foreground">
              {selected?.pin_hash ? "Enter this profile's existing four-digit PIN to continue." : "Choose a four-digit PIN for this profile. You will use it next time you open this profile."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); continueToProfile(); }}>
            <div className="mt-5 space-y-3">
              <Input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                type="password"
                inputMode="numeric"
                placeholder={selected?.pin_hash ? "Enter PIN" : "Create PIN"}
                aria-label={selected?.pin_hash ? `${selected.display_name}'s PIN` : "Choose a 4-digit PIN"}
                aria-describedby="pin-help"
                autoComplete="off"
              />
              <div className="flex items-center justify-between gap-3">
                <span id="pin-help" className={`text-xs ${pin.length > 4 ? "text-destructive" : "text-muted-foreground"}`}>{pin.length}/4 digits</span>
                <Button type="submit" disabled={saving} className="active:scale-[0.96]">{saving ? "Saving…" : "Continue"}<ArrowRight className="h-4 w-4" /></Button>
              </div>
              {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
