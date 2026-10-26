import { useState } from "react"
import { Check, Gift, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, SectionTitle, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { firstName, relativeTime } from "@/lib/family"
import { answerPrizeRequest, pendingRequests, pointsBalance, requestCost, requestedRewardId, type PrizeRequest } from "@/lib/prizeRequests"
import { getKidTheme } from "@/lib/themes"

/** Kids' asks for prizes, each with Give it and Not now. */
export function PrizeRequests({ profiles, completions, prizeRequests, rewards, onRefresh }: ParentScreenProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pending = pendingRequests(prizeRequests).filter((row) => profiles.some((profile) => profile.id === row.profile_id))
  if (pending.length === 0) return null

  const answer = async (row: PrizeRequest, decision: "approved" | "rejected") => {
    setBusyId(row.id)
    setError(null)
    try {
      await answerPrizeRequest(row, decision)
      await onRefresh()
    } catch (caught) {
      console.error("Prize answer failed:", caught)
      setError("We couldn't save that. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-3">
      <SectionTitle count={pending.length}><Gift className="h-5 w-5 text-secondary" />Prize requests</SectionTitle>
      <ErrorNote>{error}</ErrorNote>
      <ul className="grid gap-3 lg:grid-cols-2">
        {pending.map((row) => {
          const kid = profiles.find((profile) => profile.id === row.profile_id)!
          const theme = getKidTheme(kid.theme_key)
          const reward = rewards.find((item) => item.id === requestedRewardId(row))
          // Pending asks are already held out of the balance, so this is what's left if you give it.
          const left = pointsBalance(kid.id, completions, prizeRequests)
          return (
            <li key={row.id} className="flex flex-col rounded-[26px] bg-card p-5 shadow-soft">
              <div className="flex items-center gap-3">
                <Avatar profile={kid} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-lg font-semibold">{firstName(kid)} is asking <span className="text-sm font-normal text-muted-foreground">· {relativeTime(row.completed_at)}</span></p>
                  <p className="text-sm text-muted-foreground">{left} {theme.tokenName} left after this</p>
                </div>
                <TokenPill amount={requestCost(row)} token={theme.token} />
              </div>
              <p className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/10 px-4 py-3 font-display text-xl font-semibold">
                <span aria-hidden="true">🎁</span>{reward?.title ?? "A prize that was removed"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button onClick={() => void answer(row, "approved")} disabled={busyId === row.id}><Check className="h-5 w-5" />Give it</Button>
                <Button variant="ghost" onClick={() => void answer(row, "rejected")} disabled={busyId === row.id} className="bg-muted hover:bg-muted/70"><X className="h-5 w-5" />Not now</Button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
