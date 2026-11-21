import { db } from "@/lib/db"

/** Photos are saved as a square this many pixels wide (about 15 KB as a JPEG). */
const PHOTO_SIZE = 256
/** Picked photos are shrunk to this many pixels on the long side before framing, so huge phone photos stay quick. */
const SOURCE_MAX = 1600

/** A picked or captured photo, ready to frame. */
export interface PhotoSource {
  canvas: HTMLCanvasElement
  width: number
  height: number
}

/** Where the saved square sits on the photo: zoom 1 fits the short side; x and y are the square's center, 0 to 1. */
export interface PhotoFrame {
  zoom: number
  x: number
  y: number
}

export const MAX_ZOOM = 4

export const CENTERED: PhotoFrame = { zoom: 1, x: 0.5, y: 0.5 }

/** A photo read failure whose message is safe to show as is. */
export class PhotoReadError extends Error {}

function toSource(image: CanvasImageSource, width: number, height: number, mirror = false): PhotoSource {
  const scale = Math.min(1, SOURCE_MAX / Math.max(width, height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No canvas")
  if (mirror) {
    // Front cameras preview as a mirror; keep what the kid saw.
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }
  context.imageSmoothingQuality = "high"
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, width: canvas.width, height: canvas.height }
}

/** What a file really holds, from its first bytes (names and types lie: iPhone HEIC photos are often renamed .jpg). */
async function sniff(file: Blob): Promise<"heic" | "jpeg" | "png" | "other"> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg"
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "png"
  const box = String.fromCharCode(...bytes.slice(4, 12))
  if (box.startsWith("ftyp") && /heic|heix|hevc|heim|heis|mif1|msf1/.test(box.slice(4))) return "heic"
  return "other"
}

async function decode(blob: Blob): Promise<PhotoSource> {
  if (typeof createImageBitmap === "function") {
    try {
      // Applies the photo's EXIF rotation, so sideways phone photos come out upright.
      const bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" })
      try {
        return toSource(bitmap, bitmap.width, bitmap.height)
      } finally {
        bitmap.close()
      }
    } catch (caught) {
      console.warn("createImageBitmap failed, trying <img>:", caught)
    }
  }
  const url = URL.createObjectURL(blob)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return toSource(image, image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** HEIC to JPEG, with the converter loaded only when it's needed (it's large). */
async function fromHeic(file: Blob): Promise<Blob> {
  const { heicTo } = await import("heic-to")
  return heicTo({ blob: file, type: "image/jpeg", quality: 0.9 })
}

/** Reads a picked or captured image file (JPEG, PNG, WebP, HEIC...) so it can be framed. */
export async function photoSourceFromFile(file: File): Promise<PhotoSource> {
  const kind = await sniff(file).catch(() => "other" as const)
  if (kind !== "heic") {
    try {
      return await decode(file)
    } catch (caught) {
      // Some browsers can open HEIC themselves (Safari); others can't, so convert below as a last try.
      console.warn("Decoding photo failed:", { name: file.name, type: file.type, size: file.size, kind }, caught)
      if (kind === "jpeg" || kind === "png") throw new PhotoReadError("That photo looks damaged. Try a different one.")
    }
  }
  try {
    return await decode(await fromHeic(file))
  } catch (caught) {
    console.error("Converting photo failed:", { name: file.name, type: file.type, size: file.size, kind }, caught)
    throw new PhotoReadError(kind === "heic"
      ? "We couldn't convert that iPhone (HEIC) photo. Try another, or take one with the camera button."
      : "We couldn't read that photo. Try a JPG or PNG.")
  }
}

/** The current frame of a live camera preview, ready to frame. */
export function photoSourceFromVideo(video: HTMLVideoElement, mirror: boolean): PhotoSource {
  return toSource(video, video.videoWidth, video.videoHeight, mirror)
}

/** Keeps a frame's zoom in range and its square inside the photo. */
export function clampFrame(source: PhotoSource, frame: PhotoFrame): PhotoFrame {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, frame.zoom))
  const side = Math.min(source.width, source.height) / zoom
  const halfX = side / 2 / source.width
  const halfY = side / 2 / source.height
  return {
    zoom,
    x: Math.min(1 - halfX, Math.max(halfX, frame.x)),
    y: Math.min(1 - halfY, Math.max(halfY, frame.y)),
  }
}

/** The square of the photo a frame shows, in photo pixels. */
export function frameRect(source: PhotoSource, frame: PhotoFrame): { sx: number; sy: number; side: number } {
  const { zoom, x, y } = clampFrame(source, frame)
  const side = Math.min(source.width, source.height) / zoom
  return { sx: x * source.width - side / 2, sy: y * source.height - side / 2, side }
}

/** Draws a frame of the photo onto a canvas of any size. */
export function drawFrame(canvas: HTMLCanvasElement, source: PhotoSource, frame: PhotoFrame): void {
  const context = canvas.getContext("2d")
  if (!context) return
  const { sx, sy, side } = frameRect(source, frame)
  context.imageSmoothingQuality = "high"
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(source.canvas, sx, sy, side, side, 0, 0, canvas.width, canvas.height)
}

/** The framed square as the small JPEG data URL that gets saved. */
export function photoFromFrame(source: PhotoSource, frame: PhotoFrame): string {
  const canvas = document.createElement("canvas")
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  drawFrame(canvas, source, frame)
  return canvas.toDataURL("image/jpeg", 0.82)
}

export function canUseLiveCamera(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia)
}

/** Whether a save failed because the database doesn't have the photo column yet. */
function missingPhotoColumn(error: unknown): boolean {
  const text = error && typeof error === "object" ? `${(error as { message?: string }).message ?? ""} ${(error as { code?: string }).code ?? ""}` : String(error)
  return /photo_url/.test(text) || /PGRST204/.test(text)
}

/** A photo save failure whose message is safe to show as is. */
export class PhotoSaveError extends Error {}

export const PHOTO_SAVE_FAILED = "We couldn't save that photo. Please try again."
export const PHOTO_NEEDS_UPDATE = "Photos need a quick database update before they can be saved."

/** Saves (or with null, removes) a profile photo, with a friendly message when it fails. */
export async function saveProfilePhoto(profileId: string, photo: string | null): Promise<void> {
  try {
    await db.family_profile.update(profileId, { photo_url: photo })
  } catch (error) {
    console.error("Saving profile photo failed:", error)
    throw new PhotoSaveError(missingPhotoColumn(error) ? PHOTO_NEEDS_UPDATE : PHOTO_SAVE_FAILED)
  }
}
