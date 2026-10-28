import { getRewardThemeId } from "@/lib/rewardThemes"

/** The words each kid world uses on the Today screen. Chore titles stay as the grown-up wrote them. */
export interface ThemeCopy {
  greeting: (name: string, hour: number) => string
  journey: string
  progress: (done: number, total: number) => string
  upNext: string
  start: string
  keepGoing: string
  tryAgain: string
  more: string
  later: string
  allDone: string
  allDoneSub: string
  cheer: (name: string) => string
}

const timeOfDay = (hour: number) => hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"

const base: ThemeCopy = {
  greeting: (name, hour) => `${timeOfDay(hour)}, ${name}!`,
  journey: "Today's journey",
  progress: (done, total) => `${done} of ${total} done`,
  upNext: "Up next",
  start: "Start",
  keepGoing: "Keep going",
  tryAgain: "Try again",
  more: "More today",
  later: "This week and month",
  allDone: "You finished everything!",
  allDoneSub: "Great work today.",
  cheer: (name) => `You've got this, ${name}! One chore at a time.`,
}

const COPY: Record<string, Partial<ThemeCopy>> = {
  "sunny-room": {},
  // Teen mode: short and respectful, no exclamation marks on every line.
  teen: {
    greeting: () => "Today",
    journey: "Today",
    progress: (done, total) => `${done}/${total} done`,
    upNext: "Up next",
    start: "Start",
    keepGoing: "Continue",
    tryAgain: "Redo",
    more: "Today's chores",
    later: "This week",
    allDone: "All done for today",
    allDoneSub: "Nothing left on your list.",
    cheer: () => "",
  },
  "ocean-explorer": {
    greeting: (name, hour) => `${timeOfDay(hour)}, ${name}! 🌊`,
    journey: "Today's reef journey",
    progress: (done, total) => `${done} of ${total} explored`,
    start: "Dive in",
    more: "More reef chores",
    later: "Later this week",
    allDone: "You're making waves!",
    allDoneSub: "Every chore is done. Time to rest at Reef Base.",
    cheer: (name) => `Swim steady, ${name}. The reef is cheering for you!`,
  },
  "space-mission": {
    greeting: (name) => `Cadet ${name}, ready for launch!`,
    journey: "Galaxy journey",
    progress: (done, total) => `${done} of ${total} launched`,
    upNext: "Priority launch",
    start: "Start mission",
    keepGoing: "Resume mission",
    tryAgain: "Fix and relaunch",
    more: "Orbit manifest",
    later: "Upcoming flight logs",
    allDone: "Mission complete!",
    allDoneSub: "Every launch landed safely today.",
    cheer: (name) => `Systems go, ${name}! Mission control believes in you.`,
  },
  "dino-valley": {
    greeting: (name) => `Roar-some day, ${name}! 🦕`,
    journey: "Dino Valley journey",
    progress: (done, total) => `${done} of ${total} stomped`,
    start: "Roar! Start now",
    more: "More dino chores",
    later: "Later this week",
    allDone: "Roar-some work today!",
    allDoneSub: "The whole valley is proud of you.",
    cheer: (name) => `Big dino steps, ${name}! You're stomping through today.`,
  },
  "candy-shop": {
    greeting: (name) => `Sweet day ahead, ${name}!`,
    journey: `Today's sweet treats`,
    progress: (done, total) => `${done} of ${total} baked`,
    start: "Start baking",
    more: "Sweet quests",
    later: "Coming up this week",
    allDone: "Sweetest day ever!",
    allDoneSub: "Every chore is done. Treat yourself to a rest.",
    cheer: (name) => `You're doing so sweet, ${name}! Keep sparkling!`,
  },
  "fairy-garden": {
    greeting: (name, hour) => `${timeOfDay(hour)}, ${name}! 🌸`,
    journey: "Enchanted garden",
    progress: (done, total) => `${done} of ${total} bloomed`,
    start: "Start the magic",
    more: "Garden missions",
    later: "Blooming later",
    allDone: "Your garden is in full bloom!",
    allDoneSub: "Every good deed helped it grow.",
    cheer: () => "The garden grows with every good deed! 🌿",
  },
  "pixel-arcade": {
    greeting: (name) => `Player ${name}, press start!`,
    journey: "Stage 1: daily quest",
    progress: (done, total) => `${done}/${total} cleared`,
    upNext: "Active quest",
    start: "Press start",
    keepGoing: "Continue",
    tryAgain: "Retry level",
    more: "Mission log",
    later: "Bonus levels",
    allDone: "Stage cleared!",
    allDoneSub: "High score unlocked for today.",
    cheer: (name) => `Combo bonus active! Let's win today, ${name}!`,
  },
  "superhero-city": {
    greeting: (name) => `Hero ${name}, the city needs you!`,
    journey: "Daily hero patrol",
    progress: (done, total) => `${done} of ${total} saved`,
    upNext: "Active mission",
    start: "Suit up",
    keepGoing: "Back to the mission",
    tryAgain: "One more try, hero",
    more: "Active missions",
    later: "Missions this week",
    allDone: "City saved!",
    allDoneSub: "Every mission accomplished today.",
    cheer: () => "Super courage, hero! You're saving the day!",
  },
  "rainbow-sky": {
    greeting: (name, hour) => `${timeOfDay(hour)}, ${name}! 🌈`,
    journey: "Rainbow climb",
    progress: (done, total) => `${done} of ${total} clouds cleared`,
    start: "Float up",
    more: "Today's missions",
    later: "Later in the week",
    allDone: "You made a whole rainbow!",
    allDoneSub: "Every color is painted for today.",
    cheer: (name) => `Every chore paints another color in the rainbow. Keep shining, ${name}!`,
  },
  "construction-zone": {
    greeting: (name) => `Hard hats on, ${name}!`,
    journey: "Daily build project",
    progress: (done, total) => `${done} of ${total} jobs built`,
    upNext: "Next job",
    start: "Start building",
    keepGoing: "Keep building",
    tryAgain: "Fix the build",
    more: "Site missions",
    later: "Jobs this week",
    allDone: "Project complete!",
    allDoneSub: "Rock-solid work today, builder.",
    cheer: (name) => `Machines ready! Let's build a rock-solid day, ${name}!`,
  },
  "arctic-friends": {
    greeting: (name, hour) => `${timeOfDay(hour)}, ${name}! ❄️`,
    journey: "Glacier expedition",
    progress: (done, total) => `${done} of ${total} peaks`,
    start: "Slide in",
    more: "Polar quests",
    later: "Expeditions this week",
    allDone: "You reached the top!",
    allDoneSub: "Every peak climbed. Cozy up in the igloo.",
    cheer: () => "Cool routines make happy days!",
  },
  "calm-night": {
    greeting: (name) => `Rest well, ${name}`,
    journey: "Tonight's journey",
    progress: (done, total) => `${done} of ${total} ready`,
    upNext: "Next gentle step",
    start: "Begin peacefully",
    keepGoing: "Carry on softly",
    tryAgain: "Gentle tweak",
    more: "Tonight's steps",
    later: "Later this week",
    allDone: "All calm and ready",
    allDoneSub: "Almost dream time.",
    cheer: (name) => `Soft and steady, ${name}. There's no rush.`,
  },
}

export function themeCopy(themeKey: string): ThemeCopy {
  return { ...base, ...COPY[getRewardThemeId(themeKey)] }
}
