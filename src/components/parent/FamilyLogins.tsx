import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Crown, Link2, Share2, UserPlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ErrorNote, Sheet } from "@/components/kit"
import { useAuth } from "@/lib/auth"
import { cancelInvite, createInvite, listMembers, listOpenInvites, removeMember, type FamilyInvite, type FamilyMember } from "@/lib/familySharing"

const shortDate = (iso: string) => new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(iso))

/** The logins that share this family, with invite links and remove. */
export function FamilyLogins({ onLeft }: { onLeft: () => void }) {
  const { user } = useAuth()
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [invites, setInvites] = useState<FamilyInvite[]>([])
  const [inviting, setInviting] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [nextMembers, nextInvites] = await Promise.all([listMembers(), listOpenInvites()])
      setMembers(nextMembers)
      setInvites(nextInvites)
    } catch (caught) {
      console.error("Family logins load failed:", caught)
      setError("We couldn't load who has a login.")
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const run = async (id: string, action: () => Promise<void>, failure: string) => {
    setBusy(id)
    setError(null)
    try {
      await action()
    } catch (caught) {
      console.error(failure, caught)
      setError(failure)
    } finally {
      setBusy(null)
    }
  }

  const remove = (member: FamilyMember) => run(member.user_id, async () => {
    const leaving = member.user_id === user?.id
    if (!window.confirm(leaving ? "Leave this family? You'll start a new, empty family next time you log in." : `Remove ${member.email ?? "this login"}? They won't see the family anymore.`)) return
    await removeMember(member.user_id)
    if (leaving) onLeft()
    else await load()
  }, "We couldn't remove that login. Please try again.")

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold">Logins</h2>
          <p className="text-sm text-muted-foreground">Grown-ups who can sign in and run this family.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setInviting(true)}><UserPlus className="h-4 w-4" />Invite</Button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      <ul className="overflow-hidden rounded-[22px] bg-card shadow-soft">
        {members.map((member, index) => {
          const isMe = member.user_id === user?.id
          return (
            <li key={member.user_id} className={`flex min-h-16 items-center gap-3 px-4 py-3 ${index > 0 ? "border-t border-border" : ""}`}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 font-display font-semibold text-primary">{(member.email ?? "?").charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{member.email ?? "Grown-up"}{isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">{member.role === "owner" ? <><Crown className="h-3.5 w-3.5" />Started this family</> : `Joined ${shortDate(member.joined_at)}`}</span>
              </span>
              {member.role !== "owner" ? (
                <Button size="sm" variant="ghost" disabled={busy === member.user_id} onClick={() => void remove(member)} className="text-coral hover:bg-coral/10 hover:text-coral">{isMe ? "Leave" : "Remove"}</Button>
              ) : null}
            </li>
          )
        })}
        {invites.map((invite) => (
          <li key={invite.id} className="flex min-h-16 items-center gap-3 border-t border-border px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-accent/30"><Link2 className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Invite link not used yet</span>
              <span className="block text-sm text-muted-foreground">Works until {shortDate(invite.expires_at)}</span>
            </span>
            <Button size="sm" variant="ghost" disabled={busy === invite.id} onClick={() => void run(invite.id, async () => { await cancelInvite(invite.id); await load() }, "We couldn't cancel that link.")}><X className="h-4 w-4" />Cancel</Button>
          </li>
        ))}
      </ul>
      <InviteSheet open={inviting} onOpenChange={(open) => { setInviting(open); if (!open) void load() }} />
    </section>
  )
}

function InviteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [making, setMaking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLink(null)
    setCopied(false)
    setError(null)
  }, [open])

  const make = async () => {
    setMaking(true)
    setError(null)
    try {
      setLink(await createInvite())
    } catch (caught) {
      console.error("Invite link failed:", caught)
      setError("We couldn't make a link. Please try again.")
    } finally {
      setMaking(false)
    }
  }

  const copy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link.url)
      setCopied(true)
    } catch {
      setError("Copy didn't work here. Press and hold the link to copy it.")
    }
  }

  const share = async () => {
    if (!link) return
    try {
      await navigator.share({ title: "Join our family on Responsibilities App", text: "Here's a link to help run our family's chores:", url: link.url })
    } catch {
      // The person closed the share menu.
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Invite a grown-up" description="A co-parent, grandparent or sitter gets their own login and sees the same kids, chores and prizes.">
      <div className="space-y-4">
        <ul className="space-y-2 text-sm">
          {["Approve chores and send them back", "Give prizes and set goals", "Add and change chores, kids and themes"].map((item) => (
            <li key={item} className="flex items-center gap-2"><Check className="h-4 w-4 shrink-0 text-success" strokeWidth={3} />{item}</li>
          ))}
        </ul>
        <ErrorNote>{error}</ErrorNote>
        {link ? (
          <div className="space-y-3">
            <p className="break-all rounded-2xl bg-muted px-4 py-3 font-mono text-sm" aria-label="Invite link">{link.url}</p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button onClick={() => void copy()}>{copied ? <><Check className="h-5 w-5" />Copied</> : <><Copy className="h-5 w-5" />Copy link</>}</Button>
              {typeof navigator !== "undefined" && "share" in navigator ? <Button variant="outline" onClick={() => void share()}><Share2 className="h-5 w-5" />Share</Button> : null}
            </div>
            <p className="text-sm text-muted-foreground">Send it by text or email. It works once, until {shortDate(link.expiresAt)}.</p>
          </div>
        ) : (
          <Button onClick={() => void make()} disabled={making} className="w-full"><Link2 className="h-5 w-5" />{making ? "Making a link..." : "Make an invite link"}</Button>
        )}
      </div>
    </Sheet>
  )
}
