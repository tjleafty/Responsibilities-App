import { appUrl, getUser, type ApiRequest, type ApiResponse } from "../_lib/server"
import { stripe, stripeReady } from "../_lib/stripe"
import { familyOf } from "./_family"

/** Opens Stripe's billing page, where a family changes its card or plan, sees receipts, or cancels. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  if (!(await getUser(req))) return res.status(401).json({ success: false, error: "Sign in first." })
  if (!stripeReady()) return res.status(503).json({ success: false, error: "Payments aren't set up yet." })
  try {
    const found = await familyOf(req)
    const customer = found?.subscription?.provider_customer_id
    if (!customer) return res.status(400).json({ success: false, error: "There's no billing account for your family yet." })
    const portal = await stripe<{ url: string }>("billing_portal/sessions", { customer, return_url: `${appUrl(req)}/dashboard` })
    return res.status(200).json({ success: true, url: portal.url })
  } catch (error) {
    console.error("Opening the billing page failed:", error)
    return res.status(500).json({ success: false, error: "We couldn't open billing. Please try again." })
  }
}
