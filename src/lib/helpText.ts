/*
 * Text for the small (i) help pop-ups in the grown-up screens.
 *
 * All of it lives here so it is easy to find and change when a feature changes.
 * Each entry has a short title and one or more short paragraphs. Keep them plain
 * and short: a parent reads these on a phone in the middle of setting things up.
 *
 * Used by <InfoTip topic="..." /> in src/components/InfoTip.tsx.
 */

export interface HelpEntry {
  title: string
  body: string[]
}

export const HELP = {
  // Chore editor: basics
  choreFrequency: {
    title: "How often",
    body: [
      "Daily chores show up every day.",
      "Weekly chores show up once a week (Monday to Sunday). You can pick the day or days they are due.",
      "Monthly chores can be done any day that month.",
    ],
  },
  choreDueDays: {
    title: "Due days",
    body: [
      "Any day: kids can do it whenever they like that week. It sits in their \"this week\" list.",
      "Pick one day and it shows up that day. If it isn't done, it stays on the list as late until the week ends.",
      "Pick several days and it has to be done once on each of them.",
    ],
  },
  choreRepeats: {
    title: "Every other week",
    body: [
      "The chore only shows up on alternating weeks. Use Starting to choose whether this week or next week is the first one.",
    ],
  },

  // Chore editor: who does it
  choreWho: {
    title: "Who does it",
    body: [
      "Everyone you pick gets the chore on their own list, and each person earns the points when they finish it.",
      "Want only one kid at a time? Turn on Randomly assign below.",
    ],
  },
  chorePerKidSchedule: {
    title: "Different schedule for each kid",
    body: [
      "Turn this on when kids share a chore but on different days, like one kid every Monday and another every Thursday.",
      "Each kid then gets their own How often and Due days.",
    ],
  },
  choreRandom: {
    title: "Randomly assign",
    body: [
      "Instead of everyone doing it, the app picks from the kids you chose and switches who's up on a schedule.",
      "It's random but fair over time, and it stays the same until the next switch, so kids can't reroll it.",
    ],
  },
  choreRandomMode: {
    title: "What's random",
    body: [
      "Chore only: one kid does the whole chore.",
      "Chore and subtasks: a random group of kids is picked, and the steps are split between them.",
      "Subtasks only: every kid you picked does the chore, and the steps are split between them.",
      "Splitting steps needs at least two steps.",
    ],
  },
  choreTurnEvery: {
    title: "Change who's up",
    body: [
      "How long one pick lasts. Daily switches each day, Weekly every Monday, Monthly on the 1st.",
    ],
  },

  // Chore editor: steps, reward, rules
  choreSteps: {
    title: "Steps",
    body: [
      "Steps break a chore into small pieces kids can check off, like \"Pull up the sheet\" and \"Fluff the pillow\".",
      "They are optional. A chore with no steps is done with one tap.",
    ],
  },
  choreDifficulty: {
    title: "How hard is it?",
    body: [
      "Easy, Medium and Hard each earn a set number of points. You can change those numbers for the whole family in Family settings, and every chore at that level updates.",
      "Custom lets you pick any number for just this chore.",
      "Kids see points as their theme's token (stars, shells, coins and so on). It's the same number underneath.",
    ],
  },
  choreLinkedPrize: {
    title: "Linked prize",
    body: [
      "Optional. Shows kids which prize this chore helps them save for.",
      "It doesn't change the points or spend them. Kids still choose when to cash in.",
    ],
  },
  choreApproval: {
    title: "Needs my approval",
    body: [
      "When it's on, a finished chore goes to Approve first. Its points count once a grown-up says it's done.",
      "You can also send it back with a note, and the kid tries again.",
    ],
  },
  choreTimeLimit: {
    title: "Time limit",
    body: [
      "Kids see \"Try to finish in ... minutes\" on the chore. It's a goal to aim for.",
      "They still get the points if they take longer.",
    ],
  },

  // Rewards
  prizesVsGoals: {
    title: "Prizes and goals",
    body: [
      "Prizes cost points. Kids save up the points they earn from chores and then ask for the prize.",
      "Goals don't use points. They count up to a target, like \"Read 10 books\", and a grown-up adds each one with +1.",
    ],
  },
  prizeCost: {
    title: "Points needed",
    body: [
      "How many points a kid needs to ask for this prize. When they ask, the points are held until you say yes or no.",
      "A good start is a few days of chores for small prizes and a few weeks for big ones.",
    ],
  },
  prizeFor: {
    title: "Who it's for",
    body: [
      "Everyone means every kid can save up for it with their own points.",
      "Pick one kid to make it just for them.",
    ],
  },
  goalStartsOver: {
    title: "Starts over",
    body: [
      "When the goal's count goes back to zero: every day, every week (Monday) or every month.",
      "You can also reset it yourself any time.",
    ],
  },
  goalTarget: {
    title: "Times to reach it",
    body: [
      "How many times it needs to happen to reach the goal. You add each one with +1 on the Rewards page.",
    ],
  },

  // Family settings
  settingsDifficultyPoints: {
    title: "Points for each difficulty",
    body: [
      "Every chore marked Easy, Medium or Hard earns these points. Change a number here and all chores at that level change too.",
      "Chores set to Custom keep their own points.",
      "Points already earned don't change.",
    ],
  },
  settingsKidsAsk: {
    title: "Asking for prizes",
    body: [
      "When kids can ask, they tap a prize they can afford and it comes to you to approve. The points are held while it waits and given back if you say no.",
      "When it's off, kids can still see prizes and their points, and they tell a grown-up instead.",
    ],
  },
  settingsAutoGrant: {
    title: "Grant small prizes automatically",
    body: [
      "Prizes that cost this many points or fewer are given right away, without waiting for you. Bigger prizes still come to you.",
    ],
  },
  settingsReminders: {
    title: "Reminders",
    body: [
      "Nudges show inside the app. Push reminders go to a kid's phone or tablet, only when they still have chores left.",
      "Push needs to be turned on once on each device, from the kid's Me page.",
    ],
  },

  // Family and setup
  kidMode: {
    title: "Kid or Teen mode",
    body: [
      "Kid mode has playful themes, a mascot and themed tokens like stars or shells.",
      "Teen mode is a cleaner, darker look with XP instead of stars. Chores and points work the same way.",
    ],
  },
  kidPin: {
    title: "PINs",
    body: [
      "A grown-up's PIN keeps kids out of parent mode on a shared device.",
      "A kid's PIN keeps others from opening their profile and checking off their chores.",
    ],
  },
  setupWorld: {
    title: "Pick a world",
    body: [
      "The theme your kid sees: colors, mascot and what points are called. It doesn't change how chores work, and you can change it later in Family.",
    ],
  },
  setupStarterChores: {
    title: "Starter chores",
    body: [
      "These are ideas to get going. After you add them, open any chore from the Chores page to change who does it, how often, the steps and the points.",
    ],
  },
  setupFirstReward: {
    title: "How points turn into prizes",
    body: [
      "Kids earn points for each chore they finish. When they have enough for a prize, they ask for it and you approve it.",
      "You can add more prizes and goals later on the Rewards page.",
    ],
  },
} satisfies Record<string, HelpEntry>

export type HelpTopic = keyof typeof HELP
