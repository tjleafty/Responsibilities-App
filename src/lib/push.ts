import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"

/*
 * Push reminders on this device (push_subscriptions, migration 20261029000000).
 * The server (api/reminders/run.ts) sends them at the family's reminder times.
 * iPhones and iPads only get push in the app added to the Home Screen (iOS 16.4+).
 */

const PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined
const DEMO_KEY = "responsibilities.demoPush"

export type PushSupport = "ready" | "unsupported" | "install-first" | "not-configured" | "blocked"

export function pushSupport(): PushSupport {
  if (DEMO_MODE) return "ready"
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    const installed = window.matchMedia?.("(display-mode: standalone)").matches
    return ios && !installed ? "install-first" : "unsupported"
  }
  if (!PUBLIC_KEY) return "not-configured"
  if (Notification.permission === "denied") return "blocked"
  return "ready"
}

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/")
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

const toBase64 = (buffer: ArrayBuffer | null) => (buffer ? btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : "")

async function currentSubscription() {
  const registration = await navigator.serviceWorker.ready
  return registration.pushManager.getSubscription()
}

/** The profile this device sends reminders to, or null when it isn't signed up. */
export async function deviceReminderProfile(): Promise<string | null | undefined> {
  if (DEMO_MODE) {
    try { return localStorage.getItem(DEMO_KEY) } catch { return null }
  }
  if (pushSupport() !== "ready") return null
  const subscription = await currentSubscription()
  if (!subscription) return null
  const { data } = await supabase.from("push_subscriptions").select("profile_id").eq("endpoint", subscription.endpoint).maybeSingle()
  return data ? data.profile_id : null
}

/** Turns reminders on for this device, for one kid or grown-up. Asks the browser for permission first. */
export async function enableReminders(profileId: string) {
  if (DEMO_MODE) {
    try { localStorage.setItem(DEMO_KEY, profileId) } catch { /* demo only */ }
    return
  }
  if (pushSupport() !== "ready" || !PUBLIC_KEY) throw new Error("This device can't get reminders.")
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked. Turn them on in this device's settings.")
  const registration = await navigator.serviceWorker.ready
  const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) })
  // One device belongs to one profile: replace any earlier sign-up for it.
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint)
  const { error } = await supabase.from("push_subscriptions").insert({
    endpoint: subscription.endpoint,
    p256dh: toBase64(subscription.getKey("p256dh")),
    auth: toBase64(subscription.getKey("auth")),
    profile_id: profileId,
    user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw error
}

export async function disableReminders() {
  if (DEMO_MODE) {
    try { localStorage.removeItem(DEMO_KEY) } catch { /* demo only */ }
    return
  }
  const subscription = await currentSubscription()
  if (!subscription) return
  await supabase.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint)
  await subscription.unsubscribe()
}
