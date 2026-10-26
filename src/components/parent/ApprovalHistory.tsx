import { useState } from "react"
import { ArrowLeft, Check, MessageSquareText, RotateCcw } from "lucide-react"
import { Avatar, Chip, EmptyState, StateChip, TokenPill } from "@/components/kit"
import type { ChoreCompletionRecord, ChoreRecord, FamilyProfile } from "@/lib/familyTypes"
import { choreState, kidsOf } from "@/lib/family"
import { getPeriodKey } from "@/lib/choreUtils"
import { getKidTheme } from "@/lib/themes"
import { parseUTC } from "@/lib/utils"

type Result = "all" | "done" | "sent_back"

/** Every approve and send-back decision, newest first, grouped by day. */
export function reviewedRows(completions: ChoreCompletionRecord[], chores: ChoreRecord[]) {
  const choreIds = new Set(chores.map((chore) => chore.id))
  return completions
    .filter((row) => row.verified_at && choreIds.has(row.chore_id) && (choreState(row) === "done" || choreState(row) === "sent_back"))
    .sort((a, b) => parseUTC(b.verified_at ?? "").getTime() - parseUTC(a.verified_at ?? "").getTime())
}

function dayLabel(date: Date) {
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  const key = getPeriodKey("daily", date)
  if (key === getPeriodKey("daily", today)) return "Today"
  if (key === getPeriodKey("daily", yesterday)) return "Yesterday"
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(date)
}

const timeOf = (date: Date) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(date)

export function ApprovalHistory({ profiles, chores, completions, onBack }: { profiles: FamilyProfile[]; chores: ChoreRecord[]; completions: ChoreCompletionRecord[]; onBack: () => void }) {
  const [kid, setKid] = useState<string | null>(null)
  const [result, setResult] = useState<Result>("all")
  const all = reviewedRows(completions, chores)
  const rows = all.filter((row) => (!kid || row.profile_id === kid) && (result === "all" || choreState(row) === result))
  const choreById = new Map(chores.map((chore) => [chore.id, chore]))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

  const groups: Array<{ label: string; rows: ChoreCompletionRecord[] }> = []
  rows.forEach((row) => {
    const label = dayLabel(parseUTC(row.verified_at ?? ""))
    const group = groups[groups.length - 1]
    if (group?.label === label) group.rows.push(row)
    else groups.push({ label, rows: [row] })
  })

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card shadow-soft" aria-label="Back to review queue"><ArrowLeft className="h-5 w-5" /></button>
        <div>
          <h1 className="font-display text-3xl font-semibold">Approval history</h1>
          <p className="text-muted-foreground">Every chore you approved or sent back.</p>
        </div>
      </header>

      <div className="space-y-2">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none sm:mx-0 sm:px-0">
          <Chip active={!kid} onClick={() => setKid(null)}>All kids</Chip>
          {kidsOf(profiles).map((profile) => <Chip key={profile.id} active={kid === profile.id} onClick={() => setKid(profile.id)}>{profile.display_name} <span className="opacity-70">{all.filter((row) => row.profile_id === profile.id).length}</span></Chip>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={result === "all"} onClick={() => setResult("all")}>All results</Chip>
          <Chip active={result === "done"} onClick={() => setResult("done")}><Check className="h-4 w-4" />Approved</Chip>
          <Chip active={result === "sent_back"} onClick={() => setResult("sent_back")}><RotateCcw className="h-4 w-4" />Sent back</Chip>
        </div>
      </div>

      {groups.length === 0 ? <EmptyState emoji="🗂️" title="Nothing here yet">Decisions show up here after you approve or send back a chore.</EmptyState> : null}

      {groups.map((group) => {
        const approved = group.rows.filter((row) => choreState(row) === "done").length
        const sentBack = group.rows.length - approved
        return (
          <section key={group.label} className="space-y-2">
            <h2 className="flex items-baseline justify-between font-display text-xl font-semibold">
              {group.label}
              <span className="text-sm font-bold text-muted-foreground">{[approved ? `${approved} approved` : "", sentBack ? `${sentBack} sent back` : ""].filter(Boolean).join(", ")}</span>
            </h2>
            <ul className="space-y-2">
              {group.rows.map((row) => {
                const profile = profileById.get(row.profile_id)
                const state = choreState(row)
                const points = Number(row.reward_points_snapshot) || 0
                return (
                  <li key={row.id} className="rounded-[22px] bg-card p-4 shadow-soft">
                    <div className="flex items-center gap-3">
                      {profile ? <Avatar profile={profile} size={40} /> : null}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{profile?.display_name ?? "Someone"}</span> · {timeOf(parseUTC(row.verified_at ?? ""))}</p>
                        <p className="truncate font-display text-lg font-semibold">{choreById.get(row.chore_id)?.title}</p>
                      </div>
                      <StateChip state={state} label={state === "done" ? "Approved" : undefined} />
                    </div>
                    {state === "done" && points > 0 ? <TokenPill amount={points} token={getKidTheme(profile?.theme_key ?? "").token} prefix="+" className="mt-2" /> : null}
                    {state === "sent_back" ? (
                      <div className="mt-3 space-y-2 rounded-2xl bg-coral/10 p-3 text-sm">
                        <p className="flex items-center gap-1.5 font-bold text-coral"><RotateCcw className="h-4 w-4" />{row.rejection_reason || "Sent back"}</p>
                        {row.parent_feedback ? <p className="flex items-start gap-1.5"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0" />“{row.parent_feedback}”</p> : null}
                      </div>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
