import { normalizeProductBarcode } from './barcode'

type DetectorResult = { rawValue?: string }

type Detector = {
  detect: (source: ImageBitmap | HTMLVideoElement) => Promise<DetectorResult[]>
}

type DetectorCtor = new (options?: { formats?: string[] }) => Detector

const FORMATS = ['upc_a', 'upc_e', 'ean_13', 'ean_8']

export function barcodeDetectorCtor(): DetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  return ctor ?? null
}

/** Live scanning where the browser provides a barcode detector. iOS Safari does not. */
export function liveBarcodeDetector(): Detector | null {
  const Ctor = barcodeDetectorCtor()
  if (!Ctor) return null
  try {
    return new Ctor({ formats: FORMATS })
  } catch {
    return null
  }
}

export async function detectBarcodeInBitmap(bitmap: ImageBitmap): Promise<string | null> {
  const Ctor = barcodeDetectorCtor()
  if (!Ctor) return null
  try {
    const detector = new Ctor({ formats: FORMATS })
    const codes = await detector.detect(bitmap)
    for (const code of codes) {
      const normalized = normalizeProductBarcode(code.rawValue || '')
      if (normalized) return normalized
    }
  } catch {
    return null
  }
  return null
}
