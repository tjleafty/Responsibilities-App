import type { GoalFrequency } from "@/lib/familyTypes"

// Starter chore ideas parents can add in one tap.
export const CHORE_PRESETS: Array<{ title: string; frequency: GoalFrequency }> = [
  { title: "Sweep porch", frequency: "daily" }, { title: "Personal morning prayer", frequency: "daily" },
  { title: "Take shower/bath", frequency: "daily" }, { title: "Unload dishwasher", frequency: "daily" },
  { title: "Get ready for bed", frequency: "daily" }, { title: "Empty out all trashes", frequency: "daily" },
  { title: "Bring trash bins in", frequency: "weekly" }, { title: "Help make dinner", frequency: "daily" },
  { title: "Set table for dinner", frequency: "daily" }, { title: "Clean dining room", frequency: "daily" },
  { title: "Wash bedding", frequency: "weekly" }, { title: "Put clothes in washing machine", frequency: "daily" },
  { title: "Clean bathrooms", frequency: "weekly" }, { title: "Clean bedroom", frequency: "daily" },
  { title: "Put clothes in dryer", frequency: "daily" }, { title: "Take out kitchen trash", frequency: "daily" },
  { title: "Personal evening prayer", frequency: "daily" }, { title: "Clean living room", frequency: "weekly" },
  { title: "Take out recycling", frequency: "daily" }, { title: "Take trash bins to the curb", frequency: "weekly" },
  { title: "Fold clothes and put away", frequency: "weekly" }, { title: "Load dishwasher", frequency: "daily" },
  { title: "Help clean up dinner", frequency: "daily" }, { title: "Read book", frequency: "daily" },
  { title: "Clean kitchen counters", frequency: "daily" }, { title: "Make your bed", frequency: "daily" },
  { title: "Sweep/vacuum floors", frequency: "weekly" },
]
