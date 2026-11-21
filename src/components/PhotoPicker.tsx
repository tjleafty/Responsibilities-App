import { useCallback, useEffect, useRef, useState } from "react"
import type { KeyboardEvent, PointerEvent, WheelEvent } from "react"
import { Camera, Crop, ImagePlus, Loader2, Move, Trash2, ZoomIn, ZoomOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Avatar, ErrorNote, Sheet } from "@/components/kit"
import type { FamilyProfile } from "@/lib/familyTypes"
import {
  CENTERED, MAX_ZOOM, PhotoReadError, canUseLiveCamera, clampFrame, drawFrame, frameRect, photoFromFrame, photoSourceFromFile, photoSourceFromVideo,
} from "@/lib/profilePhoto"
import type { PhotoFrame, PhotoSource } from "@/lib/profilePhoto"
import { cn } from "@/lib/utils"

/**
 * A kid's profile photo: the avatar with Take photo / Choose photo / Remove.
 * "Take photo" opens a live camera (phones, tablets and laptops); without one it
 * falls back to the phone's own camera picker. Every new photo then opens the framing
 * step, where the parent drags and zooms it so the face sits in the circle.
 * Hands back a small square JPEG data URL.
 */
export function PhotoPicker({ profile, onChange, onError, size = 88, busy = false, compact = false, className }: {
  profile: FamilyProfile
  onChange: (photo: string | null) => void
  /** Where a compact picker shows "couldn't read that photo" messages (it has no room of its own). */
  onError?: (message: string) => void
  size?: number
  busy?: boolean
  /** Just the avatar with a camera badge (tap to take a photo); no buttons. */
  compact?: boolean
  className?: string
}) {
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  /** The photo being framed (open while set), and the last one, so "Adjust" can reframe it at full size. */
  const [framing, setFraming] = useState<PhotoSource | null>(null)
  const [last, setLast] = useState<{ source: PhotoSource; frame: PhotoFrame; photo: string } | null>(null)
  useEffect(() => {
    if (error) onError?.(error)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error])
  const pickRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)
  const name = profile.display_name.trim() || "this kid"

  const fromFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setReading(true)
    try {
      setFraming(await photoSourceFromFile(file))
    } catch (caught) {
      console.error("Reading photo failed:", caught)
      setError(caught instanceof PhotoReadError ? caught.message : "We couldn't read that photo. Try a different one.")
    } finally {
      setReading(false)
    }
  }

  const useFramed = (source: PhotoSource, frame: PhotoFrame) => {
    const photo = photoFromFrame(source, frame)
    setLast({ source, frame, photo })
    setFraming(null)
    onChange(photo)
  }

  // "Adjust" works for a photo picked in this visit; saved photos are small, so pick again to reframe those.
  const canAdjust = Boolean(last && profile.photo_url === last.photo)
  const disabled = busy || reading

  const takePhoto = () => {
    setError(null)
    if (canUseLiveCamera()) setCamera(true)
    else captureRef.current?.click()
  }

  const inputs = (
    <>
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void fromFile(event.target.files?.[0]); event.target.value = "" }} />
      <input ref={captureRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { void fromFile(event.target.files?.[0]); event.target.value = "" }} />
      <CameraSheet open={camera} onOpenChange={setCamera} name={name} onCapture={(source) => { setCamera(false); setFraming(source) }} onUnavailable={() => { setCamera(false); captureRef.current?.click() }} />
      <FrameSheet source={framing} initial={framing && last?.source === framing ? last.frame : CENTERED} name={name} onCancel={() => setFraming(null)} onUse={useFramed} />
    </>
  )

  if (compact) {
    return (
      <>
        <button type="button" onClick={takePhoto} disabled={disabled} className={cn("relative shrink-0 rounded-full", className)} aria-label={profile.photo_url ? `Change ${name}'s photo` : `Take ${name}'s photo`}>
          <Avatar profile={profile} size={size} />
          <span className="absolute -bottom-0.5 -left-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft ring-2 ring-card"><Camera className="h-3.5 w-3.5" /></span>
        </button>
        {error ? <span role="alert" className="sr-only">{error}</span> : null}
        {inputs}
      </>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={takePhoto} disabled={disabled} className="relative shrink-0 rounded-full" aria-label={profile.photo_url ? `Retake ${name}'s photo` : `Take ${name}'s photo`}>
          <Avatar profile={profile} size={size} />
          <span className="absolute -bottom-0.5 -left-0.5 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft ring-2 ring-card"><Camera className="h-4 w-4" /></span>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">{profile.photo_url ? "This photo shows everywhere instead of their initial." : "Snap a photo so everyone can spot their chores at a glance."}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={takePhoto} disabled={disabled}><Camera className="h-4 w-4" />{profile.photo_url ? "Retake" : "Take photo"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => pickRef.current?.click()} disabled={disabled}>{reading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}{reading ? "Opening..." : "Choose photo"}</Button>
            {canAdjust && last ? <Button type="button" size="sm" variant="outline" onClick={() => setFraming(last.source)} disabled={disabled}><Crop className="h-4 w-4" />Adjust</Button> : null}
            {profile.photo_url ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={disabled} className="text-muted-foreground"><Trash2 className="h-4 w-4" />Remove</Button> : null}
          </div>
        </div>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {inputs}
    </div>
  )
}

function CameraSheet({ open, onOpenChange, name, onCapture, onUnavailable }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  name: string
  onCapture: (source: PhotoSource) => void
  onUnavailable: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<"user" | "environment">("user")
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReady(false)
    setError(null)
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 720 } }, audio: false })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((track) => track.stop())
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video.play().catch(() => undefined)
        }
      })
      .catch((caught: unknown) => {
        if (cancelled) return
        console.warn("Camera unavailable:", caught)
        const name = caught instanceof DOMException ? caught.name : ""
        if (name === "NotAllowedError") setError("The camera is blocked. Allow camera access for this site in your browser settings, or choose a photo instead.")
        else onUnavailable()
      })
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, facing])

  const mirror = facing === "user"
  const take = () => {
    const video = videoRef.current
    if (video && video.videoWidth) onCapture(photoSourceFromVideo(video, mirror))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Smile, ${name}!`} description="Center your face in the circle. You can nudge it after." footer={
      <Button onClick={take} disabled={!ready} className="w-full"><Camera className="h-5 w-5" />{ready ? "Take photo" : "Starting camera..."}</Button>
    }>
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[28px] bg-muted">
          <video ref={videoRef} playsInline muted onLoadedData={() => setReady(true)} className={cn("h-full w-full object-cover", mirror && "-scale-x-100")} />
          {/* The saved photo is this square; avatars show the circle inside it. */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-[999px] ring-black/30" aria-hidden="true" />
        </div>
        <button type="button" onClick={() => setFacing((side) => side === "user" ? "environment" : "user")} className="mx-auto block text-sm font-bold text-muted-foreground hover:text-foreground">Switch camera</button>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  )
}

/** Pixels on the framing canvas per CSS pixel, so the preview stays sharp on retina screens. */
const STAGE_SCALE = 2

/**
 * Drag to move, pinch / scroll / slider to zoom. The square is what gets saved;
 * the clear circle is what avatars show.
 */
function FrameSheet({ source, initial, name, onCancel, onUse }: {
  source: PhotoSource | null
  initial: PhotoFrame
  name: string
  onCancel: () => void
  onUse: (source: PhotoSource, frame: PhotoFrame) => void
}) {
  const [frame, setFrame] = useState<PhotoFrame>(initial)
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ frame: PhotoFrame; x: number; y: number; distance: number } | null>(null)

  useEffect(() => {
    if (source) setFrame(clampFrame(source, initial))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  useEffect(() => {
    if (!canvas || !source) return
    const size = Math.round(canvas.getBoundingClientRect().width * STAGE_SCALE) || 640
    if (canvas.width !== size) {
      canvas.width = size
      canvas.height = size
    }
    drawFrame(canvas, source, frame)
  }, [canvas, source, frame])

  const update = useCallback((next: PhotoFrame) => {
    if (source) setFrame(clampFrame(source, next))
  }, [source])

  /** Moves the frame by a drag of dx, dy CSS pixels on the stage, starting from `from`. */
  const moved = (from: PhotoFrame, dx: number, dy: number, zoom = from.zoom): PhotoFrame => {
    if (!source || !canvas) return from
    const { side } = frameRect(source, { ...from, zoom })
    const perPixel = side / canvas.getBoundingClientRect().width
    return { zoom, x: from.x - (dx * perPixel) / source.width, y: from.y - (dy * perPixel) / source.height }
  }

  const center = () => {
    const points = [...pointers.current.values()]
    const x = points.reduce((sum, point) => sum + point.x, 0) / points.length
    const y = points.reduce((sum, point) => sum + point.y, 0) / points.length
    const distance = points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0
    return { x, y, distance }
  }

  const startGesture = () => {
    if (pointers.current.size) gesture.current = { frame, ...center() }
    else gesture.current = null
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    startGesture()
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    const now = center()
    const start = gesture.current
    const zoom = start.distance && now.distance ? start.frame.zoom * (now.distance / start.distance) : start.frame.zoom
    update(moved(start.frame, now.x - start.x, now.y - start.y, zoom))
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId)
    startGesture()
  }

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    update({ ...frame, zoom: frame.zoom * Math.exp(-event.deltaY / 400) })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 10
    const keys: Record<string, () => PhotoFrame> = {
      ArrowLeft: () => moved(frame, step, 0),
      ArrowRight: () => moved(frame, -step, 0),
      ArrowUp: () => moved(frame, 0, step),
      ArrowDown: () => moved(frame, 0, -step),
      "+": () => ({ ...frame, zoom: frame.zoom * 1.1 }),
      "=": () => ({ ...frame, zoom: frame.zoom * 1.1 }),
      "-": () => ({ ...frame, zoom: frame.zoom / 1.1 }),
    }
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    update(action())
  }

  return (
    <Sheet open={Boolean(source)} onOpenChange={(open) => { if (!open) onCancel() }} title="Frame the photo" description={`Drag to move and zoom so ${name}'s face fills the circle.`} footer={
      <div className="flex gap-3">
        <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        <Button onClick={() => source && onUse(source, frame)} className="flex-1">Use this photo</Button>
      </div>
    }>
      <div className="space-y-4">
        <div
          role="application"
          tabIndex={0}
          aria-label="Photo framing. Drag or use arrow keys to move, plus and minus to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          onKeyDown={onKeyDown}
          className="relative mx-auto aspect-square w-full max-w-sm cursor-grab touch-none select-none overflow-hidden rounded-[28px] bg-muted outline-none focus-visible:ring-4 focus-visible:ring-ring active:cursor-grabbing"
        >
          <canvas ref={setCanvas} className="h-full w-full" />
          {/* The saved photo is this square; avatars show the circle inside it. */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-[999px] ring-black/45" aria-hidden="true" />
          <div className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/80" aria-hidden="true" />
          <span className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white" aria-hidden="true"><Move className="h-3.5 w-3.5" />Drag to move</span>
        </div>
        <div className="mx-auto flex max-w-sm items-center gap-3">
          <button type="button" onClick={() => update({ ...frame, zoom: frame.zoom / 1.2 })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></button>
          <Slider value={[frame.zoom]} min={1} max={MAX_ZOOM} step={0.01} onValueChange={([zoom]) => update({ ...frame, zoom })} aria-label="Zoom" />
          <button type="button" onClick={() => update({ ...frame, zoom: frame.zoom * 1.2 })} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground hover:text-foreground" aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></button>
        </div>
        <button type="button" onClick={() => update(CENTERED)} className="mx-auto block text-sm font-bold text-muted-foreground hover:text-foreground">Reset</button>
      </div>
    </Sheet>
  )
}
