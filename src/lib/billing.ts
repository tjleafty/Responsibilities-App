import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"
import { getAuthToken } from "@/lib/auth"

/*
 * Plans and each family's subscription (migration 20261028000200). Payments run
 * through Stripe via /api/billing/*. Until a plan has a Stripe price, nobody is
 * ever locked out: the app only asks families to pay once billing is switched on.
 */

export type BillingInterval = "month" | "year"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "comped" | "expired"

export interface Plan {
  id: string
  name: string
  description: string
  price_cents: number
  billing_interval: BillingInterval
  trial_days: number
  provider_price_id: string | null
  is_active: boolean
  sort: number
}

export interface FamilySubscription {
  family_id: string
  plan_id: string | null
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
  admin_note: string | null
}

/** What the family can do right now. */
export type AccessState = "trial" | "paid" | "comped" | "past_due" | "ending" | "ended" | "free"

export interface Access {
  state: AccessState
  /** Whole days left in a trial or a canceled period. */
  daysLeft: number | null
  /** True when the family has to choose a plan to keep using the app. */
  locked: boolean
}

const DAY = 24 * 3600 * 1000
const daysUntil = (date: string | null, now: number) => (date ? Math.max(0, Math.ceil((new Date(date).getTime() - now) / DAY)) : null)

export function accessFor(subscription: FamilySubscription | null, billingOn: boolean, now = Date.now()): Access {
  if (!subscription) return { state: "free", daysLeft: null, locked: false }
  const trialLeft = daysUntil(subscription.trial_ends_at, now)
  const periodLeft = daysUntil(subscription.current_period_end, now)
  const before = (date: string | null) => !!date && new Date(date).getTime() > now
  let state: AccessState
  switch (subscription.status) {
    case "comped": state = "comped"; break
    case "active": state = "paid"; break
    case "past_due": state = "past_due"; break
    case "trialing":
      // A Stripe trial (card on file) or the app's own free trial.
      state = subscription.provider_subscription_id ? "paid" : before(subscription.trial_ends_at) ? "trial" : "ended"
      break
    case "canceled": state = before(subscription.current_period_end) ? "ending" : "ended"; break
    default: state = "ended"
  }
  return { state, daysLeft: state === "trial" ? trialLeft : state === "ending" ? periodLeft : null, locked: billingOn && state === "ended" }
}

export function formatPrice(cents: number, interval?: BillingInterval) {
  const amount = (cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD", minimumFractionDigits: cents % 100 ? 2 : 0 })
  return interval ? `${amount}/${interval === "month" ? "mo" : "yr"}` : amount
}

/** A plan's price per month, for comparing plans and totaling revenue. */
export const monthlyCents = (plan: Pick<Plan, "price_cents" | "billing_interval">) => (plan.billing_interval === "year" ? plan.price_cents / 12 : plan.price_cents)

// PGRST205 / 42P01: the billing tables aren't on the database yet.
const missing = (error: { code?: string } | null) => !!error && ["PGRST205", "42P01"].includes(error.code ?? "")

const demoPlans: Plan[] = [
  { id: "family-monthly", name: "Family (monthly)", description: "Every kid and grown-up in one household.", price_cents: 499, billing_interval: "month", trial_days: 14, provider_price_id: "price_demo_1", is_active: true, sort: 1 },
  { id: "family-yearly", name: "Family (yearly)", description: "Every kid and grown-up in one household. Two months free.", price_cents: 4990, billing_interval: "year", trial_days: 14, provider_price_id: "price_demo_2", is_active: true, sort: 2 },
]
export const demoBilling = {
  plans: DEMO_MODE ? demoPlans : [],
  subscription: (DEMO_MODE ? { family_id: "demo", plan_id: null, status: "trialing", trial_ends_at: new Date(Date.now() + 9 * DAY).toISOString(), current_period_end: null, provider_customer_id: null, provider_subscription_id: null, admin_note: null } : null) as FamilySubscription | null,
}

interface BillingState {
  plans: Plan[]
  subscription: FamilySubscription | null
  billingOn: boolean
  loaded: boolean
}

let state: BillingState = { plans: [], subscription: null, billingOn: false, loaded: false }
const listeners = new Set<() => void>()
const publish = () => listeners.forEach((listener) => listener())

export async function loadBilling(): Promise<BillingState> {
  if (DEMO_MODE) {
    state = { plans: demoBilling.plans.filter((plan) => plan.is_active), subscription: demoBilling.subscription, billingOn: true, loaded: true }
  } else {
    const [plans, subscription] = await Promise.all([
      supabase.from("plans").select("*").eq("is_active", true).order("sort"),
      supabase.from("family_subscriptions").select("*").limit(1).maybeSingle(),
    ])
    if (plans.error && !missing(plans.error)) console.error("Loading plans failed:", plans.error)
    if (subscription.error && !missing(subscription.error)) console.error("Loading the subscription failed:", subscription.error)
    const list = (plans.data ?? []) as Plan[]
    state = { plans: list, subscription: (subscription.data ?? null) as FamilySubscription | null, billingOn: list.some((plan) => !!plan.provider_price_id), loaded: true }
  }
  publish()
  return state
}

export function useBilling() {
  const [, rerender] = useState(0)
  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])
  return { ...state, access: accessFor(state.subscription, state.billingOn) }
}

async function billingCall(path: string, body: Record<string, unknown> = {}): Promise<string> {
  const token = getAuthToken()
  if (!token) throw new Error("Sign in first.")
  const response = await fetch(path, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const result = await response.json().catch(() => ({})) as { url?: string; error?: string }
  if (!response.ok || !result.url) throw new Error(result.error ?? "Billing isn't available right now.")
  return result.url
}

/** Sends the browser to Stripe Checkout for a plan. */
export async function startCheckout(planId: string) {
  if (DEMO_MODE) {
    demoBilling.subscription = { ...demoBilling.subscription!, status: "active", plan_id: planId, provider_subscription_id: "sub_demo", current_period_end: new Date(Date.now() + 30 * DAY).toISOString() }
    await loadBilling()
    return
  }
  window.location.assign(await billingCall("/api/billing/checkout", { planId }))
}

/** Sends the browser to Stripe's page for changing the card or plan, receipts, or canceling. */
export async function openBillingPortal() {
  if (DEMO_MODE) return
  window.location.assign(await billingCall("/api/billing/portal"))
}
