import { useState } from "react"
import { Check, CreditCard, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark, ErrorNote, Sheet } from "@/components/kit"
import { formatPrice, monthlyCents, openBillingPortal, startCheckout, useBilling, type Access, type Plan } from "@/lib/billing"
import { cn } from "@/lib/utils"

const longDate = (stamp: string | null) => (stamp ? new Date(stamp).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) : "")

function describe(access: Access, subscription: ReturnType<typeof useBilling>["subscription"], plan: Plan | undefined): string {
  switch (access.state) {
    case "trial": return `You're on the free trial. ${access.daysLeft === 1 ? "1 day" : `${access.daysLeft} days`} left, until ${longDate(subscription?.trial_ends_at ?? null)}.`
    case "paid": return plan ? `You're on ${plan.name} at ${formatPrice(plan.price_cents, plan.billing_interval)}.${subscription?.current_period_end ? ` Next payment ${longDate(subscription.current_period_end)}.` : ""}` : "Your subscription is active."
    case "comped": return "Your family has free access. Thanks for being part of the app!"
    case "past_due": return "Your last payment didn't go through. Update your card to keep everything running."
    case "ending": return `Your subscription is canceled. Everything keeps working until ${longDate(subscription?.current_period_end ?? null)}.`
    case "ended": return "Your free trial has ended. Choose a plan to keep using the app."
    default: return "Your family has full access."
  }
}

/** The active plans as buttons that go to Stripe Checkout. */
export function PlanChooser({ plans }: { plans: Plan[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const forSale = plans.filter((plan) => plan.provider_price_id)
  const priciestMonthly = Math.max(...forSale.map(monthlyCents))
  const choose = async (plan: Plan) => {
    setBusy(plan.id)
    setError(null)
    try {
      await startCheckout(plan.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout isn't available right now.")
    } finally {
      setBusy(null)
    }
  }
  if (forSale.length === 0) return <p className="text-muted-foreground">Plans aren't on sale yet.</p>
  return (
    <div className="space-y-3">
      {forSale.map((plan) => {
        const saves = plan.billing_interval === "year" && monthlyCents(plan) < priciestMonthly
        return (
          <button key={plan.id} type="button" disabled={!!busy} onClick={() => void choose(plan)}
            className={cn("flex w-full items-center gap-4 rounded-[22px] border-2 bg-card p-4 text-left shadow-soft transition-colors hover:border-primary disabled:opacity-60", saves ? "border-primary" : "border-transparent")}>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 font-display text-lg font-semibold">{plan.name}{saves ? <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-extrabold text-primary-foreground">Best value</span> : null}</span>
              {plan.description ? <span className="block text-sm text-muted-foreground">{plan.description}</span> : null}
            </span>
            <span className="text-right">
              <span className="block font-display text-2xl font-semibold tabular-nums">{formatPrice(plan.price_cents)}</span>
              <span className="block text-xs font-bold text-muted-foreground">{busy === plan.id ? "Opening..." : plan.billing_interval === "month" ? "per month" : "per year"}</span>
            </span>
          </button>
        )
      })}
      <ErrorNote>{error}</ErrorNote>
      <p className="text-center text-xs text-muted-foreground">Secure checkout by Stripe. Cancel anytime.</p>
    </div>
  )
}

/** Family > Plan and billing. */
export function BillingSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { plans, subscription, access } = useBilling()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const plan = plans.find((item) => item.id === subscription?.plan_id)
  const hasAccount = !!subscription?.provider_customer_id
  const canBuy = ["trial", "ended", "ending", "free"].includes(access.state) && !subscription?.provider_subscription_id
  const manage = async () => {
    setBusy(true)
    setError(null)
    try {
      await openBillingPortal()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Billing isn't available right now.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Plan and billing" description={describe(access, subscription, plan)}>
      <div className="space-y-4 pb-2">
        {canBuy ? <PlanChooser plans={plans} /> : null}
        {hasAccount && access.state !== "comped" ? (
          <Button variant={canBuy ? "outline" : "default"} disabled={busy} onClick={() => void manage()} className="w-full"><CreditCard className="h-5 w-5" />{busy ? "Opening..." : "Manage billing, card and receipts"}</Button>
        ) : null}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  )
}

/** A short note at the top of parent screens when the trial is nearly over or a payment failed. */
export function BillingBanner({ onOpen }: { onOpen: () => void }) {
  const { access, billingOn } = useBilling()
  const soon = access.state === "trial" && access.daysLeft !== null && access.daysLeft <= 3
  if (!billingOn || (!soon && access.state !== "past_due")) return null
  return (
    <button type="button" onClick={onOpen} className={cn("mb-4 flex w-full items-center gap-3 rounded-[20px] p-3 text-left font-semibold shadow-soft", access.state === "past_due" ? "bg-coral/15" : "bg-accent text-accent-foreground")}>
      <Sparkles className="h-5 w-5 shrink-0 text-primary" />
      <span className="flex-1">{access.state === "past_due" ? "Your last payment didn't go through. Tap to update your card." : `Your free trial ends in ${access.daysLeft === 1 ? "1 day" : `${access.daysLeft} days`}. Tap to choose a plan.`}</span>
    </button>
  )
}

/** Shown to the whole family once the trial is over and nobody has picked a plan. */
export function BillingWall({ onSignOut }: { onSignOut: () => void }) {
  const { plans } = useBilling()
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md space-y-6">
        <BrandMark className="justify-center" />
        <div className="text-center">
          <h1 className="font-display text-3xl font-semibold">Your free trial has ended</h1>
          <p className="mt-2 text-muted-foreground">Your chores, points and prizes are all saved. Pick a plan to pick up right where you left off.</p>
        </div>
        <ul className="space-y-2 rounded-[22px] bg-card p-4 shadow-soft">
          {["Every kid and grown-up in your household", "All chores, schedules, prizes and themes", "Works on every phone, tablet and computer"].map((line) => (
            <li key={line} className="flex items-center gap-2 font-semibold"><Check className="h-5 w-5 shrink-0 text-success" />{line}</li>
          ))}
        </ul>
        <PlanChooser plans={plans} />
        <p className="text-center text-sm text-muted-foreground">Kids: ask a grown-up to choose a plan.</p>
        <Button variant="ghost" onClick={onSignOut} className="w-full">Log out</Button>
      </div>
    </main>
  )
}
