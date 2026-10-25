import { supabase } from "@/lib/supabase"

type Row = Record<string, unknown>

interface ListOptions {
  /** Column to sort by; a leading "-" sorts descending (e.g. "-created_at"). */
  orderBy?: string
  /** Kept for compatibility with the Overskill call sites; lists always return every row. */
  all?: boolean
}

// Fields starting with "__" are client-side bookkeeping, never columns.
function clean(data: Row): Row {
  return Object.fromEntries(Object.entries(data).filter(([key]) => !key.startsWith("__")))
}

function table(name: string) {
  return {
    async list(options: ListOptions = {}): Promise<Row[]> {
      let query = supabase.from(name).select("*")
      if (options.orderBy) {
        const descending = options.orderBy.startsWith("-")
        query = query.order(options.orderBy.replace(/^-/, ""), { ascending: !descending })
      }
      const { data, error } = await query
      if (error) throw error
      return data ?? []
    },

    async count(): Promise<number> {
      const { count, error } = await supabase.from(name).select("id", { count: "exact", head: true })
      if (error) throw error
      return count ?? 0
    },

    async create(data: Row): Promise<Row> {
      const { data: row, error } = await supabase.from(name).insert(clean(data)).select().single()
      if (error) throw error
      return row
    },

    async bulkCreate(records: Row[]): Promise<Row[]> {
      const { data, error } = await supabase.from(name).insert(records.map(clean)).select()
      if (error) throw error
      return data ?? []
    },

    async update(id: string, data: Row): Promise<Row> {
      const { data: row, error } = await supabase.from(name).update(clean(data)).eq("id", id).select().single()
      if (error) throw error
      return row
    },

    async delete(id: string): Promise<void> {
      const { error } = await supabase.from(name).delete().eq("id", id)
      if (error) throw error
    },
  }
}

export const db = {
  family_profile: table("family_profiles"),
  goal: table("goals"),
  chore: table("chores"),
  chore_completion: table("chore_completions"),
  family_reward: table("family_rewards"),
}
