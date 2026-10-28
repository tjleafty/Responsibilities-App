import { appUrl, getUser, payloadOf, serviceDb, type ApiRequest, type ApiResponse } from "../_lib/server"
import { stripe, stripeReady } from "../_lib/stripe"
import { familyOf } from "./_family"

const LIVE = ["active", "trialing", "past_due"]

/** Starts Stripe Checkout for the family's chosen plan and returns the page to send them to. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  const user = await getUser(req)
  if (!user) return res.status(401).json({ success: false, error: "Sign in first." })
  const service = serviceDb()
  if (!stripeReady() || !service) return res.status(503).json({ success: false, error: "Payments aren't set up yet. Please try again later." })

  try {
    const found = await familyOf(req)
    if (!found) return res.status(404).json({ success: false, error: "We couldn't find your family." })
    const { db, family, subscription } = found
    const app = appUrl(req)

    // Already paying: send them to manage it instead of buying twice.
    if (subscription?.provider_customer_id && subscription.provider_subscription_id && LIVE.includes(subscription.status)) {
      const portal = await stripe<{ url: string }>("billing_portal/sessions", { customer: subscription.provider_customer_id, return_url: `${app}/dashboard` })
      return res.status(200).json({ success: true, url: portal.url })
    }

    const planId = String(payloadOf(req).planId ?? "")
    const { data: plan } = await db.from("plans").select("id, provider_price_id").eq("id", planId).eq("is_active", true).maybeSingle()
    if (!plan?.provider_price_id) return res.status(400).json({ success: false, error: "That plan isn't available right now." })

    let customer = subscription?.provider_customer_id
    if (!customer) {
      const created = await stripe<{ id: string }>("customers", { email: user.email, name: family.name, metadata: { family_id: family.id } })
      customer = created.id
      const { error } = await service.from("family_subscriptions").upsert({ family_id: family.id, provider: "stripe", provider_customer_id: customer }, { onConflict: "family_id" })
      if (error) throw error
    }

    // Keep what's left of the free trial (Stripe needs at least two days).
    const trialEnd = subscription?.status === "trialing" && subscription.trial_ends_at ? Math.floor(new Date(subscription.trial_ends_at).getTime() / 1000) : 0
    const keepTrial = trialEnd > Date.now() / 1000 + 2 * 24 * 3600

    const session = await stripe<{ url: string }>("checkout/sessions", {
      mode: "subscription",
      customer,
      client_reference_id: family.id,
      line_items: [{ price: plan.provider_price_id, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: { metadata: { family_id: family.id, plan_id: plan.id }, ...(keepTrial ? { trial_end: trialEnd } : {}) },
      metadata: { family_id: family.id },
      success_url: `${app}/dashboard?billing=success`,
      cancel_url: `${app}/dashboard?billing=canceled`,
    })
    return res.status(200).json({ success: true, url: session.url })
  } catch (error) {
    console.error("Starting checkout failed:", error)
    return res.status(500).json({ success: false, error: "We couldn't start checkout. Please try again." })
  }
}
