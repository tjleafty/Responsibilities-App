import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export interface AppUser {
  id: string
  email: string
  name?: string
}

let currentSession: Session | null = null
// Kept as one stable object per signed-in user so effects that depend on `user` don't re-run on every render.
let currentUser: AppUser | null = null
let sessionLoaded = false
const listeners = new Set<() => void>()

function toAppUser(user: User | null | undefined): AppUser | null {
  if (!user) return null
  const name = typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined
  return { id: user.id, email: user.email ?? "", name }
}

function setSession(session: Session | null) {
  currentSession = session
  const next = toAppUser(session?.user)
  if (next?.id !== currentUser?.id || next?.email !== currentUser?.email || next?.name !== currentUser?.name) currentUser = next
  sessionLoaded = true
  listeners.forEach((listener) => listener())
}

const DEMO_MODE = import.meta.env.VITE_DEMO_DATA === "1"

const sessionReady = DEMO_MODE
  ? Promise.resolve().then(() => {
    currentUser = { id: "demo-user", email: "sarah@example.com", name: "Sarah" }
    sessionLoaded = true
    listeners.forEach((listener) => listener())
  })
  : supabase.auth.getSession().then(({ data }) => setSession(data.session))

if (!DEMO_MODE) supabase.auth.onAuthStateChange((_event, session) => setSession(session))

/** Resolves once the stored session (if any) has been read. */
export function waitForSession(): Promise<void> {
  return sessionReady
}

/** Access token for calls to this app's own /api routes. */
export function getAuthToken(): string | null {
  return currentSession?.access_token ?? null
}

export function isAuthenticated(): boolean {
  return !!currentSession?.user || (DEMO_MODE && !!currentUser)
}

export function useAuth() {
  const [, rerender] = useState(0)

  useEffect(() => {
    const listener = () => rerender((n) => n + 1)
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }, [])

  return { user: currentUser, loading: !sessionLoaded }
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

/** Checks the signed-in login's password again, e.g. before resetting a forgotten parent PIN. */
export async function verifyPassword(password: string): Promise<boolean> {
  if (DEMO_MODE) return password.length > 0
  if (!currentUser?.email) return false
  const { error } = await supabase.auth.signInWithPassword({ email: currentUser.email, password })
  return !error
}

/** Returns true when the account needs email confirmation before it can sign in. */
export async function signUp(email: string, password: string, name?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: name ? { name } : undefined, emailRedirectTo: `${window.location.origin}/dashboard` },
  })
  if (error) throw error
  return !data.session
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/settings` })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}
