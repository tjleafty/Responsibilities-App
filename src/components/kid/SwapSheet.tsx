import { useEffect, useMemo, useState } from "react"
import { ArrowLeftRight, Check, HandCoins, HandHelping, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, ErrorNote, Sheet, Stepper, TokenPill, inputClass } from "@/components/kit"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { choreState, choresFor, completionFor, firstName, kidsOf } from "@/lib/family"
import { chorePoints } from "@/lib/difficulty"
import { askForSwap, openSwapFor, type SwapKind } from "@/lib/swaps"
import { cn } from "@/lib/utils"

interface SwapSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  /** The kid's own chore to swap or hand off. Without it, the sheet offers a sibling's chore for bonus points. */
  chore: ChoreRecord | null
  balance: number
  token: string
  onSent: () => void
}

/** A kid asks to swap a chore, hand it to a sibling for points, or take on a sibling's chore for bonus points. */
export function SwapSheet({ open, onOpenChange, profile, profiles, chores, completions, chore, balance, token, onSent }: SwapSheetProps) {
  const siblings = kidsOf(profiles).filter((kid) => kid.id !== profile.id)
  const [siblingId, setSiblingId] = useState<string | null>(null)
  const [kind, setKind] = useState<SwapKind>(chore ? "swap" : "takeover")
  const [takeId, setTakeId] = useState<string | null>(null)
  const [points, setPoints] = useState(5)
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSiblingId(siblings.length === 1 ? siblings[0].id : null)
    setKind(chore ? "swap" : "takeover")
    setTakeId(null)
    setPoints(chore ? Math.min(5, Math.max(0, balance)) : 5)
    setMessage("")
    setError(null)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const sibling = siblings.find((kid) => kid.id === siblingId) ?? null
  // The sibling's chores they haven't started, and that aren't already part of another ask.
  const theirs = useMemo(() => (sibling ? choresFor(sibling.id, chores, profiles)
    .filter((item) => item.id !== chore?.id && choreState(completionFor(item, sibling.id, completions)) === "todo" && !openSwapFor(item, sibling.id)) : []), [sibling, chores, profiles, completions, chore])
  const take = theirs.find((item) => item.id === takeId) ?? null
  const needsTake = kind === "swap" || kind === "takeover"
  const ready = !!sibling && (!needsTake || !!take) && (kind !== "handoff" || (points > 0 && points <= balance))

  const send = async () => {
    if (!sibling) return
    setBusy(true)
    setError(null)
    try {
      await askForSwap({ kind, from: profile, to: sibling, give: kind === "takeover" ? null : chore, take: needsTake ? take : null, points: kind === "swap" ? 0 : points, message })
      onSent()
      onOpenChange(false)
    } catch (caught) {
      console.error("Asking for a swap failed:", caught)
      setError("That didn't send. Try again.")
    } finally {
      setBusy(false)
    }
  }

  const KINDS: Array<{ value: SwapKind; icon: typeof Check; title: string; text: string }> = chore ? [
    { value: "swap", icon: ArrowLeftRight, title: "Swap chores", text: `You do one of ${sibling ? firstName(sibling) : "their"} chores, they do this one.` },
    { value: "handoff", icon: HandCoins, title: "Pay them to do it", text: `${sibling ? firstName(sibling) : "They"} does this one and gets some of your ${token}.` },
  ] : []

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={chore ? `Swap or trade "${chore.title}"` : "Help out for bonus points"}
      description="A grown-up has to say yes before anything changes."
      footer={<div className="space-y-2"><ErrorNote>{error}</ErrorNote><Button size="lg" disabled={!ready || busy} onClick={() => void send()} className="w-full"><Send className="h-5 w-5" />{busy ? "Sending..." : "Ask a grown-up"}</Button></div>}>
      <div className="space-y-5">
        {siblings.length > 1 ? (
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold">Who with?</p>
            <div className="flex flex-wrap gap-3">
              {siblings.map((kid) => (
                <button key={kid.id} type="button" onClick={() => { setSiblingId(kid.id); setTakeId(null) }} aria-pressed={siblingId === kid.id}
                  className={cn("flex flex-col items-center gap-1 rounded-[20px] p-3 font-bold", siblingId === kid.id ? "bg-primary/15 ring-2 ring-primary" : "bg-card shadow-soft")}>
                  <Avatar profile={kid} size={52} />{firstName(kid)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {KINDS.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {KINDS.map((option) => (
              <button key={option.value} type="button" onClick={() => setKind(option.value)} aria-pressed={kind === option.value}
                className={cn("flex items-start gap-3 rounded-[20px] p-4 text-left", kind === option.value ? "bg-primary/15 ring-2 ring-primary" : "bg-card shadow-soft")}>
                <option.icon className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
                <span><span className="block font-display text-lg font-semibold">{option.title}</span><span className="block text-sm text-muted-foreground">{option.text}</span></span>
              </button>
            ))}
          </div>
        ) : null}

        {sibling && needsTake ? (
          <div className="space-y-2">
            <p className="font-display text-lg font-semibold">Which of {firstName(sibling)}'s chores will you do?</p>
            {theirs.length === 0 ? <p className="rounded-2xl bg-muted/60 p-3 text-muted-foreground">{firstName(sibling)} has no chores left to trade right now.</p> : (
              <ul className="grid grid-cols-2 gap-2">
                {theirs.map((item) => (
                  <li key={item.id}>
                    <button type="button" onClick={() => setTakeId(item.id)} aria-pressed={takeId === item.id}
                      className={cn("flex h-full w-full flex-col items-start gap-2 rounded-[18px] p-3 text-left", takeId === item.id ? "bg-primary/15 ring-2 ring-primary" : "bg-card shadow-soft")}>
                      <ChoreIconTile title={item.title} size={36} className="rounded-xl" />
                      <span className="line-clamp-2 font-semibold leading-tight">{item.title}</span>
                      {chorePoints(item) ? <TokenPill amount={chorePoints(item)} token={token} prefix="+" className="px-2 py-0.5 text-xs" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {sibling && kind !== "swap" ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/60 p-4">
            <span>
              <span className="flex items-center gap-1.5 font-bold">{kind === "handoff" ? <><HandCoins className="h-5 w-5 text-primary" />{`${token} you'll give ${firstName(sibling)}`}</> : <><HandHelping className="h-5 w-5 text-primary" />Bonus you're asking for</>}</span>
              <span className="block text-sm text-muted-foreground">{kind === "handoff" ? `You have ${balance}.` : "On top of the chore's own points."}</span>
            </span>
            <Stepper value={points} onChange={setPoints} min={kind === "handoff" ? 1 : 0} max={kind === "handoff" ? Math.max(1, balance) : 50} label="points" />
          </div>
        ) : null}
        {kind === "handoff" && balance < 1 ? <p className="text-sm font-semibold text-coral">You need some {token} to pay with first.</p> : null}

        <label className="block space-y-1.5">
          <span className="text-sm font-bold">Tell your grown-up why (optional)</span>
          <input className={inputClass} value={message} onChange={(event) => setMessage(event.target.value)} maxLength={140} placeholder="I have soccer after school" />
        </label>
      </div>
    </Sheet>
  )
}
