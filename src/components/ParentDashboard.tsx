import { useState } from "react"
import { Check, Clock3, Gift, Home, Image, Mail, Play, Plus, Settings, Users } from "lucide-react"
import AppBrand from "@/components/AppBrand"
import { ShareFriendDialog } from "@/components/ShareFriendDialog"
import { FamilyRewardsPanel, type FamilyReward } from "@/components/FamilyRewardsPanel"
import { FamilyThemeLibrary } from "@/components/FamilyThemeLibrary"
import { FamilySupportPanel } from "@/components/FamilySupportPanel"
import { ParentFamilySettings } from "@/components/ParentFamilySettings"
import { ChoreChecklist } from "@/components/ChoreChecklist"
import { ChoreEditor } from "@/components/ChoreEditor"
import { GoalAssignmentPanel } from "@/components/GoalAssignmentPanel"
import { ChoreReviewQueue } from "@/components/ChoreReviewQueue"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, GoalRecord } from "@/lib/familyTypes"
import { Button } from "@/components/ui/button"
import { overskill, useAuth } from "@/lib/auth"
import { useNavigate } from "react-router-dom"
import { ParentTodayOverview } from "@/components/ParentTodayOverview"
import { ParentControlsPlaceholder } from "@/components/ParentalControlsPlaceholder"

type Section = "chore-status" | "parental-controls" | "family-profiles" | "current-chores" | "create-chores" | "approvals" | "videos" | "rewards" | "themes" | "support"

interface ParentDashboardProps {
  profiles: FamilyProfile[]
  chores: ChoreRecord[]
  completions: ChoreCompletionRecord[]
  goals: GoalRecord[]
  rewards: FamilyReward[]
  goalTotal?: number
  loading: boolean
  goalError: string | null
  onRefresh: () => Promise<void>
  onExit: () => void
}
const householdMenu: Array<{ id: Section; label: string; icon: typeof Home }> = [
  { id: "chore-status", label: "Chore status", icon: Check },
  { id: "parental-controls", label: "Parental Controls", icon: Settings },
  { id: "family-profiles", label: "Family profiles", icon: Users },
]
const choresMenu: Array<{ id: Section; label: string; icon: typeof Home }> = [
  { id: "current-chores", label: "Current chores", icon: Check },
  { id: "create-chores", label: "Create new chores", icon: Plus },
  { id: "approvals", label: "Approvals", icon: Clock3 },
]
const standaloneMenu: Array<{ id: Section; label: string; icon: typeof Home }> = [
  { id: "videos", label: "Videos", icon: Play },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "themes", label: "Themes", icon: Image },
  { id: "support", label: "Support", icon: Mail },
]

export function ParentDashboard(props: ParentDashboardProps) {
  const [section, setSection] = useState<Section>("chore-status")
  const [busy, setBusy] = useState(false)
  const [exitError, setExitError] = useState<string | null>(null)
  const title = (() => {
    if (section === "chore-status") return "Chore status"
    if (section === "parental-controls") return "Parental Controls"
    if (section === "family-profiles") return "Family profiles"
    if (section === "current-chores") return "Current chores"
    if (section === "create-chores") return "Create new chores"
    if (section === "approvals") return "Approvals"
    if (section === "videos") return "Videos"
    if (section === "rewards") return "Rewards"
    if (section === "themes") return "Themes"
    if (section === "support") return "Support"
    return "Chores"
  })()
  const navigate = useNavigate()
  const { user } = useAuth()

  const leaveParentDashboard = async () => {
    setBusy(true)
    setExitError(null)
    try {
      await overskill.auth.logout()
      navigate("/logged-out")
    } catch (caught) {
      console.error("Parent logout failed:", caught)
      setExitError("We couldn't sign out. Please try again.")
      setBusy(false)
    }
  }

  const choreProfile = props.profiles.find((profile) => profile.profile_type === "parent") ?? props.profiles[0]

  const reviewCount = props.completions.filter(
    (completion) => Boolean(completion.completed_at) && (completion.review_status !== "approved" && completion.review_status !== "rejected")
  ).length

  return (
    <div className="min-h-[calc(100vh-4rem)] overflow-hidden rounded-[2rem] border border-border bg-background shadow-sm">
      <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/50 p-4 lg:border-b-0 lg:border-r lg:p-5">
          <div className="flex items-center justify-between gap-3"><AppBrand name="ChoreReward" icon={<Home className="h-5 w-5" />} className="flex items-center gap-2" imgClassName="h-9 w-9 rounded-xl object-cover" /><span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">Parent</span></div>
          <nav className="mt-6 space-y-6" aria-label="Parent dashboard sections">
            <section aria-labelledby="household-menu-heading">
              <h2 id="household-menu-heading" className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Household</h2>
              <div className="space-y-1">
                {householdMenu.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors active:scale-[0.96] ${section === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background"}`}>
                    <Icon className="h-4 w-4 shrink-0" />{label}
                  </button>
                ))}
              </div>
            </section>
            <section aria-labelledby="chores-menu-heading">
              <h2 id="chores-menu-heading" className="mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Chores</h2>
              <div className="space-y-1">
                {choresMenu.map(({ id, label, icon: Icon }) => (
                  <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors active:scale-[0.96] ${section === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background"}`}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{label}</span>
                    {id === "approvals" && reviewCount > 0 ? <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${section === id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{reviewCount}</span> : null}
                  </button>
                ))}
              </div>
            </section>
            <div className="space-y-1 border-t border-border pt-4">
              {standaloneMenu.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setSection(id)} aria-current={section === id ? "page" : undefined} className={`flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors active:scale-[0.96] ${section === id ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background"}`}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </button>
              ))}
            </div>
          </nav>
          <div className="mt-5 hidden rounded-2xl border border-border bg-card p-3 lg:block">
            <p className="text-xs leading-5 text-muted-foreground">
              One place for family profiles, chore lists, and milestones.
            </p>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                Family workspace
              </p>
              <h1 className="truncate font-display text-2xl font-bold text-foreground">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {user?.name || user?.email ? (
                <span className="min-w-0 max-w-[10rem] truncate text-xs text-muted-foreground">
                  {user.name || user.email}
                </span>
              ) : null}
              <ShareFriendDialog />
              <Button type="button" variant="outline" onClick={() => navigate("/settings")}>
                Account settings
              </Button>
              <Button type="button" variant="outline" onClick={props.onExit}>
                Switch profile
              </Button>
              <Button type="button" variant="ghost" onClick={() => void leaveParentDashboard()} disabled={busy}>
                {busy ? "Signing out…" : "Log out"}
              </Button>
            </div>
          </header>
          <main className="min-w-0 space-y-6 p-4 sm:p-6">
            {exitError ? <p className="text-sm text-destructive" role="alert">{exitError}</p> : null}
            {section === "chore-status" ? <>
              <ParentTodayOverview profiles={props.profiles} chores={props.chores} completions={props.completions} loading={props.loading} onManageChores={() => setSection("current-chores")} />
              {choreProfile ? <ChoreChecklist profiles={props.profiles} chores={props.chores} completions={props.completions} activeProfile={choreProfile} onRefresh={props.onRefresh} /> : <p className="text-sm text-muted-foreground">Create a household profile first to see today's chore status.</p>}
            </> : null}
            {section === "parental-controls" ? <ParentControlsPlaceholder /> : null}
            {section === "family-profiles" ? <ParentFamilySettings /> : null}
            {section === "current-chores" ? <ChoreEditor profiles={props.profiles} chores={props.chores} mode="current" rewards={props.rewards} onRefresh={props.onRefresh} /> : null}
            {section === "create-chores" ? <ChoreEditor profiles={props.profiles} chores={props.chores} mode="create" rewards={props.rewards} onRefresh={props.onRefresh} /> : null}
            {section === "approvals" ? <ChoreReviewQueue completions={props.completions} chores={props.chores} profiles={props.profiles} onRefresh={props.onRefresh} /> : null}
            {section === "videos" ? <section className="rounded-3xl border border-dashed border-border bg-muted/40 p-6 sm:p-8"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Play className="h-6 w-6" /></div><p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Future feature</p><h2 className="mt-1 font-display text-2xl font-bold text-card-foreground">Family videos</h2><p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">This section is reserved for family-friendly video ideas and chore walkthroughs.</p></section> : null}
            {section === "rewards" ? <><FamilyRewardsPanel profiles={props.profiles} rewards={props.rewards} onRefresh={props.onRefresh} /><GoalAssignmentPanel profiles={props.profiles} goals={props.goals} goalTotal={props.goalTotal} loading={props.loading} error={props.goalError} onRefresh={props.onRefresh} /></> : null}
            {section === "themes" ? <FamilyThemeLibrary profiles={props.profiles} onRefresh={props.onRefresh} /> : null}
            {section === "support" ? <FamilySupportPanel /> : null}
          </main>
        </div>
      </div>
    </div>
  )
}
