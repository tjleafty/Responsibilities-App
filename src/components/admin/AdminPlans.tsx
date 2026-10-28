import { useEffect, useState } from "react"
import { Check, CircleAlert, Link2, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { ErrorNote, Field, inputClass, Segmented, Stepper } from "@/components/kit"
import { formatPrice, monthlyCents, type BillingInterval, type Plan } from "@/lib/billing"
import { savePlan } from "@/lib/companyAdmin"

type Draft = Omit<Plan, "provider_price_id"> & { price: string }

const toDraft = (plan: Plan): Draft => ({ ...plan, price: (plan.price_cents / 100).toFixed(2) })
const blank = (sort: number): Draft => ({ id: "", name: "", description: "", price_cents: 0, price: "", billing_interval: "month", trial_days: 14, is_active: true, sort })

/** Plans and pricing. Saving a priced plan creates its Stripe price, so families can buy it. */
export function AdminPlans({ plans, onChanged }: { plans: Plan[]; onChanged: () => Promise<void> }) {
  const [adding, setAdding] = useState(false)
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground">
        Families see the active plans when their free trial ends. A new price applies to new subscribers; current subscribers keep the price they signed up at.
      </p>
      <ul className="space-y-4">
        {plans.map((plan) => <li key={plan.id}><PlanCard plan={plan} onSaved={onChanged} /></li>)}
        {adding ? <li><PlanCard plan={null} sort={plans.length + 1} onSaved={async () => { setAdding(false); await onChanged() }} onCancel={() => setAdding(false)} /></li> : null}
      </ul>
      {!adding ? <Button variant="outline" onClick={() => setAdding(true)} className="w-full"><Plus className="h-5 w-5" />Add a plan</Button> : null}
    </div>
  )
}

function PlanCard({ plan, sort = 0, onSaved, onCancel }: { plan: Plan | null; sort?: number; onSaved: () => Promise<void>; onCancel?: () => void }) {
  const [draft, setDraft] = useState<Draft>(plan ? toDraft(plan) : blank(sort))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  useEffect(() => { if (plan) setDraft(toDraft(plan)) }, [plan])

  const cents = Math.round(Number(draft.price) * 100)
  const priceOk = draft.price.trim() !== "" && Number.isFinite(cents) && cents >= 0
  // A priced plan without a Stripe price can be saved as-is, to put it on sale once Stripe is connected.
  const changed = !plan || JSON.stringify(toDraft(plan)) !== JSON.stringify(draft) || (!plan.provider_price_id && plan.price_cents > 0)
  const set = (value: Partial<Draft>) => setDraft((current) => ({ ...current, ...value }))

  const save = async () => {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const id = draft.id || draft.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      const { price: _price, ...rest } = draft
      const result = await savePlan({ ...rest, id, price_cents: cents })
      setNotice(result.stripe ? "Saved. Stripe has the new price." : "Saved. Families can buy it once Stripe is connected.")
      await onSaved()
    } catch (caught) {
      console.error("Saving a plan failed:", caught)
      setError(caught instanceof Error ? caught.message : "That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="space-y-4 rounded-[24px] bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-xl font-semibold">{plan ? plan.name : "New plan"}</p>
          {plan ? (
            <p className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
              {plan.provider_price_id ? <><Link2 className="h-4 w-4 text-success" />On sale in Stripe</> : <><CircleAlert className="h-4 w-4 text-coral" />Not on sale yet. Save to send it to Stripe</>}
              {plan.billing_interval === "year" && plan.price_cents ? ` · ${formatPrice(Math.round(monthlyCents(plan)))}/mo` : ""}
            </p>
          ) : null}
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">Active<Switch checked={draft.is_active} onCheckedChange={(on) => set({ is_active: on })} /></label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name"><input className={inputClass} value={draft.name} onChange={(event) => set({ name: event.target.value })} maxLength={60} /></Field>
        <Field label="Price (USD)">
          <input className={inputClass} inputMode="decimal" value={draft.price} onChange={(event) => set({ price: event.target.value.replace(/[^0-9.]/g, "") })} aria-invalid={!priceOk} />
        </Field>
      </div>
      <Field label="Description families see"><input className={inputClass} value={draft.description} onChange={(event) => set({ description: event.target.value })} maxLength={200} /></Field>
      <div className="flex flex-wrap items-center gap-4">
        <Segmented<BillingInterval> value={draft.billing_interval} onChange={(value) => set({ billing_interval: value })} className="min-w-56 flex-1" options={[{ value: "month", label: "Monthly" }, { value: "year", label: "Yearly" }]} />
        <span className="flex items-center gap-2 text-sm font-bold">Free trial days <Stepper value={draft.trial_days} onChange={(value) => set({ trial_days: value })} max={90} label="free trial days" /></span>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {notice ? <p className="text-sm font-semibold text-success">{notice}</p> : null}
      <div className="flex gap-3">
        {onCancel ? <Button variant="ghost" onClick={onCancel}>Cancel</Button> : null}
        <Button disabled={busy || !changed || !draft.name.trim() || !priceOk} onClick={() => void save()} className="flex-1"><Check className="h-5 w-5" />{busy ? "Saving..." : "Save plan"}</Button>
      </div>
    </article>
  )
}
