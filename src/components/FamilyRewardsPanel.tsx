import { useState, type FormEvent } from "react"
import { Gift, Plus, Trash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { overskill } from "@/lib/auth"
import type { FamilyProfile } from "@/lib/familyTypes"

export interface FamilyReward {
  id: string
  title: string
  description?: string | null
  reward_type: "participation" | "goal" | "chore"
  target_profile_id?: string | null
  points_required?: number
  is_active?: boolean
}

interface FamilyRewardsPanelProps {
  profiles: FamilyProfile[]
  rewards: FamilyReward[]
  onRefresh: () => Promise<void>
}

export function FamilyRewardsPanel({ profiles, rewards, onRefresh }: FamilyRewardsPanelProps) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [rewardType, setRewardType] = useState<FamilyReward["reward_type"]>("participation")
  const [profileId, setProfileId] = useState("")
  const [points, setPoints] = useState("0")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createReward = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      await overskill.entities.family_reward.create({
        title: title.trim(),
        description: description.trim(),
        reward_type: rewardType,
        target_profile_id: profileId || "",
        points_required: Math.max(0, Number(points) || 0),
        is_active: true,
      })
      setTitle("")
      setDescription("")
      setPoints("0")
      await onRefresh()
    } catch (caught) {
      console.error("Reward creation failed:", caught)
      setError("We couldn't save that reward. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  const toggleReward = async (reward: FamilyReward, active: boolean) => {
    setError(null)
    try {
      await overskill.entities.family_reward.update(reward.id, { is_active: active })
      await onRefresh()
    } catch (caught) {
      console.error("Reward update failed:", caught)
      setError("We couldn't update that reward.")
    }
  }

  const removeReward = async (reward: FamilyReward) => {
    setError(null)
    try {
      await overskill.entities.family_reward.delete(reward.id)
      await onRefresh()
    } catch (caught) {
      console.error("Reward removal failed:", caught)
      setError("We couldn't remove that reward.")
    }
  }

  return (
    <section className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]" aria-labelledby="rewards-heading" data-element-id="family-rewards">
      <form onSubmit={createReward} className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Gift className="h-5 w-5" /></span><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Celebrate effort</p><h2 id="rewards-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Create a family reward</h2></div></div>
        <div className="mt-5 space-y-4">
          <label className="block space-y-2 text-sm font-medium text-card-foreground">Reward name<Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Choose the family movie" /></label>
          <label className="block space-y-2 text-sm font-medium text-card-foreground">What does it include?<Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A small reward for showing up and trying" className="min-h-24 text-base md:text-sm" /></label>
          <label className="block space-y-2 text-sm font-medium text-card-foreground">Reward category<select value={rewardType} onChange={(event) => setRewardType(event.target.value as FamilyReward["reward_type"])} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="participation">Participation</option><option value="chore">Chore completion</option><option value="goal">Goal milestone</option></select></label>
          <label className="block space-y-2 text-sm font-medium text-card-foreground">For profile (optional)<select value={profileId} onChange={(event) => setProfileId(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="">Any family profile</option>{profiles.filter((profile) => profile.is_active !== false).map((profile) => <option key={profile.id} value={profile.id}>{profile.display_name}</option>)}</select></label>
          <label className="block space-y-2 text-sm font-medium text-card-foreground">Points needed<Input type="number" min="0" value={points} onChange={(event) => setPoints(event.target.value)} /></label>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" disabled={saving || !title.trim()} className="w-full"><Plus className="h-4 w-4" />{saving ? "Saving reward…" : "Create reward"}</Button>
        </div>
      </form>
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Reward shelf</p><h2 className="mt-1 font-display text-2xl font-bold text-card-foreground">Rewards in your household</h2></div><span className="tabular-nums text-sm text-muted-foreground">{rewards.filter((reward) => reward.is_active !== false).length} active</span></div>
        {rewards.length === 0 ? <p className="mt-5 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Create a participation prize, a chore reward, or a goal milestone to start your reward shelf.</p> : <div className="mt-5 space-y-3">{rewards.map((reward) => <article key={reward.id} className="flex min-w-0 items-start justify-between gap-3 rounded-2xl border border-border p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold text-card-foreground">{reward.title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize text-muted-foreground">{reward.reward_type}</span>{reward.is_active === false ? <span className="text-xs text-muted-foreground">Inactive</span> : null}</div>{reward.description ? <p className="mt-1 text-sm text-muted-foreground">{reward.description}</p> : null}<p className="mt-2 text-xs text-muted-foreground">{Number(reward.points_required) || 0} points · {reward.target_profile_id ? profiles.find((profile) => profile.id === reward.target_profile_id)?.display_name ?? "Profile" : "Any profile"}</p></div><div className="flex shrink-0 items-center gap-2"><label className="flex items-center gap-2 text-xs text-muted-foreground"><Checkbox checked={reward.is_active !== false} onCheckedChange={(checked) => void toggleReward(reward, checked === true)} aria-label={`Set ${reward.title} active`} />Active</label><Button type="button" variant="ghost" size="icon" onClick={() => void removeReward(reward)} aria-label={`Delete ${reward.title}`} className="text-destructive hover:bg-destructive/10 hover:text-destructive"><Trash className="h-4 w-4" /></Button></div></article>)}</div>}
      </div>
    </section>
  )
}
