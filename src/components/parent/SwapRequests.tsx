import { useState } from "react"
import { ArrowLeftRight, Check, HandCoins, HandHelping, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, ErrorNote, SectionTitle, Stepper } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import type { ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { firstName, relativeTime } from "@/lib/family"
import { chorePoints } from "@/lib/difficulty"
import { answerSwap, pendingSwaps, useSwaps, type ChoreSwap } from "@/lib/swaps"
import { getKidTheme } from "@/lib/themes"

const KIND = {
  swap: { icon: ArrowLeftRight, label: "Swap" },
  handoff: { icon: HandCoins, label: "Pay a sibling" },
  takeover: { icon: HandHelping, label: "Extra chore for a bonus" },
} as const

/** Kids' swap and trade asks. Nothing changes until a grown-up says yes. */
export function SwapRequests({ profiles, chores, onRefresh }: ParentScreenProps) {
  const rows = pendingSwaps(useSwaps()).filter((row) => profiles.some((kid) => kid.id === row.from_profile_id) && profiles.some((kid) => kid.id === row.to_profile_id))
  const [busyId, setBusyId] = useState<string | null>(null)
  const [bonus, setBonus] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  if (rows.length === 0) return null

  const answer = async (row: ChoreSwap, decision: "approved" | "rejected") => {
    setBusyId(row.id)
    setError(null)
    try {
      await answerSwap(row, decision, row.kind === "takeover" && decision === "approved" ? { points: bonus[row.id] ?? row.points } : {})
      await onRefresh()
    } catch (caught) {
      console.error("Answering a swap failed:", caught)
      setError("We couldn't save that. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle count={rows.length}><ArrowLeftRight className="h-5 w-5 text-secondary" />Swaps and trades</SectionTitle>
      <ErrorNote>{error}</ErrorNote>
      <ul className="grid gap-3 lg:grid-cols-2">
        {rows.map((row) => {
          const from = profiles.find((kid) => kid.id === row.from_profile_id)!
          const to = profiles.find((kid) => kid.id === row.to_profile_id)!
          const give = chores.find((chore) => chore.id === row.give_chore_id) ?? null
          const take = chores.find((chore) => chore.id === row.take_chore_id) ?? null
          const kind = KIND[row.kind]
          const token = getKidTheme(from.theme_key).token
          return (
            <li key={row.id} className="flex flex-col gap-3 rounded-[26px] bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar profile={from} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{firstName(from)} wants to trade <span className="text-sm font-normal text-muted-foreground">· {relativeTime(row.created_at)}</span></p>
                  <p className="flex items-center gap-1 text-sm font-bold text-muted-foreground"><kind.icon className="h-4 w-4" />{kind.label} with {firstName(to)}</p>
                </div>
              </div>
              {give ? <Move chore={give} doer={to} note={`was ${firstName(from)}'s`} /> : null}
              {take ? <Move chore={take} doer={from} note={`was ${firstName(to)}'s`} /> : null}
              {row.kind === "handoff" ? <p className="rounded-2xl bg-muted/60 px-4 py-2 font-semibold">{firstName(from)} gives {firstName(to)} {row.points} {token}</p> : null}
              {row.kind === "takeover" ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-muted/60 px-4 py-2">
                  <span className="font-semibold">Bonus for {firstName(from)} <span className="text-sm font-normal text-muted-foreground">(asked for {row.points}, plus the chore's {take ? chorePoints(take) : 0})</span></span>
                  <Stepper value={bonus[row.id] ?? row.points} onChange={(value) => setBonus((current) => ({ ...current, [row.id]: value }))} max={100} label="bonus points" />
                </div>
              ) : null}
              {row.message ? <p className="rounded-2xl bg-secondary/10 px-4 py-2 text-sm">“{row.message}”</p> : null}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => void answer(row, "approved")} disabled={busyId === row.id}><Check className="h-5 w-5" />Say yes</Button>
                <Button variant="ghost" onClick={() => void answer(row, "rejected")} disabled={busyId === row.id} className="bg-muted hover:bg-muted/70"><X className="h-5 w-5" />Not this time</Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Move({ chore, doer, note }: { chore: ChoreRecord; doer: FamilyProfile; note: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-muted/60 px-3 py-2">
      <ChoreIconTile title={chore.title} size={36} className="rounded-xl" />
      <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{chore.title}</span><span className="block text-xs text-muted-foreground">{note}</span></span>
      <span className="flex items-center gap-1.5 text-sm font-bold">→ <Avatar profile={doer} size={28} />{firstName(doer)}</span>
    </div>
  )
}
