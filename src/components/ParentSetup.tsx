import { useRef, useState } from "react"
import { ArrowRight, UserRoundPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, Field, MASCOT, inputClass } from "@/components/kit"
import { PinScreen } from "@/components/WhoIsHere"
import type { FamilyProfile } from "@/lib/familyTypes"
import { grownUpsOf } from "@/lib/family"

interface ParentSetupProps {
  profiles: FamilyProfile[]
  suggestedName: string
  /** Creates this login's parent profile, or claims an existing one when claimId is set. */
  onSave: (details: { displayName: string; pinHash: string; claimId: string | null }) => Promise<FamilyProfile>
  onDone: (profile: FamilyProfile) => void
  onSignOut: () => void
}

/**
 * Parent profiles another grown-up added by hand, with no PIN yet. Each login's
 * first parent profile is its own, so it's never offered to someone else.
 */
function claimableProfiles(profiles: FamilyProfile[]) {
  const grownUps = grownUpsOf(profiles)
  const ownIds = new Set<string>()
  const seenOwners = new Set<string>()
  for (const profile of [...grownUps].sort((a, b) => String(a.created_at ?? "").localeCompare(String(b.created_at ?? "")))) {
    if (!profile.owner_id || seenOwners.has(profile.owner_id)) continue
    seenOwners.add(profile.owner_id)
    ownIds.add(profile.id)
  }
  return grownUps.filter((profile) => !profile.pin_hash && !ownIds.has(profile.id))
}

/** First time a login opens the family: make (or pick) its parent profile and set a PIN. */
export function ParentSetup({ profiles, suggestedName, onSave, onDone, onSignOut }: ParentSetupProps) {
  const claimable = claimableProfiles(profiles)
  const [claim, setClaim] = useState<FamilyProfile | null>(null)
  const [name, setName] = useState(suggestedName)
  const [step, setStep] = useState<"name" | "pin">("name")
  const [problem, setProblem] = useState<string | null>(null)
  const saved = useRef<FamilyProfile | null>(null)

  if (step === "pin") {
    const draft: FamilyProfile = claim
      ? { ...claim, display_name: name.trim(), pin_hash: "" }
      : { id: "new-parent", display_name: name.trim(), profile_type: "parent", theme_key: "sunny-room", pin_hash: "" }
    return (
      <PinScreen
        profile={draft}
        onBack={() => setStep("name")}
        onSetPin={async (_id, pinHash) => {
          saved.current = await onSave({ displayName: name.trim(), pinHash, claimId: claim?.id ?? null })
        }}
        onUnlocked={() => { if (saved.current) onDone(saved.current) }}
      />
    )
  }

  const next = () => {
    if (!name.trim()) return setProblem("Add your name so the family knows who you are.")
    setProblem(null)
    setStep("pin")
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-md rounded-[28px] bg-card p-6 shadow-soft sm:p-8">
        <div className="text-center">
          <span className="float-soft inline-block text-6xl" aria-hidden="true">{MASCOT}</span>
          <h1 className="mt-3 font-display text-3xl font-semibold">Set up your parent profile</h1>
          <p className="mt-2 text-muted-foreground">You'll pick a 4-number PIN next, so kids can't open parent mode.</p>
        </div>

        {claimable.length > 0 ? (
          <div className="mt-6">
            <p className="text-sm font-bold">Already on the family list?</p>
            <ul className="mt-2 space-y-2">
              {claimable.map((profile) => (
                <li key={profile.id}>
                  <button
                    type="button"
                    onClick={() => { setClaim(profile); setName(profile.display_name) }}
                    aria-pressed={claim?.id === profile.id}
                    className={`flex w-full items-center gap-3 rounded-[18px] border-2 p-3 text-left transition-colors ${claim?.id === profile.id ? "border-primary bg-primary/10" : "border-transparent bg-muted/70"}`}
                  >
                    <Avatar profile={profile} size={40} />
                    <span className="font-display text-lg font-semibold">That's me: {profile.display_name}</span>
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => { setClaim(null); setName(suggestedName) }}
                  aria-pressed={!claim}
                  className={`flex w-full items-center gap-3 rounded-[18px] border-2 p-3 text-left transition-colors ${!claim ? "border-primary bg-primary/10" : "border-transparent bg-muted/70"}`}
                >
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-card"><UserRoundPlus className="h-5 w-5 text-primary" /></span>
                  <span className="font-display text-lg font-semibold">I'm new here</span>
                </button>
              </li>
            </ul>
          </div>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); next() }}>
          <Field label="Your name" hint="Kids see this on the Who's here? screen.">
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" placeholder="Sarah" className={inputClass} />
          </Field>
          <ErrorNote>{problem}</ErrorNote>
          <Button type="submit" size="lg" className="w-full">Next: create your PIN<ArrowRight className="h-5 w-5" /></Button>
        </form>
      </section>
      <button type="button" onClick={onSignOut} className="mt-6 text-sm font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground">Not you? Sign out</button>
    </main>
  )
}
