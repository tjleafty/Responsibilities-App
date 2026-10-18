import type { CelebrationStyle } from "@/components/CelebrationMoment"
import { REWARD_IDS, REWARD_RUNTIME_URL, REWARD_SOUND_RUNTIME_URL } from "@/lib/rewardThemes"

export const CELEBRATION_EVENT = "chorereward:celebration"

const soundPatterns: Record<CelebrationStyle, number[]> = {
  sparkle: [880, 1174, 1480],
  bounce: [659, 880, 1046],
  spin: [784, 988, 1318],
  pop: [523, 784, 1046],
}

export interface ChoreCelebrationOptions {
  themeKey?: string
  reward?: string
  text?: Record<string, string | number>
}

interface CelebrationDetail {
  message: string
  style: CelebrationStyle
  id: number
  reward?: string
  themeKey?: string
  text?: Record<string, string | number>
}

type RewardSoundsRuntime = {
  render: (id: string) => { sampleRate: number; samples: Float32Array }
}

type RewardGlobal = Window & { Rewards?: unknown; RewardSounds?: RewardSoundsRuntime }

let audioContext: AudioContext | null = null
let celebrationId = 0
let rewardSoundsPromise: Promise<RewardSoundsRuntime> | null = null
const decodedSounds = new Map<string, Promise<AudioBuffer>>()

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Could not load reward asset: ${src}`))
    document.head.appendChild(script)
  })
}

function loadRewardSounds(): Promise<RewardSoundsRuntime> {
  const globals = window as RewardGlobal
  if (globals.RewardSounds) return Promise.resolve(globals.RewardSounds)
  if (rewardSoundsPromise) return rewardSoundsPromise
  rewardSoundsPromise = (async () => {
    if (!globals.Rewards) await loadScript(REWARD_RUNTIME_URL)
    if (!globals.RewardSounds) await loadScript(REWARD_SOUND_RUNTIME_URL)
    if (!globals.RewardSounds) throw new Error("Reward sound library did not initialize")
    return globals.RewardSounds
  })().catch((error) => {
    rewardSoundsPromise = null
    throw error
  })
  return rewardSoundsPromise
}

function unlockAudio(): AudioContext | null {
  try {
    if (typeof window !== "undefined" && window.AudioContext) {
      audioContext ??= new window.AudioContext()
      if (audioContext.state === "suspended") void audioContext.resume().catch(() => undefined)
      return audioContext
    }
  } catch {
    // Audio is optional; the visual celebration still works in restricted browsers.
  }
  return null
}

/** Call synchronously from the user's click, then announce only after a save succeeds. */
export function prepareCelebration(options?: ChoreCelebrationOptions) {
  unlockAudio()
  if (typeof window !== "undefined") void loadRewardSounds().catch((error) => console.warn("Reward sound library could not preload:", error))

  return (message: string, overrides?: ChoreCelebrationOptions) => {
    if (typeof window === "undefined") return
    const styles: CelebrationStyle[] = ["sparkle", "bounce", "spin", "pop"]
    const style = styles[Math.floor(Math.random() * styles.length)]
    const settings = { ...options, ...overrides }
    const reward = settings.reward ?? REWARD_IDS[Math.floor(Math.random() * REWARD_IDS.length)]
    celebrationId += 1
    const detail: CelebrationDetail = {
      message,
      style,
      id: celebrationId,
      ...(settings.themeKey ? { themeKey: settings.themeKey } : {}),
      ...(settings.text ? { text: settings.text } : {}),
      ...(settings.themeKey || settings.reward || overrides ? { reward } : {}),
    }
    window.dispatchEvent(new CustomEvent(CELEBRATION_EVENT, { detail }))
    if (detail.reward) void playUploadedSound(detail.reward)
    else playCelebrationNotes(style)
  }
}

async function playUploadedSound(reward: string) {
  const context = unlockAudio()
  if (!context) return

  try {
    let sound = decodedSounds.get(reward)
    if (!sound) {
      sound = loadRewardSounds().then((runtime) => {
        const rendered = runtime.render(reward)
        const audio = context.createBuffer(1, rendered.samples.length, rendered.sampleRate)
        audio.copyToChannel(rendered.samples, 0)
        return audio
      })
      decodedSounds.set(reward, sound)
    }
    const buffer = await sound
    if (context.state !== "running") return
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start()
    source.onended = () => source.disconnect()
  } catch (error) {
    decodedSounds.delete(reward)
    console.warn("Uploaded chore celebration sound could not play:", error)
    playCelebrationNotes("sparkle")
  }
}

function playCelebrationNotes(style: CelebrationStyle) {
  const context = audioContext
  if (!context || context.state !== "running") return

  const notes = soundPatterns[style]
  const startAt = context.currentTime + 0.015
  notes.forEach((frequency, index) => {
    const start = startAt + index * 0.105
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = style === "spin" ? "sine" : "triangle"
    oscillator.frequency.setValueAtTime(frequency, start)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.065, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + 0.23)
  })
}
