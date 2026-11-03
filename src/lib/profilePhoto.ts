import { db } from "@/lib/db"

/** Photos are cropped to a centered square and saved this many pixels wide (about 15 KB as a JPEG). */
const PHOTO_SIZE = 256

function drawSquare(source: CanvasImageSource, width: number, height: number, mirror = false): string {
  const side = Math.min(width, height)
  const canvas = document.createElement("canvas")
  canvas.width = PHOTO_SIZE
  canvas.height = PHOTO_SIZE
  const context = canvas.getContext("2d")
  if (!context) throw new Error("No canvas")
  if (mirror) {
    // Front cameras preview as a mirror; save what the kid saw.
    context.translate(PHOTO_SIZE, 0)
    context.scale(-1, 1)
  }
  context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE)
  return canvas.toDataURL("image/jpeg", 0.82)
}

/** A picked or captured image file, as a small square JPEG data URL. */
export async function photoFromFile(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    return drawSquare(image, image.naturalWidth, image.naturalHeight)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** The current frame of a live camera preview, as a small square JPEG data URL. */
export function photoFromVideo(video: HTMLVideoElement, mirror: boolean): string {
  return drawSquare(video, video.videoWidth, video.videoHeight, mirror)
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
