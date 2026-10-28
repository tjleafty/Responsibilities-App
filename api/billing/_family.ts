import type { ApiRequest } from "../_lib/server.js"
import { userDb } from "../_lib/server.js"

export interface SubscriptionRow {
  family_id: string
  plan_id: string | null
  status: string
  trial_ends_at: string | null
  current_period_end: string | null
  provider_customer_id: string | null
  provider_subscription_id: string | null
}

/** The signed-in login's family and its subscription, read with their own permissions. */
export async function familyOf(req: ApiRequest) {
  const db = userDb(req)
  const { data: family } = await db.from("families").select("id, name").order("created_at").limit(1).maybeSingle()
  if (!family) return null
  const { data: subscription } = await db.from("family_subscriptions").select("*").eq("family_id", family.id).maybeSingle()
  return { db, family: family as { id: string; name: string }, subscription: subscription as SubscriptionRow | null }
}
