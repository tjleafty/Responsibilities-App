import { useEffect, useState } from "react"
import { CheckCircle2, Gift, ListChecks, LogOut, Sun, Users } from "lucide-react"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, GoalRecord } from "@/lib/familyTypes"
import type { FamilyReward } from "@/lib/familyTypes"
import { Avatar, BrandMark } from "@/components/kit"
import { awaitingReview } from "@/lib/family"
import { cn } from "@/lib/utils"
import { ParentToday } from "@/components/parent/ParentToday"
import { ParentApprove } from "@/components/parent/ParentApprove"
import { ParentChores } from "@/components/parent/ParentChores"
import { ParentRewards } from "@/components/parent/ParentRewards"
import { ParentFamily } from "@/components/parent/ParentFamily"

export interface ParentAppProps {
  profile: FamilyProfile
  profiles: FamilyProfile[]
  inactiveProfiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  goals: GoalRecord[]
  rewards: FamilyReward[]
  onRefresh: () => Promise<void>
  onSwitchProfile: () => void
  onSignOut: () => void
}

export type ParentTab = "today" | "approve" | "chores" | "rewards" | "family"

const TABS: Array<{ id: ParentTab; label: string; icon: typeof Sun }> = [
  { id: "today", label: "Today", icon: Sun },
  { id: "approve", label: "Approve", icon: CheckCircle2 },
  { id: "chores", label: "Chores", icon: ListChecks },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "family", label: "Family", icon: Users },
]

export function ParentApp(props: ParentAppProps) {
  const [tab, setTab] = useState<ParentTab>("today")
  const [newChore, setNewChore] = useState(0)
  const choreIds = new Set(props.chores.map((chore) => chore.id))
  const waiting = awaitingReview(props.completions).filter((row) => choreIds.has(row.chore_id)).length

  useEffect(() => { window.scrollTo({ top: 0 }) }, [tab])

  const shared = { ...props, onNavigate: setTab, onAddChore: () => { setTab("chores"); setNewChore((count) => count + 1) } }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-7xl">
        <nav className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col gap-1 border-r border-border px-4 py-6 lg:flex" aria-label="Parent menu">
          <BrandMark className="mb-6 px-2" />
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-4 font-display text-base font-semibold transition-colors", tab === id ? "bg-primary text-primary-foreground shadow-soft" : "text-muted-foreground hover:bg-card hover:text-foreground")}>
              <Icon className="h-5 w-5" />{label}
              {id === "approve" && waiting > 0 ? <span className={cn("ml-auto grid min-w-6 place-items-center rounded-full px-1.5 text-xs font-extrabold", tab === id ? "bg-primary-foreground text-primary" : "bg-secondary text-secondary-foreground")}>{waiting}</span> : null}
            </button>
          ))}
          <div className="mt-auto flex items-center gap-3 rounded-2xl bg-card p-3 shadow-soft">
            <Avatar profile={props.profile} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold">{props.profile.display_name}</p>
              <p className="text-xs font-bold text-primary">Parent mode</p>
            </div>
            <button type="button" onClick={props.onSwitchProfile} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Switch profile"><LogOut className="h-5 w-5" /></button>
          </div>
        </nav>

        <main className="min-w-0 flex-1 px-4 pb-32 pt-5 sm:px-6 lg:px-10 lg:pb-12 lg:pt-8">
          {tab === "today" ? <ParentToday {...shared} />
            : tab === "approve" ? <ParentApprove {...shared} />
              : tab === "chores" ? <ParentChores {...shared} openNew={newChore} />
                : tab === "rewards" ? <ParentRewards {...shared} />
                  : <ParentFamily {...shared} />}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pt-2 backdrop-blur pb-safe lg:hidden" aria-label="Parent menu">
        <div className="mx-auto flex max-w-xl justify-around">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}
              className={cn("relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-xs font-bold transition-colors", tab === id ? "text-primary" : "text-muted-foreground")}>
              <span className={cn("grid h-8 w-14 place-items-center rounded-full", tab === id && "bg-primary/10")}><Icon className="h-6 w-6" /></span>
              {label}
              {id === "approve" && waiting > 0 ? <span className="absolute right-[calc(50%-26px)] top-0 grid min-w-5 place-items-center rounded-full bg-secondary px-1 text-[11px] font-extrabold text-secondary-foreground">{waiting}</span> : null}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}

export type ParentScreenProps = ParentAppProps & { onNavigate: (tab: ParentTab) => void; onAddChore: () => void }
