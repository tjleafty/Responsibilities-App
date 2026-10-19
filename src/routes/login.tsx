import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { sendPasswordReset, signIn, signUp, useAuth } from "@/lib/auth"

type Mode = "signin" | "signup" | "reset"

const copy: Record<Mode, { title: string; description: string; submit: string }> = {
  signin: { title: "Welcome back", description: "Sign in to your family's ChoreReward account.", submit: "Sign in" },
  signup: { title: "Create your family account", description: "One parent account holds every profile in your household.", submit: "Create account" },
  reset: { title: "Reset your password", description: "We'll email you a link to choose a new password.", submit: "Send reset link" },
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

  const text = copy[mode]

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <Link to="/" className="mb-6 flex items-center gap-2 font-display text-xl font-bold text-foreground">
        <Target className="h-5 w-5 text-primary" />
        ChoreReward
      </Link>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-display">{text.title}</CardTitle>
          <CardDescription>{text.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input id="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </div>
            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : text.submit}
            </Button>
          </form>
          <div className="mt-4 space-y-2 text-center text-sm text-muted-foreground">
            {mode === "signin" && (
              <>
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => switchMode("reset")}>Forgot your password?</button>
                <p>New here? <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => switchMode("signup")}>Create an account</button></p>
              </>
            )}
            {mode !== "signin" && (
              <p>Already have an account? <button type="button" className="font-semibold text-primary underline-offset-4 hover:underline" onClick={() => switchMode("signin")}>Sign in</button></p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
