import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BrandMark, ErrorNote, MASCOT } from "@/components/kit"
import { sendPasswordReset, signIn, signUp, useAuth } from "@/lib/auth"
import { pendingInvite } from "@/lib/familySharing"
import { cn } from "@/lib/utils"

type Mode = "signin" | "signup" | "reset"

const copy: Record<Mode, { title: string; description: string; submit: string }> = {
  signin: { title: "Welcome back", description: "Sign in to manage chores, approve finished work and set up prizes.", submit: "Sign in" },
  signup: { title: "Create your family account", description: "One grown-up account holds every profile in your home.", submit: "Create account" },
  reset: { title: "Reset your password", description: "We'll email you a link to choose a new one.", submit: "Send reset link" },
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "signup" ? "signup" : "signin")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const destination = (location.state as { from?: string } | null)?.from || "/dashboard"

  useEffect(() => {
    if (!loading && user) navigate(destination, { replace: true })
  }, [loading, user, destination, navigate])

  const switchMode = (next: Mode) => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      if (mode === "signin") {
        await signIn(email.trim(), password)
      } else if (mode === "signup") {
        const needsConfirmation = await signUp(email.trim(), password, name.trim() || undefined)
        if (needsConfirmation) setNotice("Check your email for a link to confirm your account, then sign in.")
      } else {
        await sendPasswordReset(email.trim())
        setNotice("If that email has an account, a reset link is on its way.")
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  const joining = pendingInvite() !== null
  const text = joining && mode === "signup" ? { ...copy.signup, title: "Make your login", description: "Then you'll join the family that invited you." } : copy[mode]

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-4 py-8 sm:justify-center">
      <Link to="/" aria-label="Responsibilities App home"><BrandMark /></Link>
      <div className="mt-8 flex flex-col items-center text-center">
        <span className="relative">
          <span className="grid h-24 w-24 place-items-center rounded-full bg-accent/40 text-5xl" aria-hidden="true">{MASCOT}</span>
          <span className="absolute -bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-3 py-1 text-xs font-extrabold text-primary-foreground shadow-soft"><ShieldCheck className="h-3.5 w-3.5" />Grown-ups</span>
        </span>
        <h1 className="mt-6 font-display text-4xl font-semibold">{text.title}</h1>
        <p className="mt-2 max-w-sm text-muted-foreground">{text.description}</p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 w-full max-w-md space-y-4 rounded-[28px] bg-card p-6 shadow-soft sm:p-8">
        {mode === "signup" ? (
          <IconField id="name" label="Your name" icon={<User className="h-5 w-5" />}>
            <input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Sarah" className={fieldInput} />
          </IconField>
        ) : null}
        <IconField id="email" label="Email" icon={<Mail className="h-5 w-5" />}>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="grownup@family.com" className={fieldInput} />
        </IconField>
        {mode !== "reset" ? (
          <IconField
            id="password"
            label="Password"
            icon={<Lock className="h-5 w-5" />}
            aside={mode === "signin" ? <button type="button" onClick={() => switchMode("reset")} className="text-sm font-bold text-primary hover:underline">Forgot it?</button> : null}
            trailing={<button type="button" onClick={() => setShowPassword((on) => !on)} className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:text-foreground" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>}
          >
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className={fieldInput} />
          </IconField>
        ) : null}
        <ErrorNote>{error}</ErrorNote>
        {notice ? <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{notice}</p> : null}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? "Please wait..." : text.submit}<ArrowRight className="h-5 w-5" /></Button>
        {mode === "signup" ? <p className="text-center text-xs text-muted-foreground">Kids don't need an email. You'll add their profiles after this.</p> : null}
      </form>

      <p className="mt-6 text-center text-muted-foreground">
        {mode === "signin"
          ? <>New here? <button type="button" className="font-bold text-primary hover:underline" onClick={() => switchMode("signup")}>Create an account</button></>
          : <>Already have an account? <button type="button" className="font-bold text-primary hover:underline" onClick={() => switchMode("signin")}>Sign in</button></>}
      </p>
    </main>
  )
}

const fieldInput = "min-h-14 w-full flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"

function IconField({ id, label, icon, aside, trailing, children }: { id: string; label: string; icon: ReactNode; aside?: ReactNode; trailing?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-bold">{label}</label>
        {aside}
      </div>
      <div className={cn("flex items-center gap-3 rounded-2xl bg-muted/70 pl-4 pr-2 focus-within:ring-2 focus-within:ring-ring")}>
        <span className="text-muted-foreground">{icon}</span>
        {children}
        {trailing}
      </div>
    </div>
  )
}
