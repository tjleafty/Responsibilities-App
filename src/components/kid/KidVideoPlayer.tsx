import { useRef, useState } from "react"
import { ArrowLeft, Check, Lightbulb, Play, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MASCOT } from "@/components/kit"
import type { ChoreVideo } from "@/lib/choreIcons"
import { cn } from "@/lib/utils"

function clock(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`
}

/** Full how-to video with tappable chapters that follow along as it plays. */
export function KidVideoPlayer({ title, kidName, video, onBack, onReady }: { title: string; kidName: string; video: ChoreVideo; onBack: () => void; onReady: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [watched, setWatched] = useState<number[]>([])
  const current = video.chapters.findIndex((chapter) => time >= chapter.start && time < chapter.end)

  const onTime = () => {
    const now = ref.current?.currentTime ?? 0
    setTime(now)
    video.chapters.forEach((chapter, index) => {
      if (now >= chapter.end - 0.25) setWatched((list) => list.includes(index) ? list : [...list, index])
    })
  }

  const jump = (start: number) => {
    const player = ref.current
    if (!player) return
    player.currentTime = start
    void player.play().catch(() => undefined)
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-28 md:pb-0">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-card shadow-soft" aria-label="Back to chore"><ArrowLeft className="h-5 w-5" /></button>
        <div className="min-w-0">
          <p className="text-sm font-bold text-muted-foreground">How to</p>
          <h1 className="truncate font-display text-2xl font-semibold sm:text-3xl">{title}</h1>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-[22px] bg-black shadow-soft">
            <video ref={ref} src={video.src} poster={video.poster} controls playsInline autoPlay preload="metadata" onTimeUpdate={onTime} className="aspect-video w-full" aria-label={`How to ${title.toLowerCase()}`} />
          </div>
          {current >= 0 ? <p className="rounded-full bg-card px-4 py-2 text-center font-display text-lg font-semibold shadow-soft" aria-live="polite">Step {current + 1}: {video.chapters[current].title}</p> : null}
          {video.tip ? (
            <aside className="flex items-start gap-3 rounded-[22px] bg-accent/25 p-4">
              <span className="text-4xl" aria-hidden="true">{MASCOT}</span>
              <p>
                <span className="flex items-center gap-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground"><Lightbulb className="h-3.5 w-3.5" />Tip for {kidName}</span>
                <span className="font-semibold">{video.tip}</span>
              </p>
            </aside>
          ) : null}
        </div>

        <section className="space-y-2" aria-label="Chapters">
          <h2 className="flex items-center justify-between font-display text-xl font-semibold">Step by step <span className="text-sm font-bold text-muted-foreground">Tap to jump</span></h2>
          <ol className="space-y-2">
            {video.chapters.map((chapter, index) => {
              const playing = index === current
              const seen = watched.includes(index)
              return (
                <li key={chapter.title}>
                  <button type="button" onClick={() => jump(chapter.start)} aria-current={playing ? "step" : undefined}
                    className={cn("flex min-h-16 w-full items-center gap-3 rounded-[20px] p-3 text-left shadow-soft transition-colors", playing ? "bg-accent text-accent-foreground" : "bg-card hover:bg-muted")}>
                    <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full font-display font-semibold", playing ? "bg-foreground text-background" : seen ? "bg-success text-white" : "bg-muted")}>
                      {playing ? <Play className="h-4 w-4 fill-current" /> : seen ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-display text-lg font-semibold leading-tight">{chapter.title}</span>
                      <span className="text-sm opacity-75">{clock(chapter.start)} to {clock(chapter.end)}{playing ? " · Playing now" : ""}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur pb-safe md:static md:border-0 md:bg-transparent md:p-0">
        <Button size="lg" onClick={onReady} className="mx-auto flex w-full max-w-4xl text-xl"><Rocket className="h-6 w-6" />I'm ready, let's do it!</Button>
      </div>
    </div>
  )
}
