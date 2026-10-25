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
const VIDEOS: Array<[RegExp, { src: string; poster: string; length: string }]> = [
  [/make (your |the )?bed/i, { src: "/videos/make-your-bed.mp4", poster: "/videos/make-your-bed.jpg", length: "0:42" }],
]

export function choreVideo(title: string) {
  return VIDEOS.find(([pattern]) => pattern.test(title))?.[1] ?? null
}
