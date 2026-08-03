import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const DOCX_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
])

export function isEsignConvertibleUpload(file: File): boolean {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return true
  if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp)$/i.test(name)) return true
  if (DOCX_TYPES.has(file.type) || /\.(docx|doc)$/i.test(name)) return true
  return false
}

async function fileToImageBytes(file: File): Promise<{ bytes: Uint8Array; kind: 'png' | 'jpg' }> {
  if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
    return { bytes: new Uint8Array(await file.arrayBuffer()), kind: 'png' }
  }
  // Normalize jpeg/webp → jpeg via canvas for pdf-lib
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not process image')
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image encode failed'))), 'image/jpeg', 0.92)
  })
  return { bytes: new Uint8Array(await blob.arrayBuffer()), kind: 'jpg' }
}

async function imageFileToPdf(file: File): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const { bytes, kind } = await fileToImageBytes(file)
  const image = kind === 'png' ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes)
  const page = pdf.addPage([image.width, image.height])
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  return pdf.save()
}

async function docxFileToPdf(file: File): Promise<Uint8Array> {
  const mammoth = await import('mammoth')
  const buf = await file.arrayBuffer()
  const result = await mammoth.extractRawText({ arrayBuffer: buf })
  const text = (result.value || '').trim() || '(Empty document)'

  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const margin = 48
  const fontSize = 11
  const lineHeight = 16
  const pageWidth = 612
  const pageHeight = 792
  const maxWidth = pageWidth - margin * 2

  const words = text.replace(/\r/g, '').split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)

  // Preserve blank lines from original paragraphs roughly
  const paragraphs = text.split(/\n+/)
  if (paragraphs.length > 1 && lines.length < 3) {
    lines.length = 0
    for (const para of paragraphs) {
      const p = para.trim()
      if (!p) {
        lines.push('')
        continue
      }
      let cur = ''
      for (const word of p.split(/\s+/)) {
        const candidate = cur ? `${cur} ${word}` : word
        if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) cur = candidate
        else {
          if (cur) lines.push(cur)
          cur = word
        }
      }
      if (cur) lines.push(cur)
      lines.push('')
    }
  }

  let page = pdf.addPage([pageWidth, pageHeight])
  let y = pageHeight - margin
  for (const line of lines) {
    if (y < margin + lineHeight) {
      page = pdf.addPage([pageWidth, pageHeight])
      y = pageHeight - margin
    }
    if (line) {
      page.drawText(line, {
        x: margin,
        y,
        size: fontSize,
        font,
        color: rgb(0.1, 0.1, 0.1),
      })
    }
    y -= lineHeight
  }

  return pdf.save()
}

/**
 * Normalize uploads to a PDF File for placement + signing.
 * PDF passes through; images and DOCX/DOC are converted client-side.
 */
export async function normalizeEsignUploadToPdf(file: File): Promise<File> {
  const name = file.name.toLowerCase()
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) {
    return file
  }

  let bytes: Uint8Array
  if (IMAGE_TYPES.has(file.type) || /\.(png|jpe?g|webp)$/i.test(name)) {
    bytes = await imageFileToPdf(file)
  } else if (DOCX_TYPES.has(file.type) || /\.(docx|doc)$/i.test(name)) {
    if (name.endsWith('.doc') && !name.endsWith('.docx')) {
      throw new Error('Legacy .doc is not supported — save as .docx or PDF and try again')
    }
    bytes = await docxFileToPdf(file)
  } else {
    throw new Error('Unsupported file type. Upload PDF, PNG, JPG, WEBP, or DOCX.')
  }

  const base = file.name.replace(/\.[^.]+$/, '') || 'document'
  return new File([bytes.slice()], `${base}.pdf`, { type: 'application/pdf' })
}
