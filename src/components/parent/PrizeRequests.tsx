import { useState } from "react"
import { Check, Gift, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, inputClass, SectionTitle, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { firstName, relativeTime } from "@/lib/family"
import { answerPrizeRequest, pendingRequests, pointsBalance, requestCost, requestedRewardId } from "@/lib/prizeRequests"
import { answerJar, pendingJars, usePledges, type Jar } from "@/lib/prizeJars"
import { getKidTheme } from "@/lib/themes"

/** Kids' asks for prizes and full team prize jars, each with Give it, Not now and an optional note. */
export function PrizeRequests({ profiles, completions, prizeRequests, rewards, onRefresh }: ParentScreenProps) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const pledges = usePledges()
  const pending = pendingRequests(prizeRequests).filter((row) => profiles.some((profile) => profile.id === row.profile_id))
  const jars = pendingJars(rewards, pledges)
  if (pending.length + jars.length === 0) return null

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id)
    setError(null)
    try {
      await action()
      setNotes(({ [id]: _done, ...rest }) => rest)
      await onRefresh()
    } catch (caught) {
      console.error("Prize answer failed:", caught)
      setError("We couldn't save that. Please try again.")
    } finally {
      setBusyId(null)
    }
  }

  const noteField = (id: string, who: string) => (
    <input className={`${inputClass} mt-3 min-h-11 text-sm`} value={notes[id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [id]: event.target.value }))}
      placeholder={`Note to ${who} (optional)`} maxLength={140} aria-label={`Note to ${who}`} />
  )
  const buttons = (id: string, answer: (decision: "approved" | "rejected") => Promise<unknown>) => (
    <div className="mt-3 grid grid-cols-2 gap-3">
      <Button onClick={() => void run(id, () => answer("approved"))} disabled={busyId === id}><Check className="h-5 w-5" />Give it</Button>
      <Button variant="ghost" onClick={() => void run(id, () => answer("rejected"))} disabled={busyId === id} className="bg-muted hover:bg-muted/70"><X className="h-5 w-5" />Not now</Button>
    </div>
  )

  return (
    <section className="space-y-3">
      <SectionTitle count={pending.length + jars.length}><Gift className="h-5 w-5 text-secondary" />Prize requests</SectionTitle>
      <ErrorNote>{error}</ErrorNote>
      <ul className="grid gap-3 lg:grid-cols-2">
        {jars.map((jar) => <JarRequest key={`jar-${jar.reward.id}`} jar={jar} profiles={profiles}
          note={noteField(`jar-${jar.reward.id}`, "the team")} buttons={buttons(`jar-${jar.reward.id}`, (decision) => answerJar(jar, decision, notes[`jar-${jar.reward.id}`] ?? ""))} />)}
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
              {noteField(row.id, firstName(kid))}
              {buttons(row.id, (decision) => answerPrizeRequest(row, decision, notes[row.id] ?? ""))}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function JarRequest({ jar, profiles, note, buttons }: { jar: Jar; profiles: ParentScreenProps["profiles"]; note: React.ReactNode; buttons: React.ReactNode }) {
  const kids = jar.shares.map((share) => ({ share, kid: profiles.find((profile) => profile.id === share.profileId) })).filter((item) => item.kid)
  const names = kids.map((item) => firstName(item.kid))
  const filledAt = jar.rows.reduce((latest, row) => (row.created_at > latest ? row.created_at : latest), "")
  return (
    <li className="flex flex-col rounded-[26px] bg-card p-5 shadow-soft ring-2 ring-secondary/30">
      <div className="flex items-center gap-3">
        <span className="flex -space-x-3">{kids.slice(0, 4).map(({ kid }) => <Avatar key={kid!.id} profile={kid!} size={44} ring />)}</span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold">{names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names.at(-1)}` : names[0]} <span className="text-sm font-normal text-muted-foreground">· {relativeTime(filledAt)}</span></p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground"><Users className="h-4 w-4" />Team prize, jar is full</p>
        </div>
        <TokenPill amount={jar.total} />
      </div>
      <p className="mt-3 flex items-center gap-3 rounded-2xl bg-secondary/10 px-4 py-3 font-display text-xl font-semibold">
        <span aria-hidden="true">🫙</span>{jar.reward.title}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {kids.map(({ share, kid }) => {
          const theme = getKidTheme(kid!.theme_key)
          return <li key={share.profileId} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-3 text-sm font-bold"><Avatar profile={kid!} size={26} />{firstName(kid)} put in {theme.token}{share.points}</li>
        })}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Not now gives each kid their share back.</p>
      {note}
      {buttons}
    </li>
  )
}
