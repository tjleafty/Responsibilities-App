import { useMemo, useState, type ReactNode } from "react"
import { ArrowDownRight, ArrowUpRight, Flame, Gift, ThumbsUp, TrendingUp, TriangleAlert } from "lucide-react"
import { Avatar, ChoreIconTile, EmptyState, Segmented, TokenPill } from "@/components/kit"
import type { ParentScreenProps } from "@/components/parent/ParentApp"
import { familyInsights, percent, type Bucket, type ChoreInsight, type RangeDays } from "@/lib/insights"
import { currentStreak } from "@/lib/family"
import { getKidTheme } from "@/lib/themes"
import { cn } from "@/lib/utils"

const RANGES: Array<{ value: `${RangeDays}`; label: string }> = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
]

/** How the family is doing over time: completion, which chores work, each kid's trend, and prize spending. */
export function ParentInsights(props: ParentScreenProps) {
  const [range, setRange] = useState<`${RangeDays}`>("30")
  const days = Number(range) as RangeDays
  const data = useMemo(() => familyInsights(props, days), [props, days])
  const delta = data.rate !== null && data.previousRate !== null ? Math.round((data.rate - data.previousRate) * 100) : null
  const judged = data.chores.filter((chore) => chore.expected >= Math.min(3, days))
  const best = judged.filter((chore) => chore.rate >= 0.6).slice(0, 5)
  const worst = judged.filter((chore) => chore.rate < 0.6).reverse().slice(0, 5)

  if (data.expected === 0 && data.kids.length === 0) {
    return <EmptyState title="Nothing to show yet">Add kids and chores, and insights fill in as chores get done.</EmptyState>
  }

  return (
    <div className="space-y-5">
      <Segmented value={range} onChange={setRange} options={RANGES} className="max-w-sm" />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-[22px] bg-card p-5 shadow-soft lg:col-span-1">
          <p className="text-sm font-bold text-muted-foreground">Chores done on time</p>
          <p className="mt-1 font-display text-5xl font-semibold">{percent(data.rate)}</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            {delta === null ? "No earlier period to compare" : <>
              {delta >= 0 ? <ArrowUpRight className="h-4 w-4 text-success" /> : <ArrowDownRight className="h-4 w-4 text-coral" />}
              <span className="font-bold text-foreground">{delta > 0 ? "+" : ""}{delta} pts</span> vs the {days} days before
            </>}
          </p>
        </div>
        <Stat label="Chores done" value={data.done.toLocaleString()} hint={`of ${data.expected.toLocaleString()} due`} />
        <Stat label="Points earned" value={data.earned.toLocaleString()} hint="from approved chores" />
        <Stat label="Points spent" wide value={data.spent.toLocaleString()} hint={data.earned ? `${Math.round((data.spent / data.earned) * 100)}% of what they earned` : "on prizes"} />
      </section>

      <Panel title="Completion over time" icon={<TrendingUp className="h-5 w-5" />} hint={days === 7 ? "Share of chores done each day" : "Share of chores done each week"}>
        <Columns buckets={data.trend} />
      </Panel>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold">Each kid</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.kids.map((row) => {
            const theme = getKidTheme(row.kid.theme_key)
            const streak = currentStreak(row.kid.id, props.completions)
            return (
              <li key={row.kid.id} className="rounded-[22px] bg-card p-4 shadow-soft">
                <div className="flex items-center gap-3">
                  <Avatar profile={row.kid} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-lg font-semibold">{row.kid.display_name}</p>
                    <p className="text-sm text-muted-foreground">{row.done} of {row.expected} chores</p>
                  </div>
                  <p className="font-display text-3xl font-semibold">{percent(row.rate)}</p>
                </div>
                <Sparkline buckets={row.trend} className="mt-3" />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-bold"><Flame className="h-4 w-4 text-coral" />{streak} day streak</span>
                  <TokenPill amount={row.earned} token={theme.token} prefix="+" />
                  <span className="rounded-full bg-muted px-2.5 py-1 font-bold">{row.spent ? `${row.spent} spent` : "Saving up"}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Working well" icon={<ThumbsUp className="h-5 w-5" />} hint="Chores done most often">
          <ChoreBars rows={best} empty="No chore is done most of the time yet." />
        </Panel>
        <Panel title="Needs a nudge" icon={<TriangleAlert className="h-5 w-5" />} hint="Chores skipped most often. Try fewer steps, more points, or a different day.">
          <ChoreBars rows={worst} empty="Every chore is doing fine." />
        </Panel>
      </div>

      <Panel title="Prize spending" icon={<Gift className="h-5 w-5" />} hint={`${data.spent.toLocaleString()} points on ${data.prizes.reduce((sum, prize) => sum + prize.times, 0)} prizes`}>
        {data.prizes.length === 0 ? <p className="text-muted-foreground">No prizes cashed in during these {days} days.</p> : (
          <ul className="space-y-2.5">
            {data.prizes.map((prize) => (
              <li key={prize.title} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                <span className="truncate font-semibold">{prize.title}</span>
                <span className="text-sm font-bold text-muted-foreground">{prize.times}× · {prize.points} pts</span>
                <Bar value={prize.points} max={data.prizes[0].points} className="col-span-2" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Stat({ label, value, hint, wide }: { label: string; value: ReactNode; hint: string; wide?: boolean }) {
  return (
    <div className={cn("rounded-[22px] bg-card p-4 shadow-soft sm:p-5", wide && "col-span-2 lg:col-span-1")}>
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-3xl font-semibold">{value}</p>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  )
}

function Panel({ title, icon, hint, children }: { title: string; icon: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-[22px] bg-card p-5 shadow-soft">
      <div>
        <h2 className="flex items-center gap-2 font-display text-xl font-semibold"><span className="text-primary">{icon}</span>{title}</h2>
        {hint ? <p className="text-sm text-muted-foreground">{hint}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Bar({ value, max, className }: { value: number; max: number; className?: string }) {
  return (
    <span className={cn("block h-2.5 overflow-hidden rounded-full bg-muted", className)}>
      <span className="block h-full rounded-full bg-primary" style={{ width: `${max ? Math.max(2, (value / max) * 100) : 0}%` }} />
    </span>
  )
}

function ChoreBars({ rows, empty }: { rows: ChoreInsight[]; empty: string }) {
  if (rows.length === 0) return <p className="text-muted-foreground">{empty}</p>
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.chore.id} className="flex items-center gap-3">
          <ChoreIconTile title={row.chore.title} size={36} className="rounded-xl" />
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold">{row.chore.title}</span>
              <span className="shrink-0 text-sm font-bold">{percent(row.rate)}</span>
            </span>
            <Bar value={row.rate} max={1} className="mt-1" />
            <span className="mt-0.5 block text-xs text-muted-foreground">{row.done} of {row.expected} times</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Completion rate per day or week. Hover or tap a column for the numbers. */
function Columns({ buckets }: { buckets: Bucket[] }) {
  const [active, setActive] = useState<number | null>(null)
  const shown = active === null ? null : buckets[active]
  return (
    <div>
      <p className="h-5 text-sm font-semibold" aria-live="polite">
        {shown ? `${shown.label}: ${shown.done} of ${shown.expected} done (${percent(shown.rate)})` : <span className="text-muted-foreground">Tap a column for details</span>}
      </p>
      <div className="relative mt-2 h-40">
        {[1, 0.5].map((line) => (
          <div key={line} className="pointer-events-none absolute inset-x-0 border-t border-border" style={{ bottom: `${line * 100}%` }}>
            <span className="absolute -top-2.5 right-0 bg-card pl-1 text-[11px] font-bold text-muted-foreground">{line * 100}%</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-1 border-b border-border pr-9">
          {buckets.map((bucket, index) => (
            <button key={bucket.from.toISOString()} type="button" onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)} onClick={() => setActive(index)}
              aria-label={`${bucket.label}: ${percent(bucket.rate)}`} className="group flex h-full flex-1 items-end justify-center">
              <span className={cn("block w-full max-w-6 rounded-t-[4px] transition-opacity", bucket.rate === null ? "bg-muted" : "bg-primary", active !== null && active !== index && "opacity-40")}
                style={{ height: `${bucket.rate === null ? 2 : Math.max(2, bucket.rate * 100)}%` }} />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex gap-1 pr-9">
        {buckets.map((bucket, index) => (
          <span key={bucket.from.toISOString()} className="flex-1 truncate text-center text-[11px] font-bold text-muted-foreground">
            {buckets.length > 8 && index % 2 ? "" : bucket.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function Sparkline({ buckets, className }: { buckets: Bucket[]; className?: string }) {
  const points = buckets.map((bucket, index) => ({ x: buckets.length > 1 ? (index / (buckets.length - 1)) * 100 : 50, y: bucket.rate === null ? null : 28 - bucket.rate * 24 }))
  const drawn = points.filter((point): point is { x: number; y: number } => point.y !== null)
  if (drawn.length < 2) return <p className={cn("text-xs text-muted-foreground", className)}>Trend shows after a few more days.</p>
  const path = drawn.map((point, index) => `${index ? "L" : "M"}${point.x},${point.y}`).join(" ")
  const last = drawn[drawn.length - 1]
  const first = drawn[0]
  const up = last.y <= first.y
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg viewBox="-2 0 104 32" preserveAspectRatio="none" className="h-8 w-full min-w-0 flex-1 overflow-visible" aria-hidden="true">
        <path d={`${path} L${last.x},30 L${first.x},30 Z`} className="fill-primary/10" />
        <path d={path} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="stroke-primary" />
      </svg>
      <span className={cn("inline-flex shrink-0 items-center text-xs font-bold", up ? "text-success" : "text-coral")}>
        {up ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{up ? "Improving" : "Slipping"}
      </span>
    </div>
  )
}

