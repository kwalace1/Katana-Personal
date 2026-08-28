/** Browser-side image resize/encode — keeps Storage egress low. */

export async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file)
  } catch {
    throw new Error('Couldn’t read that photo. Try a JPEG or PNG.')
  }
}

export async function bitmapToJpegFile(
  bitmap: ImageBitmap,
  name: string,
  maxEdge: number,
  maxBytes: number,
  qualities = [0.78, 0.68, 0.58, 0.48],
): Promise<File> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height, 1))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(bitmap, 0, 0, w, h)

  let best: File | null = null
  for (const quality of qualities) {
    const out = await canvasToJpeg(canvas, name, quality)
    if (!best || out.size < best.size) best = out
    if (out.size <= maxBytes) return out
  }
  if (best) return best
  throw new Error('Couldn’t compress that photo.')
}

export async function canvasToJpeg(
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
  const base = name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
}

export async function fileToJpegUnderMax(
  file: File,
  name: string,
  maxEdge: number,
  maxBytes: number,
): Promise<File> {
  const bitmap = await loadImageBitmap(file)
  try {
    return await bitmapToJpegFile(bitmap, name, maxEdge, maxBytes)
  } finally {
    bitmap.close()
  }
}

/** Square crop + resize for avatars. */
export async function fileToAvatarJpeg(file: File, maxEdge: number, maxBytes: number): Promise<File> {
  const bitmap = await loadImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = Math.floor((bitmap.width - side) / 2)
    const sy = Math.floor((bitmap.height - side) / 2)
    const outSize = Math.min(maxEdge, side)
    const canvas = document.createElement('canvas')
    canvas.width = outSize
    canvas.height = outSize
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, outSize, outSize)
    return await canvasToJpeg(canvas, 'avatar', 0.82)
  } finally {
    bitmap.close()
  }
}

/** First frame of a video file → small JPEG poster. */
export async function videoFileToPosterJpeg(
  file: File,
  name: string,
  maxEdge: number,
  maxBytes: number,
): Promise<File> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'
  video.src = url

  try {
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Timed out reading video.')), 20_000)
      video.onloadeddata = () => {
        window.clearTimeout(t)
        resolve()
      }
      video.onerror = () => {
        window.clearTimeout(t)
        reject(new Error('Couldn’t read that video.'))
      }
    })
    video.currentTime = 0
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      window.setTimeout(resolve, 500)
    })

    const vw = video.videoWidth || 640
    const vh = video.videoHeight || 360
    const scale = Math.min(1, maxEdge / Math.max(vw, vh, 1))
    const w = Math.max(1, Math.round(vw * scale))
    const h = Math.max(1, Math.round(vh * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas unavailable')
    ctx.drawImage(video, 0, 0, w, h)
    return await bitmapToJpegFile(
      await createImageBitmap(canvas),
      `${name}_poster`,
      maxEdge,
      maxBytes,
      [0.72, 0.62, 0.52],
    )
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }
}
