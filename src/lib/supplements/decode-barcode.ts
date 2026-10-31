import { normalizeProductBarcode } from './barcode'
import { detectBarcodeInBitmap } from './barcode-detector'

function luminanceFromRgba(rgba: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = (rgba[p]! * 0.299 + rgba[p + 1]! * 0.587 + rgba[p + 2]! * 0.114) | 0
  }
  return out
}

function cropLuminance(
  src: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(cropWidth * cropHeight)
  for (let row = 0; row < cropHeight; row++) {
    const start = (y + row) * width + x
    out.set(src.subarray(start, start + cropWidth), row * cropWidth)
  }
  return out
}

async function readLuminance(luminances: Uint8ClampedArray, width: number, height: number): Promise<string | null> {
  const zxing = await import('@zxing/library')
  const hints = new Map()
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.UPC_A,
    zxing.BarcodeFormat.UPC_E,
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
  ])
  hints.set(zxing.DecodeHintType.TRY_HARDER, true)
  try {
    const source = new zxing.RGBLuminanceSource(luminances, width, height)
    const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source))
    const reader = new zxing.MultiFormatReader()
    reader.setHints(hints)
    return normalizeProductBarcode(reader.decode(bitmap).getText())
  } catch {
    return null
  }
}

async function readLuminanceEitherWay(
  luminances: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string | null> {
  const direct = await readLuminance(luminances, width, height)
  if (direct) return direct
  const inverted = new Uint8ClampedArray(luminances.length)
  for (let i = 0; i < luminances.length; i++) inverted[i] = 255 - luminances[i]!
  return readLuminance(inverted, width, height)
}

/** Decode a UPC/EAN from RGBA pixels. Returns null when the image has no readable product barcode. */
export async function decodeBarcodeFromRgba(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<string | null> {
  if (width < 8 || height < 8 || rgba.length < width * height * 4) return null
  const luminances = luminanceFromRgba(rgba, width, height)
  const full = await readLuminanceEitherWay(luminances, width, height)
  if (full) return full
  const cropWidth = Math.max(8, Math.round(width * 0.7))
  const cropHeight = Math.max(8, Math.round(height * 0.45))
  const x = Math.max(0, Math.floor((width - cropWidth) / 2))
  const y = Math.max(0, Math.floor((height - cropHeight) / 2))
  return readLuminanceEitherWay(cropLuminance(luminances, width, x, y, cropWidth, cropHeight), cropWidth, cropHeight)
}

/** Read a product barcode from a still photo. Uses the platform detector when it exists, then ZXing. */
export async function decodeBarcodeFromFile(file: Blob): Promise<string | null> {
  const bitmap = await createImageBitmap(file)
  try {
    const native = await detectBarcodeInBitmap(bitmap)
    if (native) return native
    const maxEdge = 1600
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(bitmap, 0, 0, width, height)
    const image = ctx.getImageData(0, 0, width, height)
    return decodeBarcodeFromRgba(image.data, width, height)
  } finally {
    bitmap.close()
  }
}
