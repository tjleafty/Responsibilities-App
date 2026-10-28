import { payloadOf, serviceDb, type ApiRequest, type ApiResponse } from "../_lib/server.js"
import { statusFromStripe, stripe, stripeReady, type StripeSubscription } from "../_lib/stripe.js"

const iso = (seconds?: number | null) => (seconds ? new Date(seconds * 1000).toISOString() : null)

/*
 * Stripe calls this when a subscription starts, changes or ends. Rather than
 * trusting the posted body, it fetches the event back from Stripe by id, so a
 * forged call can't change anyone's subscription.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ received: false })
  const service = serviceDb()
  if (!stripeReady() || !service) return res.status(503).json({ received: false, error: "Billing isn't set up." })

  const id = String(payloadOf(req).id ?? "")
  if (!id.startsWith("evt_")) return res.status(400).json({ received: false })

  try {
    const event = await stripe<{ type: string; data: { object: Record<string, unknown> } }>(`events/${id}`)
    let subscription: StripeSubscription | null = null
    if (event.type === "checkout.session.completed" && typeof event.data.object.subscription === "string") {
      subscription = await stripe<StripeSubscription>(`subscriptions/${event.data.object.subscription}`)
    } else if (event.type.startsWith("customer.subscription.")) {
      subscription = event.data.object as unknown as StripeSubscription
    }
    if (!subscription) return res.status(200).json({ received: true })

    let familyId = subscription.metadata?.family_id
    if (!familyId) {
      const { data } = await service.from("family_subscriptions").select("family_id").eq("provider_customer_id", subscription.customer).maybeSingle()
      familyId = data?.family_id
    }
    if (!familyId) {
      console.warn("Stripe subscription without a family:", subscription.id)
      return res.status(200).json({ received: true })
    }

    const item = subscription.items?.data?.[0]
    const { data: plan } = item ? await service.from("plans").select("id").eq("provider_price_id", item.price.id).maybeSingle() : { data: null }
    const row: Record<string, unknown> = {
      family_id: familyId,
      status: event.type === "customer.subscription.deleted" ? "canceled" : statusFromStripe(subscription.status),
      current_period_end: iso(subscription.current_period_end ?? item?.current_period_end),
      provider: "stripe",
      provider_customer_id: subscription.customer,
      provider_subscription_id: subscription.id,
    }
    if (plan) row.plan_id = plan.id
    else if (subscription.metadata?.plan_id) row.plan_id = subscription.metadata.plan_id
    if (subscription.trial_end) row.trial_ends_at = iso(subscription.trial_end)

    const { error } = await service.from("family_subscriptions").upsert(row, { onConflict: "family_id" })
    if (error) throw error
    return res.status(200).json({ received: true })
  } catch (error) {
    console.error("Handling a Stripe event failed:", error)
    return res.status(500).json({ received: false })
  }
}
