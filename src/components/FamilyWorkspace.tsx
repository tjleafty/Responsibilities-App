import { type FormEvent, useCallback, useEffect, useState } from "react"
import { Plus, Star, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { GoalAssignmentPanel } from "@/components/GoalAssignmentPanel"
import { ProfileLoginScreen } from "@/components/ProfileLoginScreen"
import { ProfileThemeTile } from "@/components/ProfileThemeTile"
import { ChoreEditor } from "@/components/ChoreEditor"
import { ChoreChecklist } from "@/components/ChoreChecklist"
import { ChildThemePicker } from "@/components/ChildThemePicker"
import { getTheme, type FamilyProfile, type GoalRecord, hashPin, isValidPin, type ProfileType, THEME_OPTIONS, type ChoreRecord, type ChoreCompletionRecord } from "@/lib/familyTypes"
import { overskill, useAuth } from "@/lib/auth"
import { ParentDashboard } from "@/components/ParentDashboard"
import { ChildDashboard } from "@/components/ChildDashboard"
import { FamilyReward } from "@/components/FamilyRewardsPanel"

export function FamilyWorkspace() {
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const userName = user?.name
  const userEmail = user?.email
  const [profiles, setProfiles] = useState<FamilyProfile[]>([])
  const [goals, setGoals] = useState<GoalRecord[]>([])
  const [chores, setChores] = useState<ChoreRecord[]>([])
  const [completions, setCompletions] = useState<ChoreCompletionRecord[]>([])
  const [goalTotal, setGoalTotal] = useState<number | undefined>(undefined)
  const [activeProfile, setActiveProfile] = useState<FamilyProfile | null>(null)
  const [status, setStatus] = useState<"loading" | "success" | "error" | "signed-out">("loading")
  const [goalError, setGoalError] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<ProfileType>("child")
  const [newTheme, setNewTheme] = useState("sunny-room")
  const [newPin, setNewPin] = useState("")
  const [profileSaving, setProfileSaving] = useState(false)
  const [themeSaving, setThemeSaving] = useState(false)
  const [themeError, setThemeError] = useState<string | null>(null)
  const [rewards, setRewards] = useState<FamilyReward[]>([])

  const loadData = useCallback(async () => {
    if (!userId) return
    setStatus("loading")
    setLoadError(null)
    setGoalError(null)
    try {
      let nextProfiles = (await overskill.entities.family_profile.list({ orderBy: "-created_at", all: true })) as unknown as FamilyProfile[]
      if (!nextProfiles.some((profile) => profile.profile_type === "parent" && profile.is_active !== false)) {
        await overskill.entities.family_profile.create({ display_name: userName || userEmail?.split("@")[0] || "Parent", profile_type: "parent", theme_key: "sunny-room", pin_hash: "", is_active: true })
        nextProfiles = (await overskill.entities.family_profile.list({ orderBy: "-created_at", all: true })) as unknown as FamilyProfile[]
      }
      const [nextGoals, nextGoalTotal, nextChores, nextCompletions, nextRewards] = await Promise.all([
        overskill.entities.goal.list({ orderBy: "-created_at", all: true }),
        overskill.entities.goal.count(),
        overskill.entities.chore.list({ orderBy: "-created_at", all: true }),
        overskill.entities.chore_completion.list({ orderBy: "-created_at", all: true }),
        overskill.entities.family_reward.list({ orderBy: "-created_at", all: true }),
      ])
      const activeProfiles = nextProfiles.filter((profile) => profile.is_active !== false) as unknown as FamilyProfile[]
      setProfiles(activeProfiles)
      setGoals(nextGoals as unknown as GoalRecord[])
      setChores(nextChores as unknown as ChoreRecord[])
      setCompletions(nextCompletions as unknown as ChoreCompletionRecord[])
      setRewards(nextRewards as unknown as FamilyReward[])
      setGoalTotal(nextGoalTotal)
      setActiveProfile((current) => {
        const found = activeProfiles.find((profile) => profile.id === current?.id)
        return found ?? null
      })
      setStatus("success")
    } catch (caught) {
      console.error("Family workspace load failed:", caught)
      setLoadError("We couldn't load the family workspace. Please try again.")
      setGoalError("We couldn't load goals right now.")
      setStatus("error")
    }
  }, [userId, userName, userEmail])

  useEffect(() => {
    if (authLoading) {
      setStatus("loading")
      return
    }
    if (!userId) {
      setStatus("signed-out")
      return
    }
    void loadData()
  }, [authLoading, userId, loadData])

  const createProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!newName.trim() || (newPin && !isValidPin(newPin))) return
    setProfileSaving(true)
    setLoadError(null)
    try {
      await overskill.entities.family_profile.create({ display_name: newName.trim(), profile_type: newType, theme_key: newTheme, pin_hash: newPin ? await hashPin(newPin) : "", is_active: true })
      setNewName("")
      setNewPin("")
      await loadData()
    } catch (caught) {
      console.error("Profile creation failed:", caught)
      setLoadError("We couldn't add that profile. Please try again.")
    } finally {
      setProfileSaving(false)
    }
  }

  const setProfilePin = async (profileId: string, pinHash: string) => {
    await overskill.entities.family_profile.update(profileId, { pin_hash: pinHash })
    await loadData()
  }

  const updateProfileTheme = async (themeKey: string) => {
    if (!activeProfile) return
    setThemeSaving(true)
    setThemeError(null)
    try {
      await overskill.entities.family_profile.update(activeProfile.id, { theme_key: themeKey })
      setActiveProfile((current) => (current ? { ...current, theme_key: themeKey } : null))
      await loadData()
    } catch (caught) {
      console.error("Theme update failed:", caught)
      setThemeError("We couldn't update the theme. Please try again.")
    } finally {
      setThemeSaving(false)
    }
  }

  const activeGoals = activeProfile ? goals.filter((goal) => goal.target_profile_id === activeProfile.id) : []
  const activeTheme = activeProfile ? getTheme(activeProfile.theme_key) : null

  if (status === "loading") return <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Preparing your family quest…</div>
  if (status === "signed-out") return <div className="rounded-3xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Sign in to open your family profiles.</div>
  if (status === "error") return <div className="rounded-3xl border border-destructive/30 bg-card p-8 text-center"><p className="text-sm text-destructive" role="alert">{loadError ?? "We couldn't load the family workspace."}</p><Button type="button" onClick={() => void loadData()} className="mt-4">Try again</Button></div>
  if (!activeProfile) return <ProfileLoginScreen profiles={profiles} onUnlocked={setActiveProfile} onSetPin={setProfilePin} />

  return (
    <div className="space-y-8" data-element-id="family-workspace">
      {activeProfile.profile_type === "parent" ? (
        <ParentDashboard profiles={profiles} chores={chores} completions={completions} goals={goals} rewards={rewards} goalTotal={goalTotal} loading={status === "loading"} goalError={goalError} onRefresh={loadData} onExit={() => setActiveProfile(null)} />
      ) : (
        <ChildDashboard profile={activeProfile} profiles={profiles} chores={chores} completions={completions} goals={goals} onRefresh={loadData} onParent={() => setActiveProfile(null)} themeSaving={themeSaving} themeError={themeError} onThemeChange={updateProfileTheme} />
      )}
    </div>
  )
}
