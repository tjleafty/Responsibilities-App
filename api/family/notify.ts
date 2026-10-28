import { createClient } from "@supabase/supabase-js"
import { getUser, payloadOf, sendEmail, type ApiRequest, type ApiResponse } from "../_lib/server"

const EVENTS = {
  approval_needed: { setting: "approvalNeeded", subject: (kid: string, item: string) => `${kid} finished "${item}"`, text: (kid: string, item: string) => `${kid} finished "${item}" and it's waiting for your OK.` },
  prize_request: { setting: "prizeRequest", subject: (kid: string, item: string) => `${kid} is asking for "${item}"`, text: (kid: string, item: string) => `${kid} is asking for the prize "${item}".` },
} as const

/** Emails the family's grown-ups about something a kid did, when the family turned that email on. */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  const user = await getUser(req)
  if (!user) return res.status(401).json({ success: false, error: "Sign in first." })

  const payload = payloadOf(req)
  const event = EVENTS[payload.event as keyof typeof EVENTS]
  if (!event) return res.status(400).json({ success: false, error: "Unknown event." })
  const clip = (value: unknown) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 80) : "")
  const kid = clip(payload.kid) || "Your kid"
  const item = clip(payload.item) || "a chore"

  // Read the family as the signed-in login, so row-level security limits this to their own family.
  const header = req.headers.authorization as string
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_PUBLISHABLE_KEY!, { global: { headers: { Authorization: header } } })
  const { data: family } = await db.from("families").select("id, settings").order("created_at").limit(1).maybeSingle()
  const notifications = (family?.settings as { notifications?: Record<string, unknown> } | null)?.notifications ?? {}
  if (!family || notifications[event.setting] !== true) return res.status(200).json({ success: true, sent: 0 })
  const muted = Array.isArray(notifications.mutedUserIds) ? notifications.mutedUserIds : []
  const { data: members } = await db.from("family_members").select("user_id, email").eq("family_id", family.id)
  const recipients = [...new Set((members ?? []).filter((member) => member.email && !muted.includes(member.user_id)).map((member) => member.email as string))]

  const appUrl = process.env.APP_URL || "https://responsibilities-app.vercel.app"
  const results = await Promise.all(recipients.map(async (to) => {
    try {
      await sendEmail({ to, subject: event.subject(kid, item), text: `${event.text(kid, item)}\n\nOpen the Responsibilities App: ${appUrl}/dashboard\n\nYou can turn these emails off in Family > Family settings.` })
      return true
    } catch (error) {
      console.error("Notification email failed:", error)
      return false
    }
  }))
  return res.status(200).json({ success: true, sent: results.filter(Boolean).length })
}
