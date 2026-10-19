import { getUser, payloadOf, sendEmail, type ApiRequest, type ApiResponse } from "../_lib/server"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  const user = await getUser(req)
  if (!user) return res.status(401).json({ success: false, error: "Sign in before sending an invitation." })

  const payload = payloadOf(req)
  const emails = Array.isArray(payload.emails) ? payload.emails : []
  if (emails.length < 1 || emails.length > 5) return res.status(400).json({ success: false, error: "Enter between one and five email addresses." })
  const clean = [...new Set(emails.map((value) => (typeof value === "string" ? value.trim().toLowerCase() : "")).filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))]
  if (clean.length !== emails.length) return res.status(400).json({ success: false, error: "One or more email addresses are invalid or duplicated." })
  const message = typeof payload.message === "string" ? payload.message.trim().slice(0, 3000) : ""
  const appUrl = process.env.APP_URL || "https://chorereward.vercel.app"

  const results = await Promise.all(clean.map(async (email) => {
    try {
      await sendEmail({
        to: email,
        subject: "A family invitation to try ChoreReward",
        text: `${message || "Our family uses ChoreReward to organize chores and celebrate progress."}\n\nOpen ChoreReward: ${appUrl}`,
        replyTo: user.email,
      })
      return true
    } catch (error) {
      console.error("Invite email failed:", error)
      return false
    }
  }))
  const accepted = results.filter(Boolean).length
  return res.status(accepted > 0 ? 200 : 502).json({
    success: accepted > 0,
    accepted,
    failed: results.length - accepted,
    error: accepted === 0 ? "No invitation emails were accepted for sending." : undefined,
  })
}
