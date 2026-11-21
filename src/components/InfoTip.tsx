import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HELP, type HelpTopic } from "@/lib/helpText"
import { cn } from "@/lib/utils"

/**
 * A small (i) next to a label that opens a short explanation. The text comes
 * from src/lib/helpText.ts so it can be changed in one place.
 *
 * The trigger is a span with role="button" rather than a <button>, because many
 * labels in the app wrap a switch: a real button would become the label's
 * control and steal the switch's clicks.
 */
export function InfoTip({ topic, className }: { topic: HelpTopic; className?: string }) {
  const [open, setOpen] = useState(false)
  const entry = HELP[topic]
  const toggle = (event: MouseEvent | KeyboardEvent) => {
    // Keep the click from reaching a surrounding <label> (which would flip its switch).
    event.preventDefault()
    event.stopPropagation()
    setOpen((value) => !value)
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          aria-label={`What is "${entry.title}"?`}
          onClick={toggle}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") toggle(event) }}
          className={cn(
            // 20px icon with a bigger invisible tap area around it.
            "relative inline-grid h-5 w-5 shrink-0 cursor-pointer place-items-center rounded-full align-middle text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            "before:absolute before:-inset-2.5 before:content-['']",
            open && "text-primary",
            className,
          )}
        >
          <Info className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        collisionPadding={12}
        className="w-[min(20rem,calc(100vw-24px))] rounded-2xl border-border p-4 shadow-soft"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="font-display text-base font-semibold">{entry.title}</p>
        <div className="mt-1.5 space-y-1.5 text-sm font-normal leading-snug text-muted-foreground">
          {entry.body.map((line) => <p key={line}>{line}</p>)}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/** A label with an (i) after it, for the many `<span className="block text-sm font-bold">` labels. */
export function LabelWithTip({ children, topic, className }: { children: ReactNode; topic: HelpTopic; className?: string }) {
  return <span className={cn("flex items-center gap-1.5", className)}>{children}<InfoTip topic={topic} /></span>
}
