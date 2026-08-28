import {
  FEED_IMAGE_DISPLAY_MAX_BYTES,
  FEED_IMAGE_MAX_BYTES,
  FEED_IMAGE_THUMB_MAX_BYTES,
  FEED_VIDEO_MAX_BYTES,
  FEED_VIDEO_MAX_MS,
  FEED_VIDEO_MAX_SECONDS,
  FEED_VIDEO_POSTER_MAX_BYTES,
  mediaTypeFromFile,
  readVideoDurationMs,
  type FeedMediaType,
} from '@/lib/social/feed'
import {
  fileToJpegUnderMax,
  videoFileToPosterJpeg,
} from '@/lib/social/image-compress'

export type PreparedFeedMedia = {
  /** Compressed display / full file (loaded only on tap or play). */
  file: File
  /** Feed timeline thumbnail — images only. */
  thumbFile?: File
  /** Still frame — videos only; shown until play. */
  posterFile?: File
  type: FeedMediaType
  durationMs?: number
  compressed: boolean
}

const IMAGE_DISPLAY_MAX_EDGE = 1280
const IMAGE_THUMB_MAX_EDGE = 640
const VIDEO_MAX_EDGE = 960
const VIDEO_POSTER_MAX_EDGE = 640

/** Re-export for callers that only need the type helper after compress. */
export { mediaTypeFromFile }

function baseName(file: File) {
  return file.name.replace(/\.[^.]+$/, '') || 'media'
}

function pickRecorderMime(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4',
  ]
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) return mime
  }
  return ''
}

function extensionForMime(mime: string) {
  if (mime.includes('mp4')) return 'mp4'
  return 'webm'
}

function waitForEvent<T extends EventTarget>(
  target: T,
  event: string,
  timeoutMs = 30_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => {
      cleanup()
      reject(new Error('Timed out reading media.'))
    }, timeoutMs)
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error('Couldn’t read that video.'))
    }
    const cleanup = () => {
      window.clearTimeout(t)
      target.removeEventListener(event, onOk)
      target.removeEventListener('error', onErr)
    }
    target.addEventListener(event, onOk, { once: true })
    target.addEventListener('error', onErr, { once: true })
  })
}

async function compressFeedVideo(
  file: File,
  maxBytes: number,
  durationMs: number,
): Promise<{ file: File; compressed: boolean }> {
  if (typeof MediaRecorder === 'undefined') {
    if (file.size <= maxBytes) return { file, compressed: false }
    throw new Error(
      `Videos must be under ${Math.round(maxBytes / (1024 * 1024))} MB (yours is larger, and this browser can’t compress).`,
    )
  }

  const mime = pickRecorderMime()
  if (!mime) {
    if (file.size <= maxBytes) return { file, compressed: false }
    throw new Error(
      `Videos must be under ${Math.round(maxBytes / (1024 * 1024))} MB. Try a shorter clip or a different browser.`,
    )
  }

  const durationSec = Math.max(0.5, durationMs / 1000)
  const bitrates = [
    Math.floor((maxBytes * 8 * 0.75) / durationSec),
    Math.floor((maxBytes * 8 * 0.5) / durationSec),
    Math.floor((maxBytes * 8 * 0.32) / durationSec),
  ].map((b) => Math.min(Math.max(b, 200_000), 2_500_000))

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  video.src = url

  try {
    await waitForEvent(video, 'loadeddata')
    if (video.currentTime !== 0) {
      video.currentTime = 0
      await waitForEvent(video, 'seeked', 10_000).catch(() => undefined)
    }

    const vw = video.videoWidth || 1280
    const vh = video.videoHeight || 720
    const scale = Math.min(1, VIDEO_MAX_EDGE / Math.max(vw, vh, 1))
    const outW = Math.max(2, Math.round((vw * scale) / 2) * 2)
    const outH = Math.max(2, Math.round((vh * scale) / 2) * 2)

    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')

    for (const videoBitsPerSecond of bitrates) {
      const chunks: Blob[] = []
      const canvasStream = canvas.captureStream(24)
      const tracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()]

      const nativeCapture =
        (
          video as HTMLVideoElement & {
            captureStream?: () => MediaStream
            mozCaptureStream?: () => MediaStream
          }
        ).captureStream?.() ||
        (
          video as HTMLVideoElement & { mozCaptureStream?: () => MediaStream }
        ).mozCaptureStream?.()
      if (nativeCapture) {
        for (const track of nativeCapture.getAudioTracks()) tracks.push(track)
      }

      const stream = new MediaStream(tracks)
      const recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond,
      })

      const recorded = new Promise<Blob>((resolve, reject) => {
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data)
        }
        recorder.onerror = () => reject(new Error('Couldn’t compress that video.'))
        recorder.onstop = () => resolve(new Blob(chunks, { type: mime.split(';')[0] }))
      })

      let raf = 0
      const draw = () => {
        if (video.ended || video.paused) return
        ctx.drawImage(video, 0, 0, outW, outH)
        raf = requestAnimationFrame(draw)
      }

      recorder.start(200)
      video.currentTime = 0
      await video.play().catch(() => undefined)
      draw()

      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video.addEventListener('ended', done, { once: true })
        window.setTimeout(done, durationMs + 1500)
      })

      video.pause()
      cancelAnimationFrame(raf)
      ctx.drawImage(video, 0, 0, outW, outH)
      if (recorder.state !== 'inactive') recorder.stop()

      for (const track of stream.getTracks()) track.stop()
      if (nativeCapture) {
        for (const track of nativeCapture.getTracks()) track.stop()
      }

      const blob = await recorded
      const out = new File([blob], `${baseName(file)}.${extensionForMime(mime)}`, {
        type: blob.type || mime.split(';')[0],
        lastModified: Date.now(),
      })
      if (out.size <= maxBytes) {
        return { file: out, compressed: out.size < file.size || out.type !== file.type }
      }

      video.currentTime = 0
      await waitForEvent(video, 'seeked', 10_000).catch(() => undefined)
    }

    if (file.size <= maxBytes) return { file, compressed: false }
    throw new Error(
      `Couldn’t compress that video under ${Math.round(maxBytes / (1024 * 1024))} MB. Try a shorter or lower-resolution clip.`,
    )
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }
}

/**
 * Compress photos/videos for upload. Always produces a small timeline thumb/poster
 * so the feed never pulls full originals unless the user asks.
 */
export async function prepareFeedMedia(file: File): Promise<PreparedFeedMedia> {
  const type = mediaTypeFromFile(file)
  const name = baseName(file)

  if (type === 'image') {
    const display = await fileToJpegUnderMax(
      file,
      name,
      IMAGE_DISPLAY_MAX_EDGE,
      FEED_IMAGE_DISPLAY_MAX_BYTES,
    )
    const thumb = await fileToJpegUnderMax(
      file,
      `${name}_thumb`,
      IMAGE_THUMB_MAX_EDGE,
      FEED_IMAGE_THUMB_MAX_BYTES,
    )
    if (display.size > FEED_IMAGE_MAX_BYTES) {
      throw new Error('Couldn’t compress that photo enough. Try a smaller image.')
    }
    const compressed = display.size < file.size || thumb.size < file.size
    return { file: display, thumbFile: thumb, type, compressed }
  }

  const durationMs = await readVideoDurationMs(file)
  if (durationMs > FEED_VIDEO_MAX_MS + 250) {
    const secs = Math.ceil(durationMs / 1000)
    throw new Error(
      `Videos must be ${FEED_VIDEO_MAX_SECONDS} seconds or shorter (yours is ~${secs}s).`,
    )
  }

  const { file: out, compressed } = await compressFeedVideo(file, FEED_VIDEO_MAX_BYTES, durationMs)
  if (out.size > FEED_VIDEO_MAX_BYTES) {
    throw new Error(
      `Couldn’t compress that video under ${Math.round(FEED_VIDEO_MAX_BYTES / (1024 * 1024))} MB.`,
    )
  }

  const posterFile = await videoFileToPosterJpeg(
    out,
    name,
    VIDEO_POSTER_MAX_EDGE,
    FEED_VIDEO_POSTER_MAX_BYTES,
  )

  let outDuration = durationMs
  try {
    outDuration = await readVideoDurationMs(out)
  } catch {
    // keep original
  }

  return { file: out, posterFile, type, durationMs: outDuration, compressed }
}
