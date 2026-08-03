import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { EsignField } from './esign-types'

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1]! : dataUrl
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** Render a typed name as an italic “signature” image (looks better than plain Helvetica in the PDF). */
export async function renderTypedSignatureDataUrl(name: string): Promise<string | null> {
  if (typeof document === 'undefined' || !name.trim()) return null
  const text = name.trim()
  const canvas = document.createElement('canvas')
  canvas.width = 700
  canvas.height = 140
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#0f172a'
  ctx.font = 'italic 64px "Times New Roman", Times, Georgia, serif'
  // Bottom-align text in the image so it sits on the signature line when the box is bottom-aligned
  ctx.textBaseline = 'alphabetic'
  const metrics = ctx.measureText(text)
  const x = Math.max(16, (canvas.width - metrics.width) / 2)
  const baseline = canvas.height - 18
  ctx.fillText(text, x, baseline)
  return canvas.toDataURL('image/png')
}

/**
 * Trim transparent / near-white padding from a signature image, keeping ink bottom-heavy
 * so placement on the line stays accurate.
 */
export async function normalizeSignatureDataUrl(dataUrl: string): Promise<string> {
  if (typeof document === 'undefined') return dataUrl
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.max(1, img.naturalWidth || img.width)
      const h = Math.max(1, img.naturalHeight || img.height)
      const src = document.createElement('canvas')
      src.width = w
      src.height = h
      const sctx = src.getContext('2d')
      if (!sctx) {
        resolve(dataUrl)
        return
      }
      sctx.drawImage(img, 0, 0)
      const { data } = sctx.getImageData(0, 0, w, h)

      let minX = w
      let minY = h
      let maxX = 0
      let maxY = 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const a = data[i + 3]!
          // Treat near-white / transparent as empty
          const ink = a > 20 && (r < 245 || g < 245 || b < 245)
          if (!ink) continue
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }

      if (maxX <= minX || maxY <= minY) {
        // fallback: opaque white composite
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(dataUrl)
          return
        }
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0)
        resolve(canvas.toDataURL('image/png'))
        return
      }

      const pad = 4
      const tw = maxX - minX + 1 + pad * 2
      const th = maxY - minY + 1 + pad * 2
      const canvas = document.createElement('canvas')
      canvas.width = tw
      canvas.height = th
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, tw, th)
      ctx.drawImage(src, minX, minY, maxX - minX + 1, maxY - minY + 1, pad, pad, maxX - minX + 1, maxY - minY + 1)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

export interface StampSignerInput {
  fields: EsignField[]
  signatureImageDataUrl?: string | null
  signatureText?: string | null
  printedName: string
  signedAt?: Date
}

/**
 * Overlay signature / name / date fields onto a PDF using percentage coordinates.
 * Origin for placement UI is top-left; PDF points use bottom-left.
 */
export async function stampEsignFieldsOnPdf(
  pdfBytes: ArrayBuffer | Uint8Array,
  input: StampSignerInput,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(pdfBytes)
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const italic = await pdf.embedFont(StandardFonts.TimesRomanItalic)
  const pages = pdf.getPages()
  const signedAt = input.signedAt ?? new Date()
  const dateLabel = signedAt.toLocaleDateString()
  const printedName = input.printedName.trim() || input.signatureText?.trim() || 'Signed'

  let signatureImage = null as Awaited<ReturnType<PDFDocument['embedPng']>> | null

  let imageDataUrl = input.signatureImageDataUrl?.trim() || null
  if (!imageDataUrl && input.signatureText?.trim()) {
    imageDataUrl = await renderTypedSignatureDataUrl(input.signatureText.trim())
  } else if (imageDataUrl) {
    imageDataUrl = await normalizeSignatureDataUrl(imageDataUrl)
  } else if (printedName) {
    imageDataUrl = await renderTypedSignatureDataUrl(printedName)
  }

  if (imageDataUrl) {
    try {
      const bytes = dataUrlToBytes(imageDataUrl)
      if (imageDataUrl.includes('image/jpeg') || imageDataUrl.includes('image/jpg')) {
        signatureImage = await pdf.embedJpg(bytes)
      } else {
        signatureImage = await pdf.embedPng(bytes)
      }
    } catch {
      signatureImage = null
    }
  }

  for (const field of input.fields) {
    const page = pages[field.page_index] ?? pages[pages.length - 1]
    if (!page) continue
    const { width, height } = page.getSize()
    const boxW = (field.width_pct / 100) * width
    const boxH = (field.height_pct / 100) * height
    const x = (field.x_pct / 100) * width
    const yTop = (field.y_pct / 100) * height
    // PDF y origin is bottom-left; `y` is the bottom edge of the placed box.
    const y = height - yTop - boxH
    // Sit content on the bottom of the box (matches signature lines when boxes are aligned there).
    const bottomPad = Math.min(3, boxH * 0.08)

    if (field.field_type === 'signature') {
      if (signatureImage) {
        const scale = Math.min(boxW / signatureImage.width, boxH / signatureImage.height) * 0.95
        const dims = {
          width: signatureImage.width * scale,
          height: signatureImage.height * scale,
        }
        page.drawImage(signatureImage, {
          x: x + Math.max(0, (boxW - dims.width) / 2),
          // Bottom-align inside the field box
          y: y + bottomPad,
          width: dims.width,
          height: dims.height,
        })
      } else {
        const text = (input.signatureText || printedName).trim() || 'Signed'
        const size = Math.min(22, Math.max(14, boxH * 0.55))
        page.drawText(text, {
          x: x + 4,
          // pdf-lib y is the text baseline — keep it near the box bottom
          y: y + bottomPad,
          size,
          font: italic,
          color: rgb(0.05, 0.1, 0.25),
        })
      }
    } else if (field.field_type === 'name') {
      const text = printedName || '—'
      const size = Math.min(12, Math.max(9, boxH * 0.5))
      page.drawText(text, {
        x: x + 2,
        y: y + bottomPad,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
    } else if (field.field_type === 'date') {
      const size = Math.min(11, Math.max(9, boxH * 0.5))
      page.drawText(dateLabel, {
        x: x + 2,
        y: y + bottomPad,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
    }
  }

  return pdf.save()
}
