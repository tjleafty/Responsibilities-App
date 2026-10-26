import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Check, Clock3, LogIn, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark, ErrorNote, MASCOT } from "@/components/kit"
import { signOut, useAuth } from "@/lib/auth"
import { acceptInvite, inviteDetails, rememberInvite, type InviteDetails, type InviteError } from "@/lib/familySharing"

const CAN_DO = ["Approve chores and send them back", "Give prizes and set goals", "Add and change chores, kids and themes"]

const PROBLEM: Record<InviteError | "missing", string> = {
  missing: "This invite link doesn't work. Ask for a new one.",
  invite_not_found: "This invite link doesn't work. Ask for a new one.",
  invite_used: "This invite link has already been used. Ask for a new one.",
  invite_expired: "This invite link has expired. Invite links last 7 days, so ask for a new one.",
  already_in_family: "This login already has its own family with kids or chores, so it can't join another one. Sign in with a different email to join.",
  unknown: "Something went wrong joining the family. Please try again.",
}

export default function InvitePage() {
  const { code = "" } = useParams()
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [details, setDetails] = useState<InviteDetails | null | undefined>(undefined)
  const [joining, setJoining] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    inviteDetails(code)
      .then((found) => {
        if (!live) return
        setDetails(found)
        // Keep the code through sign-up and email confirmation, but only while it can still be used.
        rememberInvite(found?.status === "open" ? code : null)
      })
      .catch((caught) => {
        console.error("Invite lookup failed:", caught)
        if (live) setDetails(null)
      })
    return () => { live = false }
  }, [code])

  const join = async () => {
    setJoining(true)
    setProblem(null)
    const result = await acceptInvite(code)
    setJoining(false)
    if (!result.ok) {
      setProblem(PROBLEM[result.reason])
      if (result.reason !== "unknown") rememberInvite(null)
      return
    }
    rememberInvite(null)
    try {
      sessionStorage.removeItem("responsibilities.activeProfile")
    } catch {
      // Nothing to clear.
    }
    navigate("/dashboard", { replace: true })
  }

  const decline = () => {
    rememberInvite(null)
    navigate(user ? "/dashboard" : "/", { replace: true })
  }

  const closed = details === null ? PROBLEM.missing : details?.status === "used" ? PROBLEM.invite_used : details?.status === "expired" ? PROBLEM.invite_expired : null
  const inviter = details?.invited_by || "A grown-up"

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-8 text-foreground sm:justify-center">
      <Link to="/" aria-label="Responsibilities App home"><BrandMark /></Link>
      <section className="mt-8 w-full max-w-md rounded-[28px] bg-card p-6 text-center shadow-soft sm:p-8">
        <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-accent/40 text-4xl" aria-hidden="true">{MASCOT}</span>
        {details === undefined || loading ? (
          <p className="mt-6 font-display text-xl font-semibold">Opening your invite...</p>
        ) : closed ? (
          <>
            <h1 className="mt-5 font-display text-3xl font-semibold">Invite link closed</h1>
            <p className="mt-2 text-muted-foreground">{closed}</p>
            <Button asChild className="mt-6 w-full"><Link to={user ? "/dashboard" : "/"}>Go to the app<ArrowRight className="h-5 w-5" /></Link></Button>
          </>
        ) : (
          <>
            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.16em] text-primary">Family invitation</p>
            <h1 className="mt-2 font-display text-3xl font-semibold leading-tight">{inviter} invited you to help run the family</h1>
            <p className="mt-2 text-muted-foreground">You'll get your own login and see the same kids, chores and prizes.</p>
            <ul className="mt-5 space-y-2 text-left">
              {CAN_DO.map((item) => (
                <li key={item} className="flex items-center gap-3 rounded-2xl bg-muted/70 px-4 py-3 font-semibold"><Check className="h-5 w-5 shrink-0 text-success" strokeWidth={3} />{item}</li>
              ))}
            </ul>
            <div className="mt-6 space-y-3">
              <ErrorNote>{problem}</ErrorNote>
              {user ? (
                <>
                  <Button onClick={() => void join()} disabled={joining} className="w-full" size="lg">{joining ? "Joining..." : "Join the family"}<ArrowRight className="h-5 w-5" /></Button>
                  <p className="text-sm text-muted-foreground">Signed in as {user.email}. <button type="button" onClick={() => void signOut()} className="font-bold text-primary hover:underline">Not you?</button></p>
                </>
              ) : (
                <>
                  <Button className="w-full" size="lg" onClick={() => navigate("/login?mode=signup", { state: { from: `/invite/${code}` } })}>Create my login<ArrowRight className="h-5 w-5" /></Button>
                  <Button variant="ghost" className="w-full" onClick={() => navigate("/login", { state: { from: `/invite/${code}` } })}><LogIn className="h-5 w-5" />I already have a login</Button>
                </>
              )}
              <button type="button" onClick={decline} className="text-sm font-bold text-muted-foreground hover:text-foreground">No thanks</button>
            </div>
          </>
        )}
      </section>
      {details?.status === "open" ? (
        <p className="mt-4 flex max-w-md items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-4 w-4 shrink-0" />This link works once and expires {new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(details.expires_at))}.</p>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" />Kids never need an email.</p>
    </main>
  )
}
