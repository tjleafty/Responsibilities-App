import {
  Bath, Bed, BookOpen, Brush, CookingPot, Dog, Fish, Flower2, Footprints, Hand, Heart, Home, Leaf, Music, Package,
  Recycle, Shirt, Smile, Sparkles, SprayCan, Trash2, Utensils, UtensilsCrossed, WashingMachine, Wind, type LucideIcon,
} from "lucide-react"

const RULES: Array<[RegExp, LucideIcon]> = [
  [/\bbed(ding)?\b|sheets/i, Bed],
  [/teeth|tooth|brush/i, Smile],
  [/shower|bath(?!room)/i, Bath],
  [/bathroom|toilet|sink/i, SprayCan],
  [/dish|dishwasher/i, UtensilsCrossed],
  [/table|dinner|lunch|breakfast|meal/i, Utensils],
  [/cook|kitchen|counter/i, CookingPot],
  [/recycl/i, Recycle],
  [/trash|garbage|bins?\b/i, Trash2],
  [/laundry|wash(ing)? machine|dryer/i, WashingMachine],
  [/cloth|fold|dress|hamper/i, Shirt],
  [/read|book|homework/i, BookOpen],
  [/sweep|vacuum|floor|mop/i, Wind],
  [/dust|wipe|clean|tidy/i, Sparkles],
  [/toy|lego|backpack|pack/i, Package],
  [/dog|walk the|cat\b|pet/i, Dog],
  [/fish|hamster/i, Fish],
  [/plant|water the|garden|weed/i, Flower2],
  [/yard|leaves|lawn|porch/i, Leaf],
  [/piano|violin|guitar|practice|music/i, Music],
  [/hand/i, Hand],
  [/pray|kind|thank/i, Heart],
  [/shoe/i, Footprints],
  [/brush/i, Brush],
]

export function choreIcon(title: string): LucideIcon {
  return RULES.find(([pattern]) => pattern.test(title))?.[1] ?? Home
}

/** Chores that have a finished how-to video in public/videos. */
export interface ChoreVideo {
  src: string
  poster: string
  length: string
  /** Chapter start and end in seconds, from the video's script. */
  chapters: Array<{ title: string; start: number; end: number }>
  tip?: string
}

const VIDEOS: Array<[RegExp, ChoreVideo]> = [
  [/make (your |the )?bed/i, {
    src: "/videos/make-your-bed.mp4",
    poster: "/videos/make-your-bed.jpg",
    length: "0:42",
    chapters: [
      { title: "Take the pillows off", start: 4, end: 11 },
      { title: "Pull the sheet up to the top", start: 11, end: 18 },
      { title: "Pull the blanket up and smooth it", start: 18, end: 26 },
      { title: "Put the pillows back", start: 26, end: 32 },
      { title: "Add your favorite stuffy", start: 32, end: 36 },
    ],
    tip: "Smooth the blanket with flat hands, like you're petting a big sleepy cat.",
  }],
  [/\bset (the )?table/i, {
    src: "/videos/set-the-table.mp4",
    poster: "/videos/set-the-table.jpg",
    length: "0:39",
    chapters: [
      { title: "Put the placemat down", start: 4, end: 10 },
      { title: "The plate goes in the middle", start: 10, end: 15 },
      { title: "Napkin and fork on the left", start: 15, end: 21 },
      { title: "Knife and spoon on the right", start: 21, end: 27 },
      { title: "The cup goes at the top right", start: 27, end: 33 },
    ],
    tip: "Fork and left both have 4 letters, so the fork goes on the left.",
  }],
  [/\b(unload|empty)( out)? (the )?dishwasher/i, {
    src: "/videos/unload-the-dishwasher.mp4",
    poster: "/videos/unload-the-dishwasher.jpg",
    length: "0:39",
    chapters: [
      { title: "Check that the dishes are clean", start: 4, end: 10 },
      { title: "Silverware goes in the drawer first", start: 10, end: 16 },
      { title: "Stack the plates on the shelf", start: 16, end: 22 },
      { title: "Put the cups on the shelf", start: 22, end: 28 },
      { title: "Close the dishwasher", start: 28, end: 33 },
    ],
    tip: "Silverware first, then plates, then cups. Leave anything sharp for a grown-up.",
  }],
  [/\btake (out )?(the )?(kitchen )?trash\b(?! bins)/i, {
    src: "/videos/take-out-the-trash.mp4",
    poster: "/videos/take-out-the-trash.jpg",
    length: "0:39",
    chapters: [
      { title: "Pull the bag up and tie it", start: 4, end: 10 },
      { title: "Lift it out of the can", start: 10, end: 16 },
      { title: "Put a new bag in", start: 16, end: 22 },
      { title: "Carry it to the big bin outside", start: 22, end: 28 },
      { title: "Close the lid tight", start: 28, end: 33 },
    ],
    tip: "Tie the bag before it gets too full so it doesn't spill.",
  }],
  [/ready for bed|bedtime/i, {
    src: "/videos/get-ready-for-bed.mp4",
    poster: "/videos/get-ready-for-bed.jpg",
    length: "0:40",
    chapters: [
      { title: "Put on your pajamas", start: 4, end: 10 },
      { title: "Dirty clothes in the hamper", start: 10, end: 16 },
      { title: "Brush your teeth for 2 minutes", start: 16, end: 23 },
      { title: "Pick a book to read", start: 23, end: 28 },
      { title: "Lights out!", start: 28, end: 34 },
    ],
    tip: "Brush for two whole minutes: top, bottom, front and back.",
  }],
]

export function choreVideo(title: string): ChoreVideo | null {
  return VIDEOS.find(([pattern]) => pattern.test(title))?.[1] ?? null
}
