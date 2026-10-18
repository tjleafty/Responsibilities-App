import { Settings } from "lucide-react"

export function ParentControlsPlaceholder() {
  return (
    <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8" aria-labelledby="parent-controls-heading">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-secondary-foreground">
        <Settings className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="mt-5 text-sm font-semibold uppercase tracking-[0.16em] text-primary">Household</p>
      <h2 id="parent-controls-heading" className="mt-1 font-display text-2xl font-bold text-card-foreground">Parental Controls</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">This is the home for household settings parents can manage. Controls and family settings will be added here as they become available.</p>
      <div className="mt-6 rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">No parental controls are available yet.</div>
    </section>
  )
}
