import { getUser, payloadOf, userDb, type ApiRequest, type ApiResponse } from "../_lib/server"
import { stripe, stripeReady } from "../_lib/stripe"

interface PlanInput {
  id: string
  name: string
  description: string
  price_cents: number
  billing_interval: "month" | "year"
  trial_days: number
  is_active: boolean
  sort: number
}

function clean(value: Record<string, unknown>): PlanInput | null {
  const id = String(value.id ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")
  const name = String(value.name ?? "").trim().slice(0, 60)
  const price = Math.round(Number(value.price_cents))
  const trial = Math.round(Number(value.trial_days))
  const interval = value.billing_interval === "year" ? "year" : "month"
  if (!id || !name || !Number.isFinite(price) || price < 0 || !Number.isFinite(trial) || trial < 0 || trial > 365) return null
  return {
    id, name, description: String(value.description ?? "").trim().slice(0, 200), price_cents: price, billing_interval: interval,
    trial_days: trial, is_active: value.is_active !== false, sort: Math.round(Number(value.sort)) || 0,
  }
}

/** Saves a plan (admins only) and, when Stripe is connected, keeps a matching Stripe product and price. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  if (!(await getUser(req))) return res.status(401).json({ success: false, error: "Sign in first." })
  const db = userDb(req)
  const { data: admin } = await db.rpc("is_app_admin")
  if (admin !== true) return res.status(403).json({ success: false, error: "Admins only." })

  const plan = clean(payloadOf(req))
  if (!plan) return res.status(400).json({ success: false, error: "Check the plan's name, price and trial." })

  try {
    const { data: existing } = await db.from("plans").select("provider_price_id").eq("id", plan.id).maybeSingle()
    let priceId: string | null = existing?.provider_price_id ?? null

    if (stripeReady() && plan.price_cents > 0) {
      const productId = `plan_${plan.id}`
      const product = { name: plan.name, ...(plan.description ? { description: plan.description } : {}), active: true }
      try {
        await stripe(`products/${productId}`, product)
      } catch (error) {
        if ((error as { status?: number }).status !== 404) throw error
        await stripe("products", { id: productId, ...product })
      }
      // Stripe prices can't change, so a new price replaces the old one. Current subscribers keep theirs.
      const current = priceId ? await stripe<{ unit_amount: number; active: boolean; recurring: { interval: string } | null }>(`prices/${priceId}`).catch(() => null) : null
      const same = current && current.active && current.unit_amount === plan.price_cents && current.recurring?.interval === plan.billing_interval
      if (!same) {
        const created = await stripe<{ id: string }>("prices", {
          product: productId, unit_amount: plan.price_cents, currency: "usd", recurring: { interval: plan.billing_interval }, metadata: { plan_id: plan.id },
        })
        if (priceId && current?.active) await stripe(`prices/${priceId}`, { active: false }).catch(() => undefined)
        priceId = created.id
      }
    }

    const { data, error } = await db.from("plans").upsert({ ...plan, provider_price_id: priceId }, { onConflict: "id" }).select().single()
    if (error) throw error
    return res.status(200).json({ success: true, plan: data, stripe: stripeReady() })
  } catch (error) {
    console.error("Saving a plan failed:", error)
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Saving the plan failed." })
  }
}
