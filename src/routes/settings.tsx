import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "next-themes"
import { ArrowLeft, LogOut, Moon, Sun, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { ParentFamilySettings } from "@/components/ParentFamilySettings"
import { signOut, updatePassword, useAuth } from "@/lib/auth"

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { theme, setTheme } = useTheme()
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
    <div className="min-h-screen bg-background">
      <div className="border-b">
        <div className="container mx-auto flex items-center gap-3 px-4 py-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <h1 className="font-display text-xl font-bold">Settings</h1>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl space-y-6 px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Account</CardTitle>
            <CardDescription>Signed in as {user?.email}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePassword} className="space-y-3">
              <Label htmlFor="new-password">New password</Label>
              <div className="flex gap-2">
                <Input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} />
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Update"}</Button>
              </div>
              {message && <p role="status" className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-muted-foreground"}`}>{message.text}</p>}
            </form>
          </CardContent>
        </Card>

        <ParentFamilySettings />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}Appearance</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <Label htmlFor="dark-mode">Dark mode for the parent screens</Label>
            <Switch id="dark-mode" checked={theme === "dark"} onCheckedChange={(checked: boolean) => setTheme(checked ? "dark" : "light")} />
          </CardContent>
        </Card>

        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
