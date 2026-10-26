import { supabase } from "@/lib/supabase"
import { DEMO_MODE } from "@/lib/db"

/*
 * More than one login sharing a family (migration 20261026000000_family_sharing).
 * Until that migration is on the database, ensureFamily() reports sharing as
 * unavailable and the app keeps working the old single-login way.
 */

export interface FamilyMember {
  user_id: string
  email: string | null
  role: "owner" | "member"
  joined_at: string
}

export interface FamilyInvite {
  id: string
  created_at: string
  expires_at: string
}

export interface InviteDetails {
  family_name: string
  invited_by: string | null
  expires_at: string
  status: "open" | "used" | "expired"
}

export type InviteError = "invite_not_found" | "invite_used" | "invite_expired" | "already_in_family" | "unknown"

const PENDING_KEY = "responsibilities.pendingInvite"

/** Remembers an invite code across sign-up and email confirmation. */
export function rememberInvite(code: string | null) {
  try {
    if (code) localStorage.setItem(PENDING_KEY, code)
    else localStorage.removeItem(PENDING_KEY)
  } catch {
    // Storage can be blocked; the invite link still works when opened again.
  }
}

export function pendingInvite(): string | null {
  try {
    return localStorage.getItem(PENDING_KEY)
  } catch {
    return null
  }
}

// PostgREST answers PGRST202 when a function isn't on the database yet.
const missingFunction = (error: { code?: string } | null) => error?.code === "PGRST202"

// Demo mode: Sarah owns the sample family and David has a login too.
const demo = {
  members: [
    { user_id: "demo-user", email: "sarah@example.com", role: "owner", joined_at: "2026-09-01T12:00:00Z" },
    { user_id: "demo-david", email: "david@example.com", role: "member", joined_at: "2026-09-03T12:00:00Z" },
  ] as FamilyMember[],
  invites: [] as FamilyInvite[],
}

/** Makes sure this login has a family. Returns false when sharing isn't on the database yet. */
export async function ensureFamily(): Promise<boolean> {
  if (DEMO_MODE) return true
  const { error } = await supabase.rpc("ensure_family")
  if (missingFunction(error)) return false
  if (error) throw error
  return true
}

export async function listMembers(): Promise<FamilyMember[]> {
  if (DEMO_MODE) return demo.members.map((member) => ({ ...member }))
  const { data, error } = await supabase.from("family_members").select("user_id, email, role, joined_at").order("joined_at")
  if (error) throw error
  return (data ?? []) as FamilyMember[]
}

export async function listOpenInvites(): Promise<FamilyInvite[]> {
  if (DEMO_MODE) return demo.invites.map((invite) => ({ ...invite }))
  const { data, error } = await supabase.from("family_invites").select("id, created_at, expires_at")
    .is("accepted_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
  if (error) throw error
  return (data ?? []) as FamilyInvite[]
}

export async function createInvite(): Promise<{ url: string; expiresAt: string }> {
  let code: string
  let expiresAt: string
  if (DEMO_MODE) {
    code = crypto.randomUUID().replace(/-/g, "")
    expiresAt = new Date(Date.now() + 7 * 86_400_000).toISOString()
    demo.invites.unshift({ id: code, created_at: new Date().toISOString(), expires_at: expiresAt })
  } else {
    const { data, error } = await supabase.rpc("create_family_invite")
    if (error) throw error
    const row = (Array.isArray(data) ? data[0] : data) as { code: string; expires_at: string }
    code = row.code
    expiresAt = row.expires_at
  }
  return { url: `${window.location.origin}/invite/${code}`, expiresAt }
}

export async function cancelInvite(id: string) {
  if (DEMO_MODE) {
    demo.invites = demo.invites.filter((invite) => invite.id !== id)
    return
  }
  const { error } = await supabase.from("family_invites").delete().eq("id", id)
  if (error) throw error
}

export async function inviteDetails(code: string): Promise<InviteDetails | null> {
  if (DEMO_MODE) return { family_name: "Our family", invited_by: "Sarah", expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(), status: "open" }
  const { data, error } = await supabase.rpc("family_invite_details", { invite_code: code })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  return (row as InviteDetails | undefined) ?? null
}

export async function acceptInvite(code: string): Promise<{ ok: true } | { ok: false; reason: InviteError }> {
  if (DEMO_MODE) return { ok: true }
  const { error } = await supabase.rpc("accept_family_invite", { invite_code: code })
  if (!error) return { ok: true }
  const known: InviteError[] = ["invite_not_found", "invite_used", "invite_expired", "already_in_family"]
  return { ok: false, reason: known.find((reason) => error.message.includes(reason)) ?? "unknown" }
}

export async function removeMember(userId: string) {
  if (DEMO_MODE) {
    demo.members = demo.members.filter((member) => member.user_id !== userId)
    return
  }
  const { error } = await supabase.rpc("remove_family_member", { member: userId })
  if (error) throw error
}
