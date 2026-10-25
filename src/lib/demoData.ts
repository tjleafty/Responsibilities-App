import { getPeriodKey } from "@/lib/choreUtils"

// Sample household for local previews and screenshots. Only used when VITE_DEMO_DATA=1;
// production builds never set it, so they always talk to Supabase.
type Row = Record<string, unknown>

// sha256("1234")
const PIN_1234 = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4"

function ago(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString()
}

function daysAgo(days: number, hour = 18) {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(hour, 0, 0, 0)
  return date
}

const steps = (...titles: string[]) => JSON.stringify(titles.map((title, index) => ({ id: `s${index + 1}`, title })))

export function demoTables(): Record<string, Row[]> {
  const today = getPeriodKey("daily")
  const week = getPeriodKey("weekly")
  const profiles: Row[] = [
    { id: "mom", display_name: "Sarah", profile_type: "parent", theme_key: "sunny-room", pin_hash: "", is_active: true, created_at: ago(9000) },
    { id: "dad", display_name: "David", profile_type: "parent", theme_key: "sunny-room", pin_hash: PIN_1234, is_active: true, created_at: ago(8990) },
    { id: "ava", display_name: "Ava", profile_type: "child", theme_key: "ocean-explorer", pin_hash: PIN_1234, is_active: true, created_at: ago(8980) },
    { id: "leo", display_name: "Leo", profile_type: "child", theme_key: "space-mission", pin_hash: PIN_1234, is_active: true, created_at: ago(8970) },
    { id: "mia", display_name: "Mia", profile_type: "child", theme_key: "sunny-room", pin_hash: "", is_active: true, created_at: ago(8960) },
  ]
  const chore = (id: string, title: string, kids: string[], extra: Row = {}): Row => ({
    id, title, frequency: "daily", target_profile_id: kids[0], assigned_profile_ids: JSON.stringify(kids), subtasks: "[]",
    reward: "", reward_points: 5, time_limit_minutes: null, requires_verification: false, random_assignment_enabled: false,
    assignment_rotation_enabled: false, assignment_change_frequency: "weekly", is_active: true, created_at: ago(5000), ...extra,
  })
  const chores: Row[] = [
    chore("bed", "Make your bed", ["mia", "leo", "ava"], { subtasks: steps("Pillows off", "Pull the sheet up", "Smooth the blanket", "Pillows and stuffy back"), requires_verification: true }),
    chore("teeth", "Brush teeth", ["mia", "leo", "ava"], { reward_points: 3, subtasks: steps("Toothpaste on", "Brush top and bottom", "Rinse") }),
    chore("toys", "Put toys away", ["mia"], { reward_points: 4, requires_verification: true }),
    chore("table", "Set the table", ["mia", "leo"], { requires_verification: true, subtasks: steps("Placemats", "Plates", "Forks on the left", "Cups") }),
    chore("fish", "Feed the fish", ["mia"], { subtasks: steps("One pinch of food", "Check the water") }),
    chore("dishes", "Empty the dishwasher", ["leo", "ava"], { reward_points: 10, random_assignment_enabled: true, assignment_rotation_enabled: true, time_limit_minutes: 15, requires_verification: true, subtasks: steps("Silverware first", "Plates", "Cups") }),
    chore("violin", "Practice violin", ["ava"], { reward_points: 10, subtasks: steps("Warm up", "Scales", "New song") }),
    chore("trash", "Take out trash and recycling", ["ava"], { frequency: "weekly", reward_points: 10, requires_verification: true }),
    chore("laundry", "Fold laundry", ["ava", "leo"], { frequency: "weekly", reward_points: 15 }),
    chore("sweep", "Sweep the porch", ["leo"], { is_active: false }),
  ]
  const done = (id: string, choreId: string, kid: string, minutes: number, points: number, extra: Row = {}): Row => ({
    id, chore_id: choreId, profile_id: kid, period_key: today, completed_task_ids: "[]", status: "approved", review_status: "approved",
    started_at: ago(minutes + 5), completed_at: ago(minutes), verified_at: ago(minutes), reward_points_snapshot: points, ...extra,
  })
  const completions: Row[] = [
    done("c1", "teeth", "mia", 300, 3, { completed_task_ids: JSON.stringify(["s1", "s2", "s3"]) }),
    done("c2", "toys", "mia", 12, 4, { status: "pending_verification", review_status: "unreviewed", verified_at: null }),
    done("c3", "table", "mia", 40, 5, { status: "rejected", review_status: "rejected", rejection_reason: "Some steps were skipped", parent_feedback: "Forks go on the left side of the plate!", completed_task_ids: JSON.stringify(["s1", "s2"]) }),
    done("c4", "bed", "leo", 35, 5, { status: "pending_verification", review_status: "unreviewed", verified_at: null, completed_task_ids: JSON.stringify(["s1", "s2", "s3", "s4"]) }),
    done("c5", "teeth", "leo", 280, 3, { completed_task_ids: JSON.stringify(["s1", "s2", "s3"]) }),
    done("c6", "teeth", "ava", 290, 3),
    done("c7", "bed", "ava", 260, 5),
    done("c8", "violin", "ava", 60, 10, { status: "in_progress", review_status: "unreviewed", completed_at: null, verified_at: null, completed_task_ids: JSON.stringify(["s1"]) }),
    done("c9", "trash", "ava", 90, 10, { period_key: week, status: "pending_verification", review_status: "unreviewed", verified_at: null }),
  ]
  // A few past days so streaks, totals and history have something to show.
  for (let day = 1; day <= 6; day += 1) {
    for (const kid of ["mia", "leo", "ava"]) {
      if (kid === "leo" && day === 3) continue
      const when = daysAgo(day).toISOString()
      completions.push({ id: `h-${kid}-${day}`, chore_id: "teeth", profile_id: kid, period_key: getPeriodKey("daily", daysAgo(day)), completed_task_ids: "[]", status: "approved", review_status: "approved", completed_at: when, verified_at: when, reward_points_snapshot: day % 2 ? 5 : 3, parent_feedback: "" })
    }
  }
  completions.push({ id: "h-sent", chore_id: "bed", profile_id: "leo", period_key: getPeriodKey("daily", daysAgo(2)), status: "rejected", review_status: "rejected", rejection_reason: "Not fully completed", completed_at: daysAgo(2, 8).toISOString(), verified_at: daysAgo(2, 9).toISOString(), reward_points_snapshot: 5, parent_feedback: "" })
  const family_rewards: Row[] = [
    { id: "r1", title: "Pick the family movie", description: "Choose Friday's movie and the popcorn.", reward_type: "chore", target_profile_id: "", points_required: 50, is_active: true, created_at: ago(4000) },
    { id: "r2", title: "Ice cream trip", description: "Double scoop at the corner shop.", reward_type: "goal", target_profile_id: "ava", points_required: 75, is_active: true, created_at: ago(3990) },
    { id: "r3", title: "Extra 30 min screen time", description: "Weekend video games or tablet time.", reward_type: "participation", target_profile_id: "", points_required: 30, is_active: true, created_at: ago(3980) },
    { id: "r4", title: "New skate helmet", description: "Long-term goal prize.", reward_type: "goal", target_profile_id: "leo", points_required: 200, is_active: true, created_at: ago(3970) },
    { id: "r5", title: "Small stuffed animal", description: "Under $10 at the toy store.", reward_type: "chore", target_profile_id: "mia", points_required: 100, is_active: false, created_at: ago(3960) },
  ]
  const goals: Row[] = [
    { id: "g1", title: "Morning routine 5 days", description: "Bed, teeth and dressed before breakfast.", frequency: "weekly", target_profile_id: "mia", target_count: 5, progress: 3, prize: "Ice cream trip", is_active: true, created_at: ago(3000) },
    { id: "g2", title: "Read 10 books", description: "", frequency: "monthly", target_profile_id: "mia", target_count: 10, progress: 6, prize: "New sticker pack", is_active: true, created_at: ago(2990) },
    { id: "g3", title: "Practice violin every day", description: "", frequency: "weekly", target_profile_id: "ava", target_count: 7, progress: 5, prize: "Pick the restaurant", is_active: true, created_at: ago(2980) },
    { id: "g4", title: "Zero sent-back chores", description: "", frequency: "weekly", target_profile_id: "leo", target_count: 7, progress: 2, prize: "Extra 30 min screen time", is_active: true, created_at: ago(2970) },
  ]
  return { family_profiles: profiles, chores, chore_completions: completions, family_rewards, goals }
}
