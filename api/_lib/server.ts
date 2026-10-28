import { createClient } from "@supabase/supabase-js"

export interface ApiRequest {
  method?: string
  headers: Record<string, string | string[] | undefined>
  body?: unknown
}

export interface ApiResponse {
  status(code: number): ApiResponse
  json(body: unknown): void
}

/** Returns the signed-in Supabase user for the request's bearer token, or null. */
export async function getUser(req: ApiRequest) {
  const header = req.headers.authorization
  const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7) : null
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!token || !url || !key) return null
  const { data, error } = await createClient(url, key).auth.getUser(token)
  return error ? null : data.user
}

/** Sends a plain-text email through Resend (https://resend.com). */
export async function sendEmail(message: { to: string; subject: string; text: string; replyTo?: string }) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error("Email isn't set up yet (RESEND_API_KEY and EMAIL_FROM).")
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: message.to, subject: message.subject, text: message.text, reply_to: message.replyTo }),
  })
  if (!response.ok) throw new Error(`The email service refused the message (${response.status}).`)
}

export function payloadOf(req: ApiRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  return (req.body as Record<string, unknown>) ?? {}
}

/** A database client that acts as the signed-in login, so row-level security applies. */
export function userDb(req: ApiRequest) {
  const header = req.headers.authorization
  return createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: typeof header === "string" ? header : "" } },
  })
}

/** A database client with the service key, for writes no login may make (billing). Null until the key is set. */
export function serviceDb() {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null
}

export function appUrl(req: ApiRequest) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const host = req.headers["x-forwarded-host"] ?? req.headers.host
  return host ? `https://${host}` : "https://responsibilities-app.vercel.app"
}
