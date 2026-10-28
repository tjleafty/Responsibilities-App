import { useMemo, type ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { accountStatus, type FamilyAccount } from "@/lib/companyAdmin"
import { formatPrice, monthlyCents, type Plan } from "@/lib/billing"
import { relativeTime } from "@/lib/family"
import { StatusBadge } from "@/components/admin/StatusBadge"

const DAY = 24 * 3600 * 1000

/** The company at a glance: how many families, who pays, and who needs a nudge. */
export function AdminOverview({ families, plans, onOpenFamilies }: { families: FamilyAccount[]; plans: Plan[]; onOpenFamilies: (familyId: string) => void }) {
  const stats = useMemo(() => {
    const now = Date.now()
    const byStatus = families.map((family) => ({ family, status: accountStatus(family) }))
    const count = (status: string) => byStatus.filter((row) => row.status === status).length
    const paying = byStatus.filter((row) => row.status === "paying")
    const mrr = paying.reduce((sum, row) => {
      const plan = plans.find((item) => item.id === row.family.plan_id)
      return sum + (plan ? monthlyCents(plan) : 0)
    }, 0)
    const trialsEnding = byStatus
      .filter((row) => row.status === "trial" && row.family.trial_ends_at && new Date(row.family.trial_ends_at).getTime() - now < 7 * DAY)
      .sort((a, b) => new Date(a.family.trial_ends_at!).getTime() - new Date(b.family.trial_ends_at!).getTime())
    const attention = byStatus.filter((row) => row.status === "past_due")
    const newThisMonth = families.filter((family) => now - new Date(family.created_at).getTime() < 30 * DAY).length
    const activeWeek = families.filter((family) => family.last_active && now - new Date(family.last_active).getTime() < 7 * DAY).length
    return { paying: paying.length, trial: count("trial"), comped: count("comped"), ended: count("ended") + count("ending"), mrr, trialsEnding, attention, newThisMonth, activeWeek }
  }, [families, plans])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Monthly revenue" value={formatPrice(Math.round(stats.mrr))} hint={`${formatPrice(Math.round(stats.mrr * 12))} a year`} />
        <Stat label="Families" value={families.length} hint={`${stats.newThisMonth} new in 30 days`} />
        <Stat label="Paying" value={stats.paying} hint={`${stats.trial} on a free trial`} />
        <Stat label="Active this week" value={stats.activeWeek} hint={`${stats.comped} free, ${stats.ended} ended`} />
      </div>

      <List title="Trials ending this week" empty="No trials end in the next 7 days." rows={stats.trialsEnding} onOpen={onOpenFamilies}
        detail={(family) => `Ends ${new Date(family.trial_ends_at!).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${family.completions_30d} chores done in 30 days`} />
      <List title="Payment failed" empty="Every payment went through." rows={stats.attention} onOpen={onOpenFamilies}
        detail={(family) => `Last active ${relativeTime(family.last_active) || "never"}`} />
    </div>
  )
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint: string }) {
  return (
    <div className="rounded-[22px] bg-card p-4 shadow-soft">
      <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function List({ title, empty, rows, detail, onOpen }: { title: string; empty: string; rows: Array<{ family: FamilyAccount; status: ReturnType<typeof accountStatus> }>; detail: (family: FamilyAccount) => string; onOpen: (familyId: string) => void }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="rounded-[20px] bg-card p-4 text-muted-foreground shadow-soft">{empty}</p> : (
        <ul className="overflow-hidden rounded-[20px] bg-card shadow-soft">
          {rows.map(({ family, status }, index) => (
            <li key={family.family_id}>
              <button type="button" onClick={() => onOpen(family.family_id)} className={`flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted/60 ${index ? "border-t border-border" : ""}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{family.family_name} <span className="font-normal text-muted-foreground">{family.member_emails[0] ?? ""}</span></span>
                  <span className="block text-sm text-muted-foreground">{detail(family)}</span>
                </span>
                <StatusBadge status={status} />
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
