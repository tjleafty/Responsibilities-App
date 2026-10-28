import { useEffect, useMemo, useState } from "react"
import { CalendarPlus, Check, ChevronRight, Gift, Search, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Chip, EmptyState, ErrorNote, Field, inputClass, Sheet } from "@/components/kit"
import { ACCOUNT_STATUS, accountStatus, updateFamilySubscription, type AccountStatus, type FamilyAccount, type SubscriptionChange } from "@/lib/companyAdmin"
import { formatPrice, type Plan } from "@/lib/billing"
import { relativeTime } from "@/lib/family"
import { StatusBadge } from "@/components/admin/StatusBadge"

const FILTERS: Array<AccountStatus | "all"> = ["all", "paying", "trial", "comped", "past_due", "ending", "ended"]
const DAY = 24 * 3600 * 1000
const shortDate = (stamp: string | null) => (stamp ? new Date(stamp).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "")

/** Every family account: search, filter by where they stand, and open one to change it. */
export function AdminFamilies({ families, plans, focusId, onChanged }: { families: FamilyAccount[]; plans: Plan[]; focusId?: string | null; onChanged: () => Promise<void> }) {
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<AccountStatus | "all">("all")
  const [openId, setOpenId] = useState<string | null>(focusId ?? null)
  useEffect(() => { if (focusId) setOpenId(focusId) }, [focusId])

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return families
      .map((family) => ({ family, status: accountStatus(family) }))
      .filter(({ family, status }) => (filter === "all" || status === filter)
        && (!needle || family.family_name.toLowerCase().includes(needle) || family.member_emails.some((email) => email?.toLowerCase().includes(needle))))
  }, [families, query, filter])
  const counts = useMemo(() => {
    const result: Record<string, number> = { all: families.length }
    families.forEach((family) => { const status = accountStatus(family); result[status] = (result[status] ?? 0) + 1 })
    return result
  }, [families])
  const open = families.find((family) => family.family_id === openId) ?? null

  return (
    <div className="space-y-4">
      <label className="relative block">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input className={`${inputClass} pl-12`} placeholder="Search by family or email" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search families" />
      </label>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((value) => (
          <Chip key={value} active={filter === value} onClick={() => setFilter(value)}>
            {value === "all" ? "All" : ACCOUNT_STATUS[value].label} ({counts[value] ?? 0})
          </Chip>
        ))}
      </div>

      {rows.length === 0 ? <EmptyState emoji="🔍" title="No families match">Try another search or filter.</EmptyState> : (
        <ul className="overflow-hidden rounded-[22px] bg-card shadow-soft">
          {rows.map(({ family, status }, index) => {
            const plan = plans.find((item) => item.id === family.plan_id)
            return (
              <li key={family.family_id}>
                <button type="button" onClick={() => setOpenId(family.family_id)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 ${index ? "border-t border-border" : ""}`}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-semibold">{family.family_name}</span>
                      <StatusBadge status={status} />
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{family.member_emails.filter(Boolean).join(", ") || "No email"}</span>
                    <span className="block text-xs font-bold text-muted-foreground">
                      {family.kids} {family.kids === 1 ? "kid" : "kids"} · {family.chores} chores · active {relativeTime(family.last_active) || "never"}
                      {plan ? ` · ${formatPrice(plan.price_cents, plan.billing_interval)}` : ""}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <FamilySheet family={open} plans={plans} onClose={() => setOpenId(null)} onChanged={onChanged} />
    </div>
  )
}

function FamilySheet({ family, plans, onClose, onChanged }: { family: FamilyAccount | null; plans: Plan[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { setNote(family?.admin_note ?? ""); setError(null) }, [family])
  if (!family) return <Sheet open={false} onOpenChange={onClose} title="">{null}</Sheet>

  const status = accountStatus(family)
  const plan = plans.find((item) => item.id === family.plan_id)
  const change = async (update: SubscriptionChange) => {
    setBusy(true)
    setError(null)
    try {
      await updateFamilySubscription(family.family_id, update)
      await onChanged()
    } catch (caught) {
      console.error("Changing a subscription failed:", caught)
      setError("That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }
  // Extending counts from today when the trial already ended.
  const extend = (days: number) => {
    const from = Math.max(Date.now(), family.trial_ends_at ? new Date(family.trial_ends_at).getTime() : 0)
    void change({ status: "trialing", trial_ends_at: new Date(from + days * DAY).toISOString() })
  }

  return (
    <Sheet open onOpenChange={(next) => { if (!next) onClose() }} title={family.family_name} description={`Joined ${shortDate(family.created_at)}`}>
      <div className="space-y-5 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} className="text-sm" />
          <span className="text-sm text-muted-foreground">
            {status === "trial" ? `Trial ends ${shortDate(family.trial_ends_at)}` : null}
            {status === "paying" && plan ? `${plan.name}, ${formatPrice(plan.price_cents, plan.billing_interval)}. Renews ${shortDate(family.current_period_end)}` : null}
            {status === "ending" ? `Access until ${shortDate(family.current_period_end)}` : null}
            {status === "ended" ? `Ended ${shortDate(family.current_period_end ?? family.trial_ends_at)}` : null}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Grown-ups", family.members], ["Kids", family.kids], ["Chores", family.chores], ["Done in 30 days", family.completions_30d]].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-card p-3 shadow-soft">
              <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
              <dd className="font-display text-2xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="space-y-1">
          <p className="text-sm font-bold">Logins</p>
          {family.member_emails.filter(Boolean).map((email) => <a key={email} href={`mailto:${email}`} className="block truncate text-primary underline-offset-2 hover:underline">{email}</a>)}
          <p className="text-sm text-muted-foreground">Last active {relativeTime(family.last_active) || "never"}</p>
        </div>

        <div className="space-y-2 rounded-2xl bg-muted/60 p-3">
          <p className="text-sm font-bold">Change their access</p>
          <div className="flex flex-wrap gap-2">
            <Chip onClick={() => extend(7)}><CalendarPlus className="h-4 w-4" />Trial +7 days</Chip>
            <Chip onClick={() => extend(30)}><CalendarPlus className="h-4 w-4" />Trial +30 days</Chip>
            {status === "comped"
              ? <Chip onClick={() => void change({ status: "trialing", trial_ends_at: new Date().toISOString() })}><Undo2 className="h-4 w-4" />Stop free access</Chip>
              : <Chip onClick={() => void change({ status: "comped" })}><Gift className="h-4 w-4" />Make it free</Chip>}
          </div>
          <p className="text-xs text-muted-foreground">Paying families are managed in Stripe. A change here can be undone by their next Stripe payment.</p>
        </div>

        <Field label="Notes (only the company team sees these)">
          <textarea className={`${inputClass} min-h-24 py-3`} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} />
        </Field>
        <ErrorNote>{error}</ErrorNote>
        <Button disabled={busy || note === (family.admin_note ?? "")} onClick={() => void change({ admin_note: note.trim() || null })} className="w-full"><Check className="h-5 w-5" />{busy ? "Saving..." : "Save note"}</Button>
      </div>
    </Sheet>
  )
}
