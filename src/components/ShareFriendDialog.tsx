import { useState, type FormEvent } from "react"
import { Share, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getAuthToken } from "@/lib/auth"

export function ShareFriendDialog() {
  const [open, setOpen] = useState(false)
  const [addresses, setAddresses] = useState("")
  const [message, setMessage] = useState("Our family uses ChoreReward to keep chores, progress, and rewards organized. Take a look!")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const sendInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const emails = addresses.split(/[\n,;]+/).map((email) => email.trim()).filter(Boolean)
    if (emails.length === 0 || emails.length > 5) {
      setError("Enter between one and five email addresses.")
      return
    }
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch("/api/family/invite", {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ emails, message: message.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        const ref = data.ref ? ` (ref: ${data.ref})` : ""
        throw new Error(`${data.error || "We couldn't send the invitation."}${ref}`)
      }
      setNotice(`${data.accepted} invitation email${data.accepted === 1 ? "" : "s"} accepted for sending.`)
      setAddresses("")
    } catch (caught) {
      console.error("Friend invitation failed:", caught)
      setError(caught instanceof Error ? caught.message : "We couldn't send the invitation. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={() => { setOpen(true); setError(null); setNotice(null) }}><Share className="h-4 w-4" />Send to a friend</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl">Share ChoreReward</DialogTitle><DialogDescription>Invite one or more friends to see how your family keeps chores and rewards organized.</DialogDescription></DialogHeader>
          <form onSubmit={sendInvite} className="space-y-4">
            <label className="block space-y-2 text-sm font-medium text-card-foreground">Email addresses<Input value={addresses} onChange={(event) => setAddresses(event.target.value)} placeholder="friend@example.com, another@example.com" type="text" aria-describedby="invite-address-help" /></label>
            <p id="invite-address-help" className="-mt-2 text-xs text-muted-foreground">Separate addresses with commas or new lines. Up to five per invite.</p>
            <label className="block space-y-2 text-sm font-medium text-card-foreground">Message<Textarea value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-24 text-base md:text-sm" /></label>
            {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{notice ? <p className="rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground" role="status">{notice}</p> : null}
            <div className="flex items-center justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Close</Button><Button type="submit" disabled={sending || !addresses.trim()}><Users className="h-4 w-4" />{sending ? "Sending…" : "Send invitation"}</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
