import type { CSSProperties, ReactNode } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useTheme } from "next-themes"
import { Check, Clock3, Minus, Monitor, Moon, Plus, RotateCcw, Sun, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { choreIcon } from "@/lib/choreIcons"
import { getKidTheme } from "@/lib/themes"
import type { ChoreState } from "@/lib/family"
import type { FamilyProfile } from "@/lib/familyTypes"

/** Placeholder for the app mascot (Barnaby the bear) until final art exists. */
export const MASCOT = "🧸"

export function Avatar({ profile, size = 44, ring = false, className }: { profile: FamilyProfile; size?: number; ring?: boolean; className?: string }) {
  const theme = getKidTheme(profile.theme_key)
  const isKid = profile.profile_type === "child"
  return (
    <span
      className={cn("relative grid shrink-0 place-items-center rounded-full font-display font-semibold", ring && "ring-4 ring-white", className)}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.42,
        background: isKid ? theme.colors.primary : "hsl(var(--muted))",
        color: isKid ? theme.colors.onPrimary : "hsl(var(--foreground))",
      }}
      aria-hidden="true"
    >
      {profile.display_name.trim().charAt(0).toUpperCase() || "?"}
      {isKid && size >= 40 && theme.id !== "teen" ? (
        <span className="absolute -bottom-1 -right-1 grid place-items-center rounded-full bg-white shadow-soft" style={{ width: size * 0.42, height: size * 0.42, fontSize: size * 0.24 }}>{theme.token}</span>
      ) : null}
    </span>
  )
}

export function TokenPill({ amount, token = "⭐", className, prefix = "" }: { amount: number; token?: string; className?: string; prefix?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-accent/25 px-3 py-1 font-display text-sm font-semibold tabular-nums text-foreground", className)}>
      <span aria-hidden="true">{token}</span>{prefix}{amount}
    </span>
  )
}

export function ProgressBar({ value, max, className, color, thick = false }: { value: number; max: number; className?: string; color?: string; thick?: boolean }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", thick ? "h-4" : "h-2.5", className)} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${percent}%`, background: color ?? "hsl(var(--primary))" }} />
    </div>
  )
}

export function Ring({ value, max, size = 56, stroke = 6, color, children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = max > 0 ? Math.min(1, value / max) : 0
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color ?? "hsl(var(--primary))"} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - fraction)} className="transition-[stroke-dashoffset] duration-500" />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-sm font-semibold tabular-nums">{children}</span>
    </span>
  )
}

export function ChoreIconTile({ title, size = 48, className, style }: { title: string; size?: number; className?: string; style?: CSSProperties }) {
  const Icon = choreIcon(title)
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary", className)} style={{ width: size, height: size, ...style }} aria-hidden="true">
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  )
}

const STATE_CHIP: Record<ChoreState, { label: string; className: string; icon: ReactNode }> = {
  todo: { label: "To do", className: "bg-muted text-muted-foreground", icon: <span className="h-2 w-2 rounded-full bg-current" /> },
  in_progress: { label: "In progress", className: "bg-primary/10 text-primary", icon: <span className="h-2 w-2 rounded-full bg-current" /> },
  waiting: { label: "Waiting", className: "bg-accent/30 text-foreground", icon: <Clock3 className="h-3.5 w-3.5" /> },
  done: { label: "Done", className: "bg-success/15 text-success", icon: <Check className="h-3.5 w-3.5" /> },
  sent_back: { label: "Sent back", className: "bg-coral/15 text-coral", icon: <RotateCcw className="h-3.5 w-3.5" /> },
}

export function StateChip({ state, label }: { state: ChoreState; label?: string }) {
  const chip = STATE_CHIP[state]
  return <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold", chip.className)}>{chip.icon}{label ?? chip.label}</span>
}

export function Segmented<T extends string>({ value, options, onChange, className, size = "md" }: { value: T; options: Array<{ value: T; label: ReactNode }>; onChange: (value: T) => void; className?: string; size?: "md" | "lg" }) {
  return (
    <div className={cn("flex rounded-full bg-muted p-1", className)} role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "flex-1 rounded-full px-3 font-display font-semibold transition-colors",
            size === "lg" ? "min-h-12 text-base" : "min-h-10 text-sm",
            value === option.value ? "bg-card text-primary shadow-soft" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({ active, onClick, children, className }: { active?: boolean; onClick?: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-bold transition-colors", active ? "bg-primary text-primary-foreground" : "bg-card text-foreground shadow-soft hover:bg-muted", className)}
    >
      {children}
    </button>
  )
}

export function Stepper({ value, onChange, min = 0, max = 9999, step = 1, suffix, label }: { value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number; suffix?: ReactNode; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-muted p-1" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-soft disabled:opacity-40" disabled={value <= min} aria-label={`Less ${label}`}><Minus className="h-4 w-4" /></button>
      <span className="min-w-14 text-center font-display text-lg font-semibold tabular-nums">{value}{suffix}</span>
      <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-soft disabled:opacity-40" disabled={value >= max} aria-label={`More ${label}`}><Plus className="h-4 w-4" /></button>
    </div>
  )
}

export function Card({ children, className, as: Tag = "section", ...rest }: { children: ReactNode; className?: string; as?: "section" | "article" | "div" | "li" } & Record<string, unknown>) {
  return <Tag className={cn("rounded-[22px] bg-card p-5 text-card-foreground shadow-soft", className)} {...rest}>{children}</Tag>
}

export function SectionTitle({ children, count, action, className }: { children: ReactNode; count?: number; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      <h2 className="flex items-center gap-2 font-display text-xl font-semibold text-foreground">
        {children}
        {count !== undefined ? <span className="grid min-w-7 place-items-center rounded-full bg-muted px-2 py-0.5 text-sm tabular-nums text-muted-foreground">{count}</span> : null}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({ emoji = MASCOT, title, children, action, className }: { emoji?: string; title: string; children?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center rounded-[22px] bg-card px-6 py-10 text-center shadow-soft", className)}>
      <span className="float-soft text-6xl" aria-hidden="true">{emoji}</span>
      <p className="mt-4 font-display text-xl font-semibold">{title}</p>
      {children ? <div className="mt-2 max-w-sm text-muted-foreground">{children}</div> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

/** Bottom sheet on phones, centered panel on bigger screens. */
export function Sheet({ open, onOpenChange, title, description, children, footer, wide = false, style }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
  style?: CSSProperties
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#2D2A4A]/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          style={style}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[28px] bg-background text-foreground shadow-2xl outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-10",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[28px]",
            wide ? "sm:max-w-3xl" : "sm:max-w-lg",
          )}
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-muted sm:hidden" aria-hidden="true" />
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-4 sm:px-6 sm:pt-6">
            <div className="min-w-0">
              <DialogPrimitive.Title className="font-display text-2xl font-semibold">{title}</DialogPrimitive.Title>
              {description ? <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description> : <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Panel"}</DialogPrimitive.Description>}
            </div>
            <DialogPrimitive.Close className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></DialogPrimitive.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-6">{children}</div>
          {footer ? <div className="border-t border-border bg-background px-5 py-4 pb-safe sm:rounded-b-[28px] sm:px-6">{footer}</div> : null}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-bold text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  )
}

export const inputClass = "flex min-h-12 w-full rounded-2xl border border-input bg-card px-4 text-base text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"

export function ErrorNote({ children }: { children: ReactNode }) {
  return children ? <p className="rounded-2xl bg-coral/10 px-4 py-3 text-sm font-semibold text-coral" role="alert">{children}</p> : null
}

export function BrandMark({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span data-app-icon className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-xl shadow-soft" aria-hidden="true">{MASCOT}</span>
      {compact ? null : <span className="font-display text-lg font-semibold leading-tight text-foreground">Responsibilities<span className="block text-sm text-muted-foreground">App</span></span>}
    </span>
  )
}

const APPEARANCE = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "Match device", icon: Monitor },
] as const

/** Light or dark for grown-up screens. Kid screens always use the kid's own theme. */
export function AppearancePicker({ className }: { className?: string }) {
  const { theme = "system", setTheme } = useTheme()
  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("grid grid-cols-3 gap-2", className)}>
      {APPEARANCE.map(({ id, label, icon: Icon }) => (
        <button key={id} type="button" role="radio" aria-checked={theme === id} onClick={() => setTheme(id)}
          className={cn("flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2 text-sm font-bold transition-colors",
            theme === id ? "border-primary bg-primary/10 text-primary" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")}>
          <Icon className="h-5 w-5" />{label}
        </button>
      ))}
    </div>
  )
}
