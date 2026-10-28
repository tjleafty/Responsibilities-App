import { useEffect, useState, type ReactNode } from "react"
import { ArrowLeft, Check, Clock3, Film, MessageCircle, PartyPopper, Play, RotateCcw, Send, Timer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ChoreIconTile, ErrorNote, MASCOT, ProgressBar, TokenPill } from "@/components/kit"
import type { KidAppProps } from "@/components/kid/KidApp"
import { KidVideoPlayer } from "@/components/kid/KidVideoPlayer"
import type { ChoreCompletionRecord, ChoreRecord } from "@/lib/familyTypes"
import { choreState, completionFor, firstName, grownUpsOf, requiresApproval } from "@/lib/family"
import { parseCompletedTaskIds, subtasksFor } from "@/lib/choreUtils"
import { completeChore, saveChoreProgress } from "@/lib/choreActions"
import { choreVideo } from "@/lib/choreIcons"
import { getKidTheme } from "@/lib/themes"
import { chorePoints } from "@/lib/difficulty"
import { cn } from "@/lib/utils"

interface KidChoreDetailProps extends KidAppProps {
  chore: ChoreRecord
  onBack: () => void
  onSaved: (row: ChoreCompletionRecord) => void
}

export function KidChoreDetail({ profile, profiles, chores, completions, chore, onBack, onSaved }: KidChoreDetailProps) {
  const theme = getKidTheme(profile.theme_key)
  const completion = completionFor(chore, profile.id, completions)
  const state = choreState(completion)
  const steps = subtasksFor(chore, profile.id, profiles)
  const [checked, setChecked] = useState<string[]>(() => parseCompletedTaskIds(completion?.completed_task_ids))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [watching, setWatching] = useState(false)
  const points = chorePoints(chore)
  const video = choreVideo(chore.title)
  const locked = state === "waiting" || state === "done"
  const allChecked = steps.every((step) => checked.includes(step.id))
  const grownUp = grownUpsOf(profiles)[0]

  useEffect(() => { setChecked(parseCompletedTaskIds(completion?.completed_task_ids)) }, [completion?.id, completion?.completed_task_ids])

  const toggle = async (stepId: string) => {
    if (locked || busy) return
    const next = checked.includes(stepId) ? checked.filter((id) => id !== stepId) : [...checked, stepId]
    setChecked(next)
    setError(null)
    try {
      onSaved(await saveChoreProgress(chore, profile, completion, next))
    } catch (caught) {
      console.error("Saving step failed:", caught)
      setChecked(checked)
      setError("That didn't save. Try again.")
    }
  }

  const finish = async () => {
    setBusy(true)
    setError(null)
    try {
      const saved = await completeChore(chore, profile, completion, checked, { chores, completions, profiles })
      onSaved(saved)
      if (requiresApproval(chore)) setSentTo(firstName(grownUp) || "your grown-up")
      else onBack()
    } catch (caught) {
      console.error("Finishing chore failed:", caught)
      setError(caught instanceof Error && caught.message.startsWith("Check") ? caught.message : "That didn't save. Try again.")
    } finally {
      setBusy(false)
    }
  }

  if (watching && video) {
    return <KidVideoPlayer title={chore.title} kidName={firstName(profile)} video={video} onBack={() => setWatching(false)} onReady={() => setWatching(false)} />
  }

  if (sentTo) {
    return (
      <div className="mx-auto flex min-h-[80dvh] max-w-md flex-col items-center justify-center text-center">
        <span className="float-soft grid h-32 w-32 place-items-center rounded-full bg-accent/40 text-6xl" aria-hidden="true">{MASCOT}</span>
        <h1 className="mt-6 font-display text-4xl font-semibold">Sent to {sentTo}!</h1>
        <p className="mt-2 text-lg text-muted-foreground">They'll take a look soon. Your {points > 0 ? `${points} ${theme.tokenName}` : "reward"} will show up once they say it's done.</p>
        <Button size="lg" onClick={onBack} className="mt-8 w-full">Back to my chores</Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-28 md:pb-0">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card shadow-soft" aria-label="Back"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-semibold sm:text-3xl">{chore.title}</h1>
        {points > 0 ? <TokenPill amount={points} token={theme.token} prefix="+" className="bg-card px-4 py-2 text-base shadow-soft" /> : null}
      </header>

      {state === "sent_back" ? (
        <section className="rounded-[22px] border-2 border-coral/40 bg-coral/10 p-4">
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-coral"><RotateCcw className="h-5 w-5" />Almost there!</p>
          <p className="mt-1 font-semibold">{completion?.rejection_reason || "Let's give it another try."}</p>
          {completion?.parent_feedback ? <ParentNote name={firstName(grownUp)} profile={grownUp} text={completion.parent_feedback} /> : null}
        </section>
      ) : null}

      {chore.time_limit_minutes ? (
        <p className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 font-bold shadow-soft"><Timer className="h-5 w-5 text-primary" />Try to finish in {chore.time_limit_minutes} minutes</p>
      ) : null}

      {video ? (
        <button type="button" onClick={() => setWatching(true)} className="block w-full overflow-hidden rounded-[22px] bg-card text-left shadow-soft">
          <span className="relative block">
            <img src={video.poster} alt="" className="aspect-video w-full object-cover" />
            <span className="absolute inset-0 grid place-items-center"><span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-[#2D2A4A] shadow-soft"><Play className="ml-1 h-7 w-7 fill-current" /></span></span>
          </span>
          <span className="flex items-center justify-between px-4 py-3 font-bold"><span className="flex items-center gap-2"><Film className="h-5 w-5 text-primary" />Watch how · {video.chapters.length} steps</span><span className="text-muted-foreground">{video.length}</span></span>
        </button>
      ) : (
        <section className="flex items-center gap-4 rounded-[22px] bg-card p-4 shadow-soft">
          <ChoreIconTile title={chore.title} size={64} />
          <div>
            <p className="font-display text-lg font-semibold">How-to video coming soon</p>
            <p className="text-sm text-muted-foreground">Follow the steps below for now.</p>
          </div>
        </section>
      )}

      {state === "waiting" ? <StatusCard icon={<Clock3 className="h-6 w-6" />} title="Waiting for a grown-up" className="bg-accent/30">You finished this one. A grown-up will check it soon.</StatusCard> : null}
      {state === "done" ? <StatusCard icon={<Check className="h-6 w-6" strokeWidth={3} />} title="All done!" className="bg-success/15 text-success">{points > 0 ? `You earned ${points} ${theme.tokenName}.` : "Nice work."}</StatusCard> : null}

      {steps.length > 0 ? (
        <section className="space-y-3" aria-label="Steps">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">Steps</h2>
            <span className="font-bold text-muted-foreground">{checked.filter((id) => steps.some((step) => step.id === id)).length} of {steps.length}</span>
          </div>
          <ProgressBar value={checked.filter((id) => steps.some((step) => step.id === id)).length} max={steps.length} thick />
          <ol className="space-y-3">
            {steps.map((step, index) => {
              const done = checked.includes(step.id)
              return (
                <li key={step.id}>
                  <button
                    type="button"
                    onClick={() => void toggle(step.id)}
                    disabled={locked}
                    aria-pressed={done}
                    className={cn(
                      "flex min-h-[72px] w-full items-center gap-4 rounded-[22px] bg-card p-4 text-left shadow-soft transition-transform active:scale-[0.98] disabled:active:scale-100",
                      done && "bg-primary/10",
                    )}
                  >
                    <span className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl font-semibold", done ? "bg-primary text-primary-foreground" : "border-4 border-muted text-muted-foreground")}>
                      {done ? <Check className="h-6 w-6" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className={cn("font-display text-xl font-semibold", done && "text-muted-foreground line-through decoration-2")}>{step.title}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      ) : null}

      <ErrorNote>{error}</ErrorNote>

      {!locked ? (
        <div className="fixed inset-x-0 bottom-0 z-40 space-y-2 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur pb-safe md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto max-w-2xl space-y-2 pb-3 md:pb-0">
            <Button size="lg" onClick={() => void finish()} disabled={!allChecked || busy} className="w-full text-xl">
              {requiresApproval(chore)
                ? <><Send className="h-6 w-6" />{busy ? "Sending..." : "Send for approval"}</>
                : <><PartyPopper className="h-6 w-6" />{busy ? "Saving..." : "Done"}</>}
            </Button>
            {!allChecked ? <p className="text-center text-sm font-bold text-muted-foreground">Check every step to finish.</p> : null}
            {steps.length > 0 ? <Button variant="ghost" onClick={onBack} className="w-full">Save for later</Button> : null}
          </div>
        </div>
      ) : (
        <Button size="lg" variant="outline" onClick={onBack} className="w-full">Back to my chores</Button>
      )}
    </div>
  )
}

function ParentNote({ name, profile, text }: { name: string; profile?: KidAppProps["profile"]; text: string }) {
  return (
    <div className="mt-3 flex items-start gap-3">
      {profile ? <Avatar profile={profile} size={36} /> : <MessageCircle className="h-6 w-6" />}
      <p className="rounded-2xl rounded-tl-sm bg-card px-4 py-3 shadow-soft">
        {name ? <span className="block text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{name} says</span> : null}
        {text}
      </p>
    </div>
  )
}

function StatusCard({ icon, title, children, className }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex items-center gap-4 rounded-[22px] p-4", className)}>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card shadow-soft">{icon}</span>
      <div>
        <p className="font-display text-xl font-semibold">{title}</p>
        <p className="text-foreground/80">{children}</p>
      </div>
    </section>
  )
}
