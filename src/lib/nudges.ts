/*
 * Reminder wording, pitched to the kid's age. Shared by the in-app nudge and the
 * push reminders the server sends (api/reminders/run.ts), so it imports nothing.
 */

export type AgeBand = "little" | "kid" | "teen"

export function ageBand(age: number | null): AgeBand {
  if (age === null) return "kid"
  if (age < 8) return "little"
  return age >= 12 ? "teen" : "kid"
}

export interface Nudge {
  title: string
  body: string
}

/** A reminder for a kid with `left` chores still to do today. `late` = a chore whose day has passed. */
export function kidNudge({ name, age, left, first, late, evening }: { name: string; age: number | null; left: number; first: string; late: boolean; evening: boolean }): Nudge {
  const more = left > 1 ? ` and ${left - 1} more` : ""
  switch (ageBand(age)) {
    case "little":
      return late
        ? { title: `${name}, a chore is waiting for you! 🐢`, body: `"${first}" is ready when you are. You can do it!` }
        : { title: evening ? `Almost bedtime, ${name}! 🌙` : `Chore time, ${name}! ⭐`, body: `Let's do "${first}"${more}. You've got this!` }
    case "teen":
      return late
        ? { title: "Overdue chore", body: `"${first}"${more} is past due.` }
        : { title: evening ? "Before tonight" : "Chores left today", body: `${left} left: ${first}${more}.` }
    default:
      return late
        ? { title: `${name}, don't forget!`, body: `"${first}" was due already${more}. Knock it out and grab your points.` }
        : { title: evening ? `Last call, ${name}!` : `Hey ${name}, chore check!`, body: `"${first}"${more} still to do today. Points are waiting!` }
  }
}

/** The grown-ups' evening summary. */
export function parentSummary(kids: Array<{ name: string; left: number }>): Nudge {
  const behind = kids.filter((kid) => kid.left > 0)
  if (behind.length === 0) return { title: "Everyone's done today 🎉", body: "Every chore is finished." }
  return {
    title: "Chores left today",
    body: behind.map((kid) => `${kid.name}: ${kid.left}`).join(", "),
  }
}
