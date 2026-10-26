import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLeft, KeyRound, LogOut, Mail, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AppearancePicker, Card, ErrorNote, Field, inputClass } from "@/components/kit"
import { signOut, updatePassword, useAuth } from "@/lib/auth"

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [password, setPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  const handlePassword = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)
    try {
      await updatePassword(password)
      setPassword("")
      setMessage({ kind: "ok", text: "Password updated." })
    } catch (caught) {
      setMessage({ kind: "error", text: caught instanceof Error ? caught.message : "We couldn't update your password." })
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    navigate("/")
  }

  return (
    <main className="min-h-dvh bg-background px-4 py-6 text-foreground">
      <div className="mx-auto max-w-2xl space-y-5">
        <header className="flex items-center gap-3">
          <button type="button" onClick={() => navigate("/dashboard")} className="grid h-12 w-12 place-items-center rounded-full bg-card shadow-soft" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
          <h1 className="font-display text-3xl font-semibold">Account settings</h1>
        </header>

        <Card className="space-y-1">
          <p className="flex items-center gap-2 font-display text-lg font-semibold"><Mail className="h-5 w-5 text-primary" />Signed in as</p>
          <p className="text-muted-foreground">{user?.email}</p>
          <p className="pt-2 text-sm text-muted-foreground">Profiles, PINs and themes live in Family inside the app.</p>
        </Card>

        <Card className="space-y-3">
          <p className="flex items-center gap-2 font-display text-lg font-semibold"><Moon className="h-5 w-5 text-primary" />Appearance</p>
          <AppearancePicker />
          <p className="text-sm text-muted-foreground">Kids always see their own theme.</p>
        </Card>

        <Card>
          <form onSubmit={handlePassword} className="space-y-3">
            <p className="flex items-center gap-2 font-display text-lg font-semibold"><KeyRound className="h-5 w-5 text-primary" />Change password</p>
            <Field label="New password" hint="At least 8 characters.">
              <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} />
            </Field>
            {message?.kind === "error" ? <ErrorNote>{message.text}</ErrorNote> : null}
            {message?.kind === "ok" ? <p role="status" className="rounded-2xl bg-success/10 px-4 py-3 text-sm font-semibold text-success">{message.text}</p> : null}
            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Update password"}</Button>
          </form>
        </Card>

        <Button variant="outline" onClick={handleSignOut} className="w-full text-coral"><LogOut className="h-5 w-5" />Log out</Button>
      </div>
    </main>
  )
}
