import { getUser, payloadOf, sendEmail, type ApiRequest, type ApiResponse } from "../_lib/server"

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ success: false, error: "Method not allowed." })
  const user = await getUser(req)
  if (!user) return res.status(401).json({ success: false, error: "Sign in before sending a request." })

  const payload = payloadOf(req)
  const kind = payload.kind === "feature" ? "Feature request" : "Support request"
  const subject = typeof payload.subject === "string" ? payload.subject.trim().slice(0, 120) : ""
  const message = typeof payload.message === "string" ? payload.message.trim() : ""
  if (!subject || !message) return res.status(400).json({ success: false, error: "Add a subject and message before sending." })
  if ([...message].length > 5000) return res.status(400).json({ success: false, error: "The message must be 5,000 characters or fewer." })

  try {
    await sendEmail({
      to: process.env.SUPPORT_EMAIL || "support@flogenixai.com",
      subject: `[ChoreReward] ${kind}: ${subject}`,
      text: `${kind}\n\n${message}\n\nFrom: ${user.email}\nUser ID: ${user.id}\nReceived at: ${new Date().toISOString()}`,
      replyTo: user.email,
    })
    return res.status(200).json({ success: true, accepted: true })
  } catch (error) {
    return res.status(502).json({ success: false, error: error instanceof Error ? error.message : "The message could not be sent." })
  }
}
