import { useEffect, useState } from "react"
import { Clock3, HandCoins, Undo2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, ProgressBar, Stepper, TokenPill } from "@/components/kit"
import type { FamilyProfile, FamilyReward } from "@/lib/familyTypes"
import { firstName } from "@/lib/family"
import { addToJar, jarFor, takeBackFromJar, teamOf, type PrizePledge } from "@/lib/prizeJars"
import { prepareCelebration } from "@/lib/celebration"
import type { KidTheme } from "@/lib/themes"
import { cn } from "@/lib/utils"

interface TeamJarProps {
  reward: FamilyReward
  profile: FamilyProfile
  profiles: FamilyProfile[]
  pledges: PrizePledge[]
  balance: number
  theme: KidTheme
  teen: boolean
  onChanged: () => void
}

/** A team prize on a kid's Prizes tab: the shared jar, who put in what, and add or take back. */
export function TeamJar({ reward, profile, profiles, pledges, balance, theme, teen, onChanged }: TeamJarProps) {
  const jar = jarFor(reward, pledges)
  const left = Math.max(0, jar.cost - jar.total)
  const mine = jar.shares.find((share) => share.profileId === profile.id)?.points ?? 0
  const most = Math.min(balance, left)
  const [amount, setAmount] = useState(() => Math.max(1, Math.min(10, most)))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setAmount((value) => Math.max(1, Math.min(value, most || 1))) }, [most])
  const team = teamOf(reward).map((id) => profiles.find((kid) => kid.id === id)).filter((kid): kid is FamilyProfile => Boolean(kid))
  const step = most >= 50 ? 5 : 1
  const full = jar.state === "full"

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      console.error("Team jar update failed:", caught)
      setError("That didn't save. Try again in a moment.")
    } finally {
      setBusy(false)
    }
  }

  const add = () => {
    const celebrate = prepareCelebration()
    void run(async () => {
      if (await addToJar(reward, profile, amount, profiles)) celebrate(teen ? `${reward.title}: jar full. Sent for approval.` : `You filled the jar for ${reward.title}! A grown-up will take a look.`, { themeKey: profile.theme_key, reward: "coin-jar" })
    })
  }

  return (
    <li className={cn("flex flex-col rounded-[22px] bg-card p-4 shadow-soft", full && "ring-4 ring-accent")}>
      <div className="flex items-start gap-3">
        {teen
          ? <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary" aria-hidden="true"><Users className="h-5 w-5" /></span>
          : <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-secondary/15 text-3xl" aria-hidden="true">🫙</span>}
        <div className="min-w-0 flex-1">
          <p className="font-display text-base font-medium leading-tight">{reward.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{teen ? "Team reward with " : "Saving together with "}{team.filter((kid) => kid.id !== profile.id).map(firstName).join(" and ") || "your team"}</p>
        </div>
        <TokenPill amount={jar.cost} token={theme.token} />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm font-bold">
          <span>{jar.total} of {jar.cost} {theme.tokenName}</span>
          <span className="text-muted-foreground">{full ? (teen ? "Full" : "Full!") : `${left} to go`}</span>
        </div>
        <ProgressBar value={jar.total} max={jar.cost} thick color={full ? "hsl(var(--success))" : undefined} />
      </div>

      {jar.shares.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Who put points in">
          {jar.shares.map((share) => {
            const kid = profiles.find((item) => item.id === share.profileId)
            return kid ? (
              <li key={share.profileId} className={cn("inline-flex items-center gap-1.5 rounded-full bg-muted py-1 pl-1 pr-3 text-sm font-bold", share.profileId === profile.id && "ring-2 ring-primary")}>
                <Avatar profile={kid} size={26} />{share.profileId === profile.id ? (teen ? "You" : "Me") : firstName(kid)} · {theme.token}{share.points}
              </li>
            ) : null
          })}
        </ul>
      ) : <p className="mt-3 text-sm text-muted-foreground">{teen ? "Nobody has added XP yet." : "The jar is empty. Be the first to add some!"}</p>}

      <ErrorNote>{error}</ErrorNote>
      {full ? (
        <p className="mt-3 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent/30 px-3 py-2 text-center text-sm font-extrabold"><Clock3 className="h-4 w-4" />{teen ? "Pending approval" : "Waiting for a grown-up to say yes"}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {most > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Stepper value={Math.min(amount, most)} onChange={setAmount} min={1} max={most} step={step} label={theme.tokenName} />
              <Button onClick={add} disabled={busy} className="flex-1"><HandCoins className="h-5 w-5" />{busy ? "Adding..." : teen ? `Add ${Math.min(amount, most)}` : `Put in ${Math.min(amount, most)}`}</Button>
            </div>
          ) : <p className="rounded-2xl bg-muted px-3 py-2 text-center text-sm font-bold">{teen ? "Earn XP to add to this." : `Finish chores to earn ${theme.tokenName} for the jar.`}</p>}
          {mine > 0 ? (
            <button type="button" disabled={busy} onClick={() => void run(() => takeBackFromJar(reward, profile))} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-muted-foreground hover:bg-muted">
              <Undo2 className="h-4 w-4" />{teen ? `Withdraw my ${mine}` : `Take my ${mine} back`}
            </button>
          ) : null}
        </div>
      )}
    </li>
  )
}
