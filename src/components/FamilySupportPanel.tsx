import { useState, type FormEvent } from "react"
import { Lightbulb, Mail, MessageCircle, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { getAuthToken } from "@/lib/auth"

type RequestKind = "support" | "feature"

export function FamilySupportPanel() {
  const [kind, setKind] = useState<RequestKind>("support")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const messageCount = Array.from(message).length

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject.trim() || !message.trim() || messageCount > 5000) return
    setSending(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch("/api/support/request", {
        method: "POST",
        headers: { Authorization: `Bearer ${getAuthToken()}`, "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject: subject.trim(), message: message.trim() }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        const ref = data.ref ? ` (ref: ${data.ref})` : ""
        throw new Error(`${data.error || "We couldn't send your request."}${ref}`)
      }
      setNotice(`Your ${kind === "feature" ? "feature request" : "support message"} was accepted by the sending service.`)
      setSubject("")
      setMessage("")
    } catch (caught) {
      console.error("Support request failed:", caught)
      setError(caught instanceof Error ? caught.message : "We couldn't send your request. Please try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]" aria-labelledby="support-heading" data-element-id="family-support">
      <div className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6"><span className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary"><Mail className="h-5 w-5" /></span><p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-primary">We can help</p><h2 id="support-heading" className="mt-1 font-display text-3xl font-bold text-card-foreground">Support & ideas</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Send a question about your household setup or suggest a feature for a future ChoreReward update.</p><a href="mailto:support@flogenixai.com" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold text-primary transition-colors hover:bg-muted"><Mail className="h-4 w-4" />Email support</a></div>
      <form onSubmit={submit} className="rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-card-foreground"><MessageCircle className="h-4 w-4 text-primary" />Send a request</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-[0.7fr_1.3fr]">
          <label className="space-y-2 text-sm font-medium text-card-foreground">Request type<select value={kind} onChange={(event) => setKind(event.target.value as RequestKind)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-ring md:text-sm"><option value="support">Support</option><option value="feature">Feature request</option></select></label>
          <label className="space-y-2 text-sm font-medium text-card-foreground">Subject<Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={kind === "feature" ? "What would help your family?" : "What do you need help with?"} /></label>
        </div>
        <label className="mt-4 block space-y-2 text-sm font-medium text-card-foreground">Message<Textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Share the details so we can help." className="min-h-36 text-base md:text-sm" aria-describedby="support-message-count" /></label>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3"><span id="support-message-count" className={`text-xs ${messageCount > 5000 ? "text-destructive" : "text-muted-foreground"}`}>{messageCount}/5000 characters</span><Button type="submit" disabled={sending || !subject.trim() || !message.trim() || messageCount > 5000}><Send className="h-4 w-4" />{sending ? "Sending…" : "Send request"}</Button></div>
        {error ? <p className="mt-3 text-sm text-destructive" role="alert">{error}</p> : null}{notice ? <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm text-secondary-foreground" role="status">{notice}</p> : null}
      </form>
    </section>
  )
}
