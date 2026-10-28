import { getAuthToken } from "@/lib/auth"
import { DEMO_MODE } from "@/lib/db"
import { familySettings } from "@/lib/familySettings"

type NotifyEvent = "approval_needed" | "prize_request"

/** Asks the server to email the family's grown-ups, when the family turned that email on. Fire and forget. */
export function notifyGrownUps(message: { event: NotifyEvent; kid: string; item: string }) {
  const { notifications } = familySettings()
  const wanted = message.event === "approval_needed" ? notifications.approvalNeeded : notifications.prizeRequest
  const token = getAuthToken()
  if (DEMO_MODE || !wanted || !token) return
  void fetch("/api/family/notify", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(message),
  }).catch((error) => console.warn("Notification request failed:", error))
}
