import { useEffect, useState } from "react"
import { BellRing } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import type { FamilyProfile } from "@/lib/familyTypes"
import { deviceReminderProfile, disableReminders, enableReminders, pushSupport } from "@/lib/push"
import { cn } from "@/lib/utils"

const HELP = {
  unsupported: "This browser can't show reminders.",
  "install-first": "On iPhone or iPad, add this app to your Home Screen first (Share, then Add to Home Screen), then open it from there.",
  "not-configured": "Reminders aren't switched on for the app yet.",
  blocked: "Notifications are blocked for this app. Turn them on in this device's settings.",
} as const

/** "Reminders on this device" for one kid or grown-up. */
export function DeviceReminders({ profile, kid = false, className }: { profile: FamilyProfile; kid?: boolean; className?: string }) {
  const support = pushSupport()
  const [owner, setOwner] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => { void deviceReminderProfile().then(setOwner).catch(() => setOwner(null)) }, [])

  const on = owner === profile.id
  const toggle = async (next: boolean) => {
    setBusy(true)
    setError(null)
    try {
      if (next) await enableReminders(profile.id)
      else await disableReminders()
      setOwner(next ? profile.id : null)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <label className="flex items-center justify-between gap-3">
        <span className="flex items-start gap-2">
          <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <span>
            <span className="block font-bold">{kid ? "Remind me on this device" : "Reminders on this device"}</span>
            <span className="block text-sm text-muted-foreground">
              {owner && !on ? "This device already gets someone else's reminders. Turning it on moves them to you." : kid ? "A little ping when chores are waiting." : "Your summary of chores left each evening."}
            </span>
          </span>
        </span>
        <Switch checked={on} disabled={busy || support !== "ready" || owner === undefined} onCheckedChange={(next) => void toggle(next)} />
      </label>
      {support !== "ready" ? <p className="text-sm text-muted-foreground">{HELP[support]}</p> : null}
      {error ? <p className="text-sm font-semibold text-coral">{error}</p> : null}
    </div>
  )
}
