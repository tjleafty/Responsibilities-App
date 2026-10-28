import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { MASCOT } from "@/components/kit"
import { WhoIsHere } from "@/components/WhoIsHere"
import { ParentSetup } from "@/components/ParentSetup"
import { KidApp } from "@/components/kid/KidApp"
import { ParentApp } from "@/components/parent/ParentApp"
import type { FamilyReward } from "@/lib/familyTypes"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile, GoalRecord } from "@/lib/familyTypes"
import { signOut, useAuth } from "@/lib/auth"
import { db, DEMO_MODE } from "@/lib/db"
import { splitCompletions, type PrizeRequest } from "@/lib/prizeRequests"
import { ensureFamily, pendingInvite } from "@/lib/familySharing"
import { loadFamilySettings } from "@/lib/familySettings"
import { loadBilling, useBilling } from "@/lib/billing"
import { loadSwaps } from "@/lib/swaps"
import { BillingWall } from "@/components/parent/Billing"

// The open profile survives a page refresh in this tab, so a kid isn't sent back to the picker mid-chore.
const ACTIVE_KEY = "responsibilities.activeProfile"

function readActiveId() {
  try {
    return sessionStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function writeActiveId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(ACTIVE_KEY, id)
    else sessionStorage.removeItem(ACTIVE_KEY)
  } catch {
    // Storage can be blocked; the picker still works without it.
  }
}

export function FamilyWorkspace() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const userId = user?.id
  const userName = user?.name
  const [allProfiles, setAllProfiles] = useState<FamilyProfile[]>([])
  const [goals, setGoals] = useState<GoalRecord[]>([])
  const [chores, setChores] = useState<ChoreRecord[]>([])
  const [completions, setCompletions] = useState<ChoreCompletionRecord[]>([])
  const [prizeRequests, setPrizeRequests] = useState<PrizeRequest[]>([])
  const [rewards, setRewards] = useState<FamilyReward[]>([])
  const [activeId, setActiveId] = useState<string | null>(readActiveId)
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading")
  const [sharingAvailable, setSharingAvailable] = useState(false)

  const loadData = useCallback(async () => {
    if (!userId) return
    // Someone who signed up from an invite link finishes joining before anything else loads.
    const invite = pendingInvite()
    if (invite) {
      navigate(`/invite/${invite}`, { replace: true })
      return
    }
    try {
      setSharingAvailable(await ensureFamily())
      await loadFamilySettings()
      await loadBilling().catch((error) => console.error("Loading billing failed:", error))
      await loadSwaps()
      const profiles = (await db.family_profile.list({ orderBy: "created_at", all: true })) as unknown as FamilyProfile[]
      const [nextGoals, nextChores, nextCompletions, nextRewards] = await Promise.all([
        db.goal.list({ orderBy: "-created_at", all: true }),
        db.chore.list({ orderBy: "created_at", all: true }),
        db.chore_completion.list({ orderBy: "-created_at", all: true }),
        db.family_reward.list({ orderBy: "-created_at", all: true }),
      ])
      setAllProfiles(profiles)
      setGoals(nextGoals as unknown as GoalRecord[])
      setChores(nextChores as unknown as ChoreRecord[])
      const split = splitCompletions(nextCompletions as unknown as ChoreCompletionRecord[])
      setCompletions(split.completions)
      setPrizeRequests(split.prizeRequests)
      setRewards(nextRewards as unknown as FamilyReward[])
      setStatus("ready")
    } catch (caught) {
      console.error("Family workspace load failed:", caught)
      setStatus((current) => current === "ready" ? current : "error")
    }
  }, [userId, navigate])

  useEffect(() => {
    if (authLoading) return
    if (!userId) {
      navigate("/login")
      return
    }
    void loadData()
  }, [authLoading, userId, loadData, navigate])

  // Back from Stripe Checkout: Stripe tells the server a moment later, so check again a few times.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has("billing")) return
    window.history.replaceState(null, "", window.location.pathname)
    if (params.get("billing") !== "success") return
    const timers = [2000, 5000, 10000].map((delay) => window.setTimeout(() => void loadBilling(), delay))
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [])

  const { access } = useBilling()
  const profiles = allProfiles.filter((profile) => profile.is_active !== false)
  const inactiveProfiles = allProfiles.filter((profile) => profile.is_active === false)
  const active = profiles.find((profile) => profile.id === activeId) ?? null

  const open = (profile: FamilyProfile | null) => {
    setActiveId(profile?.id ?? null)
    writeActiveId(profile?.id ?? null)
    if (profile) setAllProfiles((current) => current.map((item) => item.id === profile.id ? { ...item, ...profile } : item))
  }

  // Every login gets its own parent profile with a PIN; until then it goes through setup.
  const needsSetup = !profiles.some((profile) => profile.profile_type === "parent" && profile.owner_id === userId)

  const saveOwnProfile = async ({ displayName, pinHash, claimId }: { displayName: string; pinHash: string; claimId: string | null }) => {
    const data = { display_name: displayName, pin_hash: pinHash }
    const row = claimId
      ? await db.family_profile.update(claimId, { ...data, owner_id: userId })
      : await db.family_profile.create({ ...data, profile_type: "parent", theme_key: "sunny-room", is_active: true, ...(DEMO_MODE ? { owner_id: userId } : {}) })
    await loadData()
    return row as unknown as FamilyProfile
  }

  const setPin = async (profileId: string, pinHash: string) => {
    await db.family_profile.update(profileId, { pin_hash: pinHash })
    await loadData()
  }

  const changeTheme = async (themeKey: string) => {
    if (!active) return
    await db.family_profile.update(active.id, { theme_key: themeKey })
    setAllProfiles((current) => current.map((item) => item.id === active.id ? { ...item, theme_key: themeKey } : item))
  }

  const leave = async () => {
    writeActiveId(null)
    await signOut()
    navigate("/")
  }

  if (status === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background">
        <div className="text-center">
          <span className="float-soft inline-block text-6xl" aria-hidden="true">{MASCOT}</span>
          <p className="mt-3 font-display text-xl font-semibold">Getting your family ready...</p>
        </div>
      </main>
    )
  }

  if (status === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-background px-4">
        <div className="max-w-sm rounded-[22px] bg-card p-8 text-center shadow-soft">
          <span className="text-5xl" aria-hidden="true">{MASCOT}</span>
          <p className="mt-3 font-display text-xl font-semibold">We couldn't load your family</p>
          <p className="mt-1 text-muted-foreground">Check your connection and try again.</p>
          <Button onClick={() => { setStatus("loading"); void loadData() }} className="mt-5">Try again</Button>
        </div>
      </main>
    )
  }

  if (access.locked) {
    return <BillingWall onSignOut={() => void leave()} />
  }

  if (needsSetup) {
    return <ParentSetup profiles={profiles} suggestedName={userName || ""} onSave={saveOwnProfile} onDone={open} onSignOut={() => void leave()} />
  }

  if (!active) {
    return <WhoIsHere profiles={profiles} completions={completions} prizeRequests={prizeRequests} onUnlocked={open} onSetPin={setPin} onSignOut={() => void leave()} />
  }

  if (active.profile_type === "parent") {
    return (
      <ParentApp
        profile={active}
        profiles={profiles}
        inactiveProfiles={inactiveProfiles}
        chores={chores}
        completions={completions}
        prizeRequests={prizeRequests}
        goals={goals}
        rewards={rewards}
        sharingAvailable={sharingAvailable}
        onRefresh={loadData}
        onSwitchProfile={() => open(null)}
        onSignOut={() => void leave()}
      />
    )
  }

  return (
    <KidApp
      profile={active}
      profiles={profiles}
      chores={chores}
      completions={completions}
      prizeRequests={prizeRequests}
      goals={goals}
      rewards={rewards}
      onRefresh={loadData}
      onSwitchProfile={() => open(null)}
      onThemeChange={changeTheme}
    />
  )
}
