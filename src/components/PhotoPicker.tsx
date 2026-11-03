import { useEffect, useRef, useState } from "react"
import { Camera, ImagePlus, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, ErrorNote, Sheet } from "@/components/kit"
import type { FamilyProfile } from "@/lib/familyTypes"
import { canUseLiveCamera, photoFromFile, photoFromVideo } from "@/lib/profilePhoto"
import { cn } from "@/lib/utils"

/**
 * A kid's profile photo: the avatar with Take photo / Choose photo / Remove.
 * "Take photo" opens a live camera (phones, tablets and laptops); without one it
 * falls back to the phone's own camera picker. Hands back a small square JPEG data URL.
 */
export function PhotoPicker({ profile, onChange, size = 88, busy = false, compact = false, className }: {
  profile: FamilyProfile
  onChange: (photo: string | null) => void
  size?: number
  busy?: boolean
  /** Just the avatar with a camera badge (tap to take a photo); no buttons. */
  compact?: boolean
  className?: string
}) {
  const [camera, setCamera] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pickRef = useRef<HTMLInputElement>(null)
  const captureRef = useRef<HTMLInputElement>(null)
  const name = profile.display_name.trim() || "this kid"

  const fromFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      onChange(await photoFromFile(file))
    } catch (caught) {
      console.error("Reading photo failed:", caught)
      setError("We couldn't read that photo. Try a different one.")
    }
  }

  const takePhoto = () => {
    setError(null)
    if (canUseLiveCamera()) setCamera(true)
    else captureRef.current?.click()
  }

  const inputs = (
    <>
      <input ref={pickRef} type="file" accept="image/*" className="hidden" onChange={(event) => { void fromFile(event.target.files?.[0]); event.target.value = "" }} />
      <input ref={captureRef} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => { void fromFile(event.target.files?.[0]); event.target.value = "" }} />
      <CameraSheet open={camera} onOpenChange={setCamera} name={name} onCapture={(photo) => { setCamera(false); onChange(photo) }} onUnavailable={() => { setCamera(false); captureRef.current?.click() }} />
    </>
  )

  if (compact) {
    return (
      <>
        <button type="button" onClick={takePhoto} disabled={busy} className={cn("relative shrink-0 rounded-full", className)} aria-label={profile.photo_url ? `Change ${name}'s photo` : `Take ${name}'s photo`}>
          <Avatar profile={profile} size={size} />
          <span className="absolute -bottom-0.5 -left-0.5 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft ring-2 ring-card"><Camera className="h-3.5 w-3.5" /></span>
        </button>
        {inputs}
      </>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-4">
        <button type="button" onClick={takePhoto} disabled={busy} className="relative shrink-0 rounded-full" aria-label={profile.photo_url ? `Retake ${name}'s photo` : `Take ${name}'s photo`}>
          <Avatar profile={profile} size={size} />
          <span className="absolute -bottom-0.5 -left-0.5 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow-soft ring-2 ring-card"><Camera className="h-4 w-4" /></span>
        </button>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm text-muted-foreground">{profile.photo_url ? "This photo shows everywhere instead of their initial." : "Snap a photo so everyone can spot their chores at a glance."}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={takePhoto} disabled={busy}><Camera className="h-4 w-4" />{profile.photo_url ? "Retake" : "Take photo"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => pickRef.current?.click()} disabled={busy}><ImagePlus className="h-4 w-4" />Choose photo</Button>
            {profile.photo_url ? <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)} disabled={busy} className="text-muted-foreground"><Trash2 className="h-4 w-4" />Remove</Button> : null}
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
  onCapture: (photo: string) => void
  onUnavailable: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<"user" | "environment">("user")
  const [ready, setReady] = useState(false)
  const [snap, setSnap] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setReady(false)
    setSnap(null)
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
    if (video && video.videoWidth) setSnap(photoFromVideo(video, mirror))
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Smile, ${name}!`} description="Center your face in the circle." footer={
      snap ? (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setSnap(null)} className="flex-1"><RotateCcw className="h-5 w-5" />Try again</Button>
          <Button onClick={() => onCapture(snap)} className="flex-1">Use this photo</Button>
        </div>
      ) : (
        <Button onClick={take} disabled={!ready} className="w-full"><Camera className="h-5 w-5" />{ready ? "Take photo" : "Starting camera..."}</Button>
      )
    }>
      <div className="space-y-3">
        <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-[28px] bg-muted">
          <video ref={videoRef} playsInline muted onLoadedData={() => setReady(true)} className={cn("h-full w-full object-cover", mirror && "-scale-x-100", snap && "invisible")} />
          {snap ? <img src={snap} alt={`New photo of ${name}`} className="absolute inset-0 h-full w-full object-cover" /> : null}
          {/* The saved photo is this square; avatars show the circle inside it. */}
          <div className="pointer-events-none absolute inset-0 rounded-full ring-[999px] ring-black/30" aria-hidden="true" />
        </div>
        {!snap ? <button type="button" onClick={() => setFacing((side) => side === "user" ? "environment" : "user")} className="mx-auto block text-sm font-bold text-muted-foreground hover:text-foreground">Switch camera</button> : null}
        <ErrorNote>{error}</ErrorNote>
      </div>
    </Sheet>
  )
}
