import {
  FEED_IMAGE_MAX_BYTES,
  FEED_VIDEO_MAX_BYTES,
  FEED_VIDEO_MAX_MS,
  FEED_VIDEO_MAX_SECONDS,
  mediaTypeFromFile,
  readVideoDurationMs,
  type FeedMediaType,
} from '@/lib/social/feed'

export type PreparedFeedMedia = {
  file: File
  type: FeedMediaType
  durationMs?: number
  compressed: boolean
}

const IMAGE_MAX_EDGE = 2048
const IMAGE_EDGE_STEPS = [2048, 1600, 1280, 1024, 800]
const VIDEO_MAX_EDGE = 1280

/** Re-export for callers that only need the type helper after compress. */
export { mediaTypeFromFile }

function baseName(file: File) {
  return file.name.replace(/\.[^.]+$/, '') || 'media'
}

async function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  name: string,
  quality: number,
): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Couldn’t encode photo.'))),
      'image/jpeg',
      quality,
    )
  })
  return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

async function compressFeedImage(file: File, maxBytes: number): Promise<{ file: File; compressed: boolean }> {
  if (file.size <= maxBytes) {
    return { file, compressed: false }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    if (file.size <= maxBytes) return { file, compressed: false }
    throw new Error('Couldn’t read that photo. Try a JPEG or PNG.')
  }

  const name = baseName(file)
  let best: File | null = null

  try {
    for (const maxEdge of IMAGE_EDGE_STEPS) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
      const w = Math.max(1, Math.round(bitmap.width * scale))
      const h = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas unavailable')
      ctx.drawImage(bitmap, 0, 0, w, h)

      for (const quality of [0.85, 0.72, 0.6, 0.48]) {
        const out = await canvasToJpegFile(canvas, name, quality)
        if (!best || out.size < best.size) best = out
        if (out.size <= maxBytes) {
          const compressed = out.size < file.size || out.type !== file.type || out.name !== file.name
          return { file: out, compressed }
        }
      }
    }
  } finally {
    bitmap.close()
  }

  if (best && best.size <= maxBytes) return { file: best, compressed: true }
  if (best && file.size > maxBytes && best.size < file.size) {
    // Still over — but better; caller will reject if still too large
    return { file: best, compressed: true }
  }
  if (file.size <= maxBytes) return { file, compressed: false }
  throw new Error('Couldn’t compress that photo under 5 MB. Try a smaller image.')
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
  if (file.size <= maxBytes) return { file, compressed: false }

  if (typeof MediaRecorder === 'undefined') {
    throw new Error(
      `Videos must be under ${Math.round(maxBytes / (1024 * 1024))} MB (yours is larger, and this browser can’t compress).`,
    )
  }

  const mime = pickRecorderMime()
  if (!mime) {
    throw new Error(
      `Videos must be under ${Math.round(maxBytes / (1024 * 1024))} MB. Try a shorter clip or a different browser.`,
    )
  }

  const durationSec = Math.max(0.5, durationMs / 1000)
  const bitrates = [
    Math.floor((maxBytes * 8 * 0.8) / durationSec),
    Math.floor((maxBytes * 8 * 0.55) / durationSec),
    Math.floor((maxBytes * 8 * 0.35) / durationSec),
  ].map((b) => Math.min(Math.max(b, 250_000), 3_500_000))

  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
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
      const canvasStream = canvas.captureStream(30)
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
      if (out.size <= maxBytes) return { file: out, compressed: true }

      video.currentTime = 0
      await waitForEvent(video, 'seeked', 10_000).catch(() => undefined)
    }

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
 * Accept any reasonable photo/short video, compress to feed limits, then validate.
 * Videos longer than FEED_VIDEO_MAX_SECONDS are still rejected.
 */
export async function prepareFeedMedia(file: File): Promise<PreparedFeedMedia> {
  const type = mediaTypeFromFile(file)

  if (type === 'image') {
    const { file: out, compressed } = await compressFeedImage(file, FEED_IMAGE_MAX_BYTES)
    if (out.size > FEED_IMAGE_MAX_BYTES) {
      throw new Error('Couldn’t compress that photo under 5 MB. Try a smaller image.')
    }
    return { file: out, type, compressed }
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

  // Re-read duration from compressed output when possible; fall back to original
  let outDuration = durationMs
  try {
    outDuration = await readVideoDurationMs(out)
  } catch {
    // keep original
  }

  return { file: out, type, durationMs: outDuration, compressed }
}
