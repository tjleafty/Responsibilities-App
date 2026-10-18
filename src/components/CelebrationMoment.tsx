import { useEffect, useState } from "react"
import { Check, Sparkles, Star, Trophy, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CELEBRATION_EVENT } from "@/lib/celebration"
import { REWARD_RUNTIME_URL, getRewardTheme } from "@/lib/rewardThemes"

export type CelebrationStyle = "sparkle" | "bounce" | "spin" | "pop"

type CelebrationDetail = {
  message: string
  style: CelebrationStyle
  id: number
  reward?: string
  themeKey?: string
  text?: Record<string, string | number>
}

type RewardsRuntime = {
  play: (canvas: HTMLCanvasElement, id: string, options: Record<string, unknown>) => () => void
  adaptTheme: (theme: unknown) => unknown
}

declare global {
  interface Window { Rewards?: RewardsRuntime }
}

let runtimePromise: Promise<RewardsRuntime> | null = null
function loadRewardsRuntime(): Promise<RewardsRuntime> {
  if (window.Rewards) return Promise.resolve(window.Rewards)
  if (runtimePromise) return runtimePromise
  runtimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = REWARD_RUNTIME_URL
    script.async = true
    script.onload = () => window.Rewards ? resolve(window.Rewards) : reject(new Error("Reward animation library did not initialize"))
    script.onerror = () => {
      runtimePromise = null
      reject(new Error("Reward animation library could not be loaded"))
    }
    document.head.appendChild(script)
  })
  return runtimePromise
}

export function CelebrationMoment() {
  const [announcement, setAnnouncement] = useState<CelebrationDetail | null>(null)
  const [runtimeFailed, setRuntimeFailed] = useState(false)
  const [animationFinished, setAnimationFinished] = useState(false)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const handleCelebration = (event: Event) => {
      const detail = (event as CustomEvent<CelebrationDetail>).detail
      if (!detail?.message) return
      setAnnouncement(detail)
      setRuntimeFailed(false)
      setAnimationFinished(false)
    }
    window.addEventListener(CELEBRATION_EVENT, handleCelebration)
    return () => window.removeEventListener(CELEBRATION_EVENT, handleCelebration)
  }, [])

  useEffect(() => {
    if (!announcement?.reward || !announcement.themeKey || !canvas) return
    let cancelled = false
    let stop: (() => void) | undefined
    const resize = () => {
      if (!canvas) return
      const ratio = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(window.innerWidth * ratio)
      canvas.height = Math.round(window.innerHeight * ratio)
    }
    resize()
    window.addEventListener("resize", resize)
    void loadRewardsRuntime().then((runtime) => {
      if (cancelled) return
      const theme = getRewardTheme(announcement.themeKey as string)
      stop = runtime.play(canvas, announcement.reward as string, {
        theme: runtime.adaptTheme(theme),
        text: announcement.text ?? { title: announcement.message },
        transparent: true,
        scrim: theme.mode === "dark" ? 0.66 : 0.48,
        onDone: () => {
          if (!cancelled) setAnimationFinished(true)
        },
      })
    }).catch((error) => {
      console.warn("Uploaded celebration animation could not play:", error)
      if (!cancelled) setRuntimeFailed(true)
    })
    return () => {
      cancelled = true
      stop?.()
      window.removeEventListener("resize", resize)
    }
  }, [announcement?.id, announcement?.reward, announcement?.themeKey, canvas])

  useEffect(() => {
    if (!announcement) return
    const fallbackFinished = runtimeFailed
    if (!animationFinished && !fallbackFinished) return
    const timeout = setTimeout(() => setAnnouncement(null), fallbackFinished ? 1800 : 1200)
    return () => clearTimeout(timeout)
  }, [announcement?.id, animationFinished, runtimeFailed])

  useEffect(() => {
    if (announcement && !announcement.reward) {
      const timeout = setTimeout(() => setAnnouncement(null), 3200)
      return () => clearTimeout(timeout)
    }
  }, [announcement?.id, announcement?.reward])

  const dismiss = () => setAnnouncement(null)
  const Icon = announcement?.style === "sparkle" ? Sparkles : announcement?.style === "bounce" ? Star : announcement?.style === "spin" ? Check : Trophy
  const showCanvas = Boolean(announcement?.reward && announcement.themeKey && !runtimeFailed && !animationFinished)

  return (
    <>
      <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement?.message ?? ""}</div>
      {announcement ? (
        <div className="pointer-events-none fixed inset-x-0 top-4 z-[100] flex justify-center px-4 sm:top-6" aria-hidden="true">
          <div key={announcement.id} className={`celebration-panel celebration-${announcement.style} flex max-w-md items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-card-foreground shadow-lg`}>
            <span className="celebration-mark grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-secondary text-secondary-foreground"><Icon className="h-6 w-6" /></span>
            <p className="font-display text-base font-semibold leading-snug">{announcement.message}</p>
          </div>
        </div>
      ) : null}
      {showCanvas ? <canvas ref={setCanvas} className="fixed inset-0 z-[99] h-dvh w-screen" aria-label="Chore completion celebration" /> : null}
      {announcement ? <Button type="button" size="icon" variant="outline" onClick={dismiss} aria-label="Close celebration" className="fixed right-4 top-4 z-[101] pointer-events-auto"><X className="h-4 w-4" /></Button> : null}
      {announcement && (animationFinished || runtimeFailed) ? <button type="button" onClick={dismiss} className="fixed inset-0 z-[98] cursor-pointer bg-transparent" aria-label="Dismiss celebration" /> : null}
    </>
  )
}
