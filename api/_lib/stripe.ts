/*
 * A small Stripe client over its REST API (https://docs.stripe.com/api), so the
 * app needs no Stripe package. Set STRIPE_SECRET_KEY in Vercel to turn billing on.
 */

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY

type Params = Record<string, unknown>

/** Stripe takes form encoding with nested keys: line_items[0][price]=... */
function encode(params: Params, prefix = "", out = new URLSearchParams()) {
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    const name = prefix ? `${prefix}[${key}]` : key
    if (typeof value === "object") encode(value as Params, name, out)
    else out.append(name, String(value))
  })
  return out
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Params, method: "GET" | "POST" = params ? "POST" : "GET"): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error("Billing isn't set up yet (STRIPE_SECRET_KEY).")
  const query = method === "GET" && params ? `?${encode(params)}` : ""
  const response = await fetch(`https://api.stripe.com/v1/${path}${query}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: method === "POST" && params ? encode(params) : undefined,
  })
  const body = await response.json() as T & { error?: { message?: string } }
  if (!response.ok) throw Object.assign(new Error(body.error?.message ?? `Stripe answered ${response.status}.`), { status: response.status })
  return body
}

export interface StripeSubscription {
  id: string
  customer: string
  status: string
  trial_end: number | null
  current_period_end?: number
  cancel_at_period_end: boolean
  metadata: Record<string, string>
  items: { data: Array<{ current_period_end?: number; price: { id: string } }> }
}

/** Stripe's subscription states, in the app's words. */
export function statusFromStripe(status: string): string {
  switch (status) {
    case "trialing": return "trialing"
    case "active": return "active"
    case "past_due":
    case "unpaid":
    case "incomplete":
    case "paused": return "past_due"
    default: return "canceled"
  }
}
