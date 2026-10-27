import { useEffect, useState } from "react"
import { Check, Palette } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet } from "@/components/kit"
import { themeCopy } from "@/lib/themeCopy"
import { KID_THEME_IDS, ensureThemeFonts, getKidTheme, kidThemeStyle } from "@/lib/themes"
import { cn } from "@/lib/utils"

const SAMPLE_CHORES = [
  { title: "Make your bed", icon: "🛏️", points: 5, done: true },
  { title: "Feed the dog", icon: "🐶", points: 3, done: false },
  { title: "Brush teeth", icon: "🪥", points: 2, done: false },
]

/** A small kid Today screen drawn in a theme, so a theme can be judged before it's picked. */
export function ThemePreview({ themeKey, kidName }: { themeKey: string; kidName: string }) {
  const theme = getKidTheme(themeKey)
  const { colors } = theme
  const copy = themeCopy(themeKey)
  return (
    <div className="overflow-hidden rounded-[24px] p-4 shadow-soft" style={{ ...kidThemeStyle(themeKey), backgroundColor: colors.bg, color: colors.ink }} aria-label={`${theme.name} preview`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: colors.inkSoft }}>{theme.name}</p>
          <p className="text-xl font-semibold leading-tight" style={{ fontFamily: theme.displayStack }}>{copy.greeting(kidName || "there", new Date().getHours())}</p>
        </div>
        <span className="shrink-0 rounded-full px-3 py-1 text-sm font-bold" style={{ background: colors.reward, color: colors.ink }}>{theme.token} 12</span>
      </div>
      <div className="mt-3 h-3 overflow-hidden rounded-full" style={{ background: colors.pattern }}>
        <div className="h-full w-1/3 rounded-full" style={{ background: colors.primary }} />
      </div>
      <ul className="mt-3 space-y-2">
        {SAMPLE_CHORES.map((chore) => (
          <li key={chore.title} className="flex items-center gap-3 p-3" style={{ background: colors.surface, borderRadius: "var(--theme-radius, 18px)" }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl" style={{ background: colors.pattern }} aria-hidden="true">{chore.icon}</span>
            <span className={cn("min-w-0 flex-1 truncate font-semibold", chore.done && "line-through opacity-60")} style={{ fontFamily: theme.displayStack }}>{chore.title}</span>
            {chore.done
              ? <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: colors.success, color: colors.onSuccess }}><Check className="h-4 w-4" strokeWidth={3} /></span>
              : <span className="text-sm font-bold">{theme.token} {chore.points}</span>}
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-full py-2.5 text-center font-semibold" style={{ background: colors.primary, color: colors.onPrimary, fontFamily: theme.displayStack }}>{copy.start}</div>
    </div>
  )
}

interface ThemePickerProps {
  value: string
  onChange: (themeKey: string) => void | Promise<void>
  kidName: string
  /** Label on the button that opens the picker. */
  label?: string
  className?: string
}

/** Shows the current theme; tapping it opens a pop-up with a live preview of every theme. */
export function ThemePicker({ value, onChange, kidName, label = "Change theme", className }: ThemePickerProps) {
  const [open, setOpen] = useState(false)
  const [previewing, setPreviewing] = useState(value)
  const [saving, setSaving] = useState(false)
  const current = getKidTheme(value)

  useEffect(() => {
    if (!open) return
    setPreviewing(value)
    KID_THEME_IDS.forEach(ensureThemeFonts)
  }, [open, value])

  const choose = async () => {
    setSaving(true)
    try {
      await onChange(previewing)
      setOpen(false)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("flex w-full items-center gap-3 rounded-[20px] p-3 text-left shadow-soft transition-transform active:scale-[0.98]", className)}
        style={{ background: current.colors.bg, color: current.colors.ink }}
      >
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl" style={{ background: current.colors.primary }} aria-hidden="true">{current.token}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold" style={{ fontFamily: current.displayStack }}>{current.name}</span>
          <span className="block text-xs font-bold opacity-75">{current.vibe}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-white/85 px-3 py-1.5 text-sm font-bold text-[#2D2A4A]"><Palette className="h-4 w-4" />{label}</span>
      </button>

      <Sheet
        open={open}
        onOpenChange={setOpen}
        wide
        title="Pick a theme"
        description="Tap a theme to see what it looks like."
        footer={
          <Button size="lg" className="w-full" disabled={saving} onClick={() => void choose()}>
            <Check className="h-5 w-5" />{saving ? "Saving..." : previewing === value ? `Keep ${getKidTheme(previewing).name}` : `Use ${getKidTheme(previewing).name}`}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <ThemePreview themeKey={previewing} kidName={kidName} />
          <ul className="grid grid-cols-3 gap-2 self-start sm:grid-cols-3">
            {KID_THEME_IDS.map((id) => {
              const option = getKidTheme(id)
              const active = previewing === id
              return (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => setPreviewing(id)}
                    aria-pressed={active}
                    className={cn("relative flex w-full flex-col items-center gap-1 rounded-2xl p-2 text-center transition-transform active:scale-[0.96]", active && "ring-4 ring-primary")}
                    style={{ background: option.colors.bg, color: option.colors.ink }}
                  >
                    <span className="grid h-10 w-10 place-items-center rounded-xl text-xl" style={{ background: option.colors.primary }} aria-hidden="true">{option.token}</span>
                    <span className="w-full truncate text-xs font-semibold" style={{ fontFamily: option.displayStack }}>{option.name}</span>
                    {id === value ? <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-white text-[#2D2A4A] shadow-soft"><Check className="h-3 w-3" strokeWidth={3} /><span className="sr-only">Current theme</span></span> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
