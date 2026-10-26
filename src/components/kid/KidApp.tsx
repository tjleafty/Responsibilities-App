import { useEffect, useState } from "react"
import { Gift, LogOut, Smile, Sun } from "lucide-react"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, GoalRecord } from "@/lib/familyTypes"
import type { FamilyReward } from "@/lib/familyTypes"
import { Avatar } from "@/components/kit"
import { ensureThemeFonts, getKidTheme, kidThemeStyle } from "@/lib/themes"
import { pointsBalance, type PrizeRequest } from "@/lib/prizeRequests"
import { cn } from "@/lib/utils"
import { KidToday } from "@/components/kid/KidToday"
import { KidChoreDetail } from "@/components/kid/KidChoreDetail"
import { KidPrizes } from "@/components/kid/KidPrizes"
import { KidMe } from "@/components/kid/KidMe"

export interface KidAppProps {
  profile: FamilyProfile
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  prizeRequests: PrizeRequest[]
  goals: GoalRecord[]
  rewards: FamilyReward[]
  onRefresh: () => Promise<void>
  onSwitchProfile: () => void
  onThemeChange: (themeKey: string) => Promise<void>
}

type Tab = "today" | "prizes" | "me"

const TABS: Array<{ id: Tab; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "prizes", label: "Prizes", icon: Gift },
  { id: "me", label: "Me", icon: Smile },
]

export function KidApp(props: KidAppProps) {
  const { profile } = props
  const [tab, setTab] = useState<Tab>("today")
  const [openChoreId, setOpenChoreId] = useState<string | null>(null)
  // Saved rows show up right away; the full reload from the database follows in the background.
  const [completions, setCompletions] = useState(props.completions)
  const [prizeRequests, setPrizeRequests] = useState(props.prizeRequests)
  const theme = getKidTheme(profile.theme_key)

  useEffect(() => { setCompletions(props.completions) }, [props.completions])
  useEffect(() => { setPrizeRequests(props.prizeRequests) }, [props.prizeRequests])
  useEffect(() => { ensureThemeFonts(profile.theme_key) }, [profile.theme_key])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab, openChoreId])

  const upsert = (row: ChoreCompletionRecord) => {
    setCompletions((current) => current.some((item) => item.id === row.id) ? current.map((item) => item.id === row.id ? row : item) : [...current, row])
    void props.onRefresh()
  }

  const addRequest = (row: PrizeRequest) => {
    setPrizeRequests((current) => [...current, row])
    void props.onRefresh()
  }

  const shared = { ...props, completions, prizeRequests }
  const openChore = props.chores.find((chore) => chore.id === openChoreId) ?? null
  const balance = pointsBalance(profile.id, completions, prizeRequests)

  return (
    <div className="min-h-dvh bg-background text-foreground" style={kidThemeStyle(profile.theme_key)}>
      <div className="mx-auto flex max-w-6xl">
        <nav className="sticky top-0 hidden h-dvh w-28 shrink-0 flex-col items-center gap-3 py-6 md:flex" aria-label="Kid menu">
          <Avatar profile={profile} size={64} ring />
          <span className="font-display text-lg font-semibold">{profile.display_name}</span>
          <div className="mt-4 flex flex-col gap-2">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => { setOpenChoreId(null); setTab(id) }} aria-current={tab === id && !openChore ? "page" : undefined}
                className={cn("flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-[22px] font-display text-sm font-semibold transition-colors", tab === id && !openChore ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-card")}>
                <Icon className="h-7 w-7" />{label}
              </button>
            ))}
          </div>
          <button type="button" onClick={props.onSwitchProfile} className="mt-auto flex flex-col items-center gap-1 rounded-2xl p-2 text-xs font-bold text-muted-foreground hover:text-foreground"><LogOut className="h-5 w-5" />Switch</button>
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-32 pt-4 md:px-6 md:pb-10 md:pt-6">
          {openChore ? (
            <KidChoreDetail {...shared} chore={openChore} onBack={() => setOpenChoreId(null)} onSaved={upsert} />
          ) : tab === "today" ? (
            <KidToday {...shared} balance={balance} token={theme.token} onOpenChore={setOpenChoreId} />
          ) : tab === "prizes" ? (
            <KidPrizes {...shared} balance={balance} onRequested={addRequest} />
          ) : (
            <KidMe {...shared} />
          )}
        </main>
      </div>

      {!openChore ? (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 pt-2 backdrop-blur pb-safe md:hidden" aria-label="Kid menu">
          <div className="mx-auto flex max-w-md justify-around">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
                className={cn("flex min-h-14 min-w-20 flex-col items-center justify-center gap-0.5 rounded-2xl px-4 font-display text-sm font-semibold transition-colors", tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground")}>
                <Icon className="h-7 w-7" />{label}
              </button>
            ))}
          </div>
        </nav>
      ) : null}
    </div>
  )
}
