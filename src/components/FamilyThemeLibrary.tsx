import { useState } from "react"
import { Check, Image, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ProfileThemeTile } from "@/components/ProfileThemeTile"
import { THEME_OPTIONS, type FamilyProfile } from "@/lib/familyTypes"
import { overskill } from "@/lib/auth"

interface FamilyThemeLibraryProps {
  profiles: FamilyProfile[]
  onRefresh: () => Promise<void>
}

export function FamilyThemeLibrary({ profiles, onRefresh }: FamilyThemeLibraryProps) {
  const [profileId, setProfileId] = useState(profiles.find((profile) => profile.profile_type === "child")?.id ?? profiles[0]?.id ?? "")
  const [savingTheme, setSavingTheme] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const selectedProfile = profiles.find((profile) => profile.id === profileId)

  const applyTheme = async (themeKey: string) => {
    if (!selectedProfile) return
    setSavingTheme(themeKey)
    setError(null)
    try {
      await overskill.entities.family_profile.update(selectedProfile.id, { theme_key: themeKey })
      await onRefresh()
    } catch (caught) {
      console.error("Theme update failed:", caught)
      setError("We couldn't apply that theme. Please try again.")
    } finally {
      setSavingTheme(null)
    }
  }

  return (
    <section className="space-y-6" aria-labelledby="themes-heading" data-element-id="family-theme-library">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary"><Image className="h-5 w-5" /></span><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Make each profile feel theirs</p><h2 id="themes-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Theme library</h2><p className="mt-1 text-sm text-muted-foreground">Choose a profile, then apply one of the included themes.</p></div></div>
        <label className="mt-5 block max-w-sm space-y-2 text-sm font-medium text-card-foreground">Apply theme to<select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm">{profiles.filter((profile) => profile.is_active !== false).map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}</select></label>
        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}
      </div>
      <section className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="free-themes-heading">
        <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Included</p><h3 id="free-themes-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Free themes</h3></div><span className="text-sm text-muted-foreground">{THEME_OPTIONS.length} available</span></div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{THEME_OPTIONS.map((theme) => {
          const selected = selectedProfile?.theme_key === theme.key
          return <article key={theme.key} className="min-w-0 rounded-2xl border border-border p-3"><ProfileThemeTile themeKey={theme.key} selected={selected} onSelect={() => void applyTheme(theme.key)} /><div className="px-1 pb-1 pt-3"><h4 className="font-semibold text-card-foreground">{theme.label}</h4><p className="mt-1 min-h-10 text-sm leading-5 text-muted-foreground">{theme.description}</p><Button type="button" size="sm" variant={selected ? "secondary" : "outline"} className="mt-3 w-full" onClick={() => void applyTheme(theme.key)} disabled={!selectedProfile || savingTheme !== null}>{selected ? <><Check className="h-4 w-4" />Selected</> : savingTheme === theme.key ? "Applying…" : "Apply theme"}</Button></div></article>
        })}</div>
      </section>
      <section className="rounded-3xl border border-dashed border-border bg-muted/40 p-5 sm:p-6" aria-labelledby="paid-themes-heading"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Sparkles className="h-5 w-5" /></span><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Separate collection</p><h3 id="paid-themes-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Paid themes</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A separate paid theme collection is planned. It is not offered for purchase yet; no checkout is shown until its pricing is set up.</p></div></div></section>
    </section>
  )
}
