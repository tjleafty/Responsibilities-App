import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"
import { getAuthToken } from "@/lib/auth"
import { demoBilling, type Plan, type SubscriptionStatus } from "@/lib/billing"

/* The company dashboard's data: every family, plans and pricing (migration 20261028000200). Admins only. */

export interface FamilyAccount {
  family_id: string
  family_name: string
  created_at: string
  member_emails: string[]
  members: number
  kids: number
  chores: number
  completions_30d: number
  last_active: string | null
  plan_id: string | null
  status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_end: string | null
  admin_note: string | null
}

const DAY = 24 * 3600 * 1000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
const demoFamilies: FamilyAccount[] = DEMO_MODE ? [
  { family_id: "demo", family_name: "The Leaftys", created_at: ago(40), member_emails: ["tj@example.com", "sarah@example.com"], members: 2, kids: 3, chores: 14, completions_30d: 212, last_active: ago(0), plan_id: null, status: "comped", trial_ends_at: null, current_period_end: null, admin_note: "Company team" },
  { family_id: "f2", family_name: "The Garcias", created_at: ago(20), member_emails: ["ana@example.com"], members: 1, kids: 2, chores: 9, completions_30d: 88, last_active: ago(1), plan_id: "family-monthly", status: "active", trial_ends_at: ago(6), current_period_end: ago(-24), admin_note: null },
  { family_id: "f3", family_name: "Our family", created_at: ago(9), member_emails: ["sam@example.com"], members: 1, kids: 1, chores: 4, completions_30d: 12, last_active: ago(3), plan_id: null, status: "trialing", trial_ends_at: ago(-5), current_period_end: null, admin_note: null },
  { family_id: "f4", family_name: "The Parks", created_at: ago(60), member_emails: ["jo@example.com", "lee@example.com"], members: 2, kids: 4, chores: 20, completions_30d: 340, last_active: ago(0), plan_id: "family-yearly", status: "active", trial_ends_at: ago(46), current_period_end: ago(-300), admin_note: null },
  { family_id: "f5", family_name: "Our family", created_at: ago(30), member_emails: ["kim@example.com"], members: 1, kids: 1, chores: 2, completions_30d: 0, last_active: ago(18), plan_id: null, status: "trialing", trial_ends_at: ago(16), current_period_end: null, admin_note: null },
] : []

export async function listFamilies(): Promise<FamilyAccount[]> {
  if (DEMO_MODE) return [...demoFamilies]
  const { data, error } = await supabase.rpc("admin_family_overview")
  if (error) throw error
  return data as FamilyAccount[]
}

export async function listPlans(): Promise<Plan[]> {
  if (DEMO_MODE) return [...demoBilling.plans]
  const { data, error } = await supabase.from("plans").select("*").order("sort")
  if (error) throw error
  return data as Plan[]
}

/** Saves a plan through the server, which also keeps its Stripe price in step. */
export async function savePlan(plan: Omit<Plan, "provider_price_id">): Promise<{ plan: Plan; stripe: boolean }> {
  if (DEMO_MODE) {
    const index = demoBilling.plans.findIndex((item) => item.id === plan.id)
    const saved = { ...plan, provider_price_id: demoBilling.plans[index]?.provider_price_id ?? `price_demo_${Date.now()}` }
    if (index >= 0) demoBilling.plans[index] = saved
    else demoBilling.plans.push(saved)
    return { plan: saved, stripe: true }
  }
  const response = await fetch("/api/admin/plan", {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken() ?? ""}`, "Content-Type": "application/json" },
    body: JSON.stringify(plan),
  })
  const result = await response.json().catch(() => ({})) as { plan?: Plan; stripe?: boolean; error?: string }
  if (!response.ok || !result.plan) throw new Error(result.error ?? "Saving the plan failed.")
  return { plan: result.plan, stripe: !!result.stripe }
}

export interface SubscriptionChange {
  status?: SubscriptionStatus
  trial_ends_at?: string | null
  admin_note?: string | null
}

/** Comp a family, extend its trial, end its access, or leave a note. */
export async function updateFamilySubscription(familyId: string, change: SubscriptionChange) {
  if (DEMO_MODE) {
    const family = demoFamilies.find((item) => item.family_id === familyId)
    if (family) Object.assign(family, change)
    return
  }
  const { error } = await supabase.from("family_subscriptions").upsert({ family_id: familyId, ...change }, { onConflict: "family_id" })
  if (error) throw error
}

export type AccountStatus = "paying" | "trial" | "comped" | "past_due" | "ending" | "ended"

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: string }> = {
  paying: { label: "Paying", tone: "bg-success/15 text-success" },
  trial: { label: "Free trial", tone: "bg-secondary text-secondary-foreground" },
  comped: { label: "Free (comped)", tone: "bg-primary/15 text-primary" },
  past_due: { label: "Payment failed", tone: "bg-coral/15 text-coral" },
  ending: { label: "Canceled", tone: "bg-accent text-accent-foreground" },
  ended: { label: "Trial ended", tone: "bg-muted text-muted-foreground" },
}

const future = (date: string | null) => !!date && new Date(date).getTime() > Date.now()

/** Where a family stands, in one word, from its subscription row. */
export function accountStatus(account: Pick<FamilyAccount, "status" | "trial_ends_at" | "current_period_end">): AccountStatus {
  switch (account.status) {
    case "active": return "paying"
    case "comped": return "comped"
    case "past_due": return "past_due"
    case "trialing": return future(account.trial_ends_at) ? "trial" : "ended"
    case "canceled": return future(account.current_period_end) ? "ending" : "ended"
    default: return "ended"
  }
}
