import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, Delete, Lock, RotateCcw } from "lucide-react"
import { Avatar, MASCOT } from "@/components/kit"
import { hashPin, type FamilyProfile } from "@/lib/familyTypes"
import { firstName, grownUpsOf, kidsOf } from "@/lib/family"
import { pointsBalance, type PrizeRequest } from "@/lib/prizeRequests"
import { ensureThemeFonts, getKidTheme, kidThemeStyle } from "@/lib/themes"
import type { ChoreCompletionRecord } from "@/lib/familyTypes"
import { cn } from "@/lib/utils"

interface WhoIsHereProps {
  profiles: FamilyProfile[]
  completions: ChoreCompletionRecord[]
  prizeRequests: PrizeRequest[]
  onUnlocked: (profile: FamilyProfile) => void
  onSetPin: (profileId: string, pinHash: string) => Promise<void>
  onSignOut: () => void
}

export function WhoIsHere({ profiles, completions, prizeRequests, onUnlocked, onSetPin, onSignOut }: WhoIsHereProps) {
  const [selected, setSelected] = useState<FamilyProfile | null>(null)
  const kids = kidsOf(profiles)
  const grownUps = grownUpsOf(profiles)

  useEffect(() => { kids.forEach((kid) => ensureThemeFonts(kid.theme_key)) }, [kids])

  const choose = (profile: FamilyProfile) => {
    if (profile.profile_type === "parent" && !profile.pin_hash) {
      onUnlocked(profile)
      return
    }
    setSelected(profile)
  }

  if (selected) {
    return <PinScreen profile={selected} onBack={() => setSelected(null)} onUnlocked={onUnlocked} onSetPin={onSetPin} />
  }

  return (
    <main className="min-h-dvh bg-background px-4 pb-10 pt-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <header className="text-center">
          <span className="float-soft inline-block text-6xl" aria-hidden="true">{MASCOT}</span>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Who's here?</h1>
          <p className="mt-2 text-lg text-muted-foreground">Pick your profile to see your chores and stars.</p>
        </header>

        {kids.length > 0 ? (
          <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {kids.map((kid) => {
              const theme = getKidTheme(kid.theme_key)
              return (
                <li key={kid.id}>
                  <button
                    type="button"
                    onClick={() => choose(kid)}
                    className="flex w-full flex-col items-center rounded-[26px] px-3 pb-5 pt-6 shadow-soft transition-transform hover:-translate-y-1 active:scale-[0.97]"
                    style={{ ...kidThemeStyle(kid.theme_key), backgroundColor: theme.colors.bg, color: theme.colors.ink }}
                  >
                    <span className="relative">
                      <Avatar profile={kid} size={88} ring />
                      {kid.pin_hash ? <span className="absolute -left-1 top-0 grid h-7 w-7 place-items-center rounded-full bg-white text-[#2D2A4A] shadow-soft"><Lock className="h-3.5 w-3.5" /><span className="sr-only">Has a PIN</span></span> : null}
                    </span>
                    <span className="mt-3 font-display text-2xl font-semibold">{kid.display_name}</span>
                    <span className="mt-2 rounded-full px-3 py-1 text-sm font-bold" style={{ background: theme.colors.surface, color: theme.colors.ink }}>
                      {theme.token} {pointsBalance(kid.id, completions, prizeRequests)} {theme.tokenName}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {grownUps.length > 0 ? (
          <section className="mt-10">
            <h2 className="text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Grown-ups</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {grownUps.map((parent) => (
                <li key={parent.id}>
                  <button type="button" onClick={() => choose(parent)} className="flex w-full items-center gap-3 rounded-[20px] bg-card p-3 text-left shadow-soft transition-transform active:scale-[0.97]">
                    <Avatar profile={parent} size={44} />
                    <span className="min-w-0">
                      <span className="block truncate font-display text-lg font-semibold">{parent.display_name}</span>
                      <span className="block text-xs font-bold text-primary">Parent mode</span>
                    </span>
                    {parent.pin_hash ? <Lock className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" aria-label="Has a PIN" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className="mt-10 text-center">
          <button type="button" onClick={onSignOut} className="text-sm font-bold text-muted-foreground underline underline-offset-4 hover:text-foreground">Switch family account</button>
        </div>
      </div>
    </main>
  )
}

function PinScreen({ profile, onBack, onUnlocked, onSetPin }: { profile: FamilyProfile; onBack: () => void; onUnlocked: (profile: FamilyProfile) => void; onSetPin: (profileId: string, pinHash: string) => Promise<void> }) {
  const creating = !profile.pin_hash
  const [pin, setPin] = useState("")
  const [firstPin, setFirstPin] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [busy, setBusy] = useState(false)
  const isKid = profile.profile_type === "child"
  const theme = getKidTheme(profile.theme_key)

  const fail = (message: string) => {
    setError(message)
    setShake((count) => count + 1)
    setPin("")
  }

  const submit = async (code: string) => {
    setBusy(true)
    try {
      const hash = await hashPin(code)
      if (!creating) {
        if (hash === profile.pin_hash) onUnlocked(profile)
        else fail("Oops, try again!")
        return
      }
      if (!firstPin) {
        setFirstPin(code)
        setPin("")
        setError(null)
        return
      }
      if (code !== firstPin) {
        setFirstPin(null)
        fail("Those didn't match. Let's start over.")
        return
      }
      await onSetPin(profile.id, hash)
      onUnlocked({ ...profile, pin_hash: hash })
    } catch (caught) {
      console.error("PIN check failed:", caught)
      fail("Something went wrong. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const press = (digit: string) => {
    if (busy || pin.length >= 4) return
    const next = pin + digit
    setPin(next)
    setError(null)
    if (next.length === 4) void submit(next)
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^\d$/.test(event.key)) press(event.key)
      else if (event.key === "Backspace") setPin((current) => current.slice(0, -1))
      else if (event.key === "Escape") onBack()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  })

  const heading = creating ? (firstPin ? "Type it one more time" : "Pick a secret code") : isKid ? `Hi ${firstName(profile)}!` : `Hi ${firstName(profile)}`
  const sub = creating ? "Choose 4 numbers only you and your grown-up know." : "Type your secret code"

  return (
    <main className="flex min-h-dvh flex-col bg-background px-4 pb-8 pt-4 text-foreground" style={isKid ? kidThemeStyle(profile.theme_key) : undefined}>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col">
        <button type="button" onClick={onBack} className="grid h-12 w-12 place-items-center rounded-full bg-card text-foreground shadow-soft" aria-label="Back to profiles"><ArrowLeft className="h-5 w-5" /></button>
        <div className="mt-4 flex flex-col items-center text-center">
          <Avatar profile={profile} size={96} ring />
          <h1 className="mt-4 font-display text-4xl font-semibold">{heading}</h1>
          <p className="mt-1 text-lg text-muted-foreground">{sub}</p>
        </div>
        <div key={shake} className={cn("mt-8 flex justify-center gap-4", shake > 0 && "pin-shake")} aria-live="polite" aria-label={`${pin.length} of 4 digits entered`}>
          {[0, 1, 2, 3].map((index) => (
            <span key={index} className={cn("grid h-14 w-14 place-items-center rounded-full text-2xl transition-colors", index < pin.length ? "bg-accent" : "bg-muted", error && "bg-coral/20")} aria-hidden="true">
              {index < pin.length ? theme.token : ""}
            </span>
          ))}
        </div>
        <p className={cn("mt-4 min-h-6 text-center font-bold", error ? "text-coral" : "text-transparent")} role={error ? "alert" : undefined}>{error ?? "."}</p>
        <div className="mx-auto mt-4 grid w-full max-w-[19rem] grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => <Key key={digit} onClick={() => press(digit)}>{digit}</Key>)}
          <Key onClick={() => { setPin(""); setError(null) }} label="Clear"><RotateCcw className="h-6 w-6" /></Key>
          <Key onClick={() => press("0")}>0</Key>
          <Key onClick={() => setPin((current) => current.slice(0, -1))} label="Delete" className="bg-coral/15 text-coral"><Delete className="h-6 w-6" /></Key>
        </div>
        {!creating && isKid ? <p className="mt-6 text-center text-sm font-bold text-muted-foreground">Forgot your code? Ask a grown-up.</p> : null}
      </div>
    </main>
  )
}

function Key({ children, onClick, label, className }: { children: ReactNode; onClick: () => void; label?: string; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("grid aspect-square place-items-center rounded-full bg-card font-display text-3xl font-semibold shadow-soft transition-transform active:scale-90", className)}>
      {children}
    </button>
  )
}
