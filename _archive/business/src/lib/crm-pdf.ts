/**
 * Generate PDF documents for CRM quotes, invoices, and contracts (client-side via pdf-lib)
 */

import { PDFDocument, StandardFonts, rgb, type PDFImage } from 'pdf-lib'
import type { Client } from './customer-success-api'
import type { CrmContract, CrmInvoice, CrmQuote, LineItem } from './customer-crm-api'
import type {
  CommerceBranding,
  CommerceContractTemplateSettings,
  CommerceInvoiceTemplateSettings,
  CommerceQuoteTemplateSettings,
  CrmCommerceTemplate,
} from './crm-commerce-templates'
import { CONTRACT_LEGAL_DISCLAIMER } from './crm-commerce-templates'

function formatMoney(n: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n)
  } catch {
    return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '')
  const full = cleaned.length === 3 ? cleaned.split('').map((c) => c + c).join('') : cleaned
  const num = parseInt(full, 16)
  if (Number.isNaN(num)) return { r: 0.12, g: 0.23, b: 0.37 }
  return { r: ((num >> 16) & 255) / 255, g: ((num >> 8) & 255) / 255, b: (num & 255) / 255 }
}

function wrapText(text: string, maxLen: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length > maxLen) {
      if (line) lines.push(line)
      line = word
    } else {
      line = next
    }
  }
  if (line) lines.push(line)
  return lines
}

interface PdfContext {
  page: ReturnType<PDFDocument['addPage']>
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
  y: number
  primary: { r: number; g: number; b: number }
}

function createPdfContext(pdf: PDFDocument, page: ReturnType<PDFDocument['addPage']>, fonts: {
  font: Awaited<ReturnType<PDFDocument['embedFont']>>
  fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>
}, branding?: CommerceBranding): PdfContext {
  const primary = hexToRgb(branding?.primary_color ?? '#1e3a5f')
  return { page, font: fonts.font, fontBold: fonts.fontBold, y: page.getSize().height - 56, primary }
}

function drawText(ctx: PdfContext, text: string, x: number, size: number, bold = false, color?: { r: number; g: number; b: number }) {
  ctx.page.drawText(text, {
    x,
    y: ctx.y,
    size,
    font: bold ? ctx.fontBold : ctx.font,
    color: rgb(color?.r ?? 0.1, color?.g ?? 0.1, color?.b ?? 0.1),
  })
  ctx.y -= size + 6
}

function drawWrapped(ctx: PdfContext, text: string, x: number, size: number, maxWidthChars: number, bold = false) {
  for (const line of wrapText(text, maxWidthChars)) {
    drawText(ctx, line, x, size, bold)
  }
}

async function embedLogoImage(pdf: PDFDocument, logoUrl: string): Promise<PDFImage | null> {
  try {
    const response = await fetch(logoUrl)
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const contentType = response.headers.get('content-type') ?? ''
    const lowerUrl = logoUrl.toLowerCase()
    if (contentType.includes('png') || lowerUrl.endsWith('.png')) {
      return pdf.embedPng(bytes)
    }
    if (
      contentType.includes('jpeg') ||
      contentType.includes('jpg') ||
      lowerUrl.endsWith('.jpg') ||
      lowerUrl.endsWith('.jpeg')
    ) {
      return pdf.embedJpg(bytes)
    }
    try {
      return await pdf.embedPng(bytes)
    } catch {
      return await pdf.embedJpg(bytes)
    }
  } catch {
    return null
  }
}

async function drawLogoOnPage(
  pdf: PDFDocument,
  page: ReturnType<PDFDocument['addPage']>,
  logoUrl: string | undefined,
  yTop: number,
): Promise<void> {
  if (!logoUrl?.trim()) return
  const image = await embedLogoImage(pdf, logoUrl)
  if (!image) return

  const maxW = 96
  const maxH = 52
  const scale = Math.min(maxW / image.width, maxH / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale

  page.drawImage(image, {
    x: page.getSize().width - width - 50,
    y: yTop - height,
    width,
    height,
  })
}

async function buildCommercePdf(options: {
  docType: 'Quote' | 'Invoice'
  docNumber: string
  client: Client | null
  lineItems: LineItem[]
  subtotal: number
  tax: number
  total: number
  dateLabel: string
  dateValue: string | null
  notes?: string
  template?: CrmCommerceTemplate | null
  documentSettings?: Record<string, string | undefined>
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const settings = options.template?.settings as CommerceQuoteTemplateSettings | CommerceInvoiceTemplateSettings | undefined
  const branding = settings?.branding
  const ctx = createPdfContext(pdf, page, { font, fontBold }, branding)

  await drawLogoOnPage(pdf, page, branding?.logo_url, ctx.y + 8)

  const companyName = branding?.company_name || 'Your Company'
  drawText(ctx, companyName, 50, 12, true, ctx.primary)
  if (branding?.company_address) drawText(ctx, branding.company_address, 50, 9)
  if (branding?.company_email) drawText(ctx, branding.company_email, 50, 9)
  if (branding?.company_phone) drawText(ctx, branding.company_phone, 50, 9)
  ctx.y -= 8

  const headerTitle = options.documentSettings?.header_title || settings?.header_title || options.docType
  drawText(ctx, headerTitle.toUpperCase(), 50, 20, true, ctx.primary)
  drawText(ctx, options.docNumber, 50, 11)
  ctx.y -= 6

  const intro = options.documentSettings?.intro_text || settings?.intro_text
  if (intro) {
    drawWrapped(ctx, intro, 50, 10, 80)
    ctx.y -= 6
  }

  if (options.client) {
    drawText(ctx, 'Bill to', 50, 10, true)
    drawText(ctx, options.client.name, 50, 11)
    if (options.client.email) drawText(ctx, options.client.email, 50, 10)
    if (options.client.phone) drawText(ctx, options.client.phone, 50, 10)
    ctx.y -= 8
  }

  if (options.dateValue) {
    drawText(ctx, `${options.dateLabel}: ${options.dateValue}`, 50, 10)
    ctx.y -= 10
  }

  drawText(ctx, 'Description', 50, 10, true)
  ctx.page.drawText('Amount', { x: 480, y: ctx.y + 16, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) })
  ctx.y -= 4

  const items =
    options.lineItems.length > 0
      ? options.lineItems
      : [{ description: 'Item', quantity: 1, unit_price: options.subtotal, total: options.subtotal }]

  for (const item of items) {
    const line = `${item.description} × ${item.quantity}`
    ctx.page.drawText(line.slice(0, 60), { x: 50, y: ctx.y, size: 10, font })
    ctx.page.drawText(formatMoney(item.quantity * item.unit_price), { x: 480, y: ctx.y, size: 10, font })
    ctx.y -= 18
  }

  ctx.y -= 12
  const taxLabel = settings && 'tax_label' in settings ? settings.tax_label : 'Tax'
  drawText(ctx, `Subtotal: ${formatMoney(options.subtotal)}`, 380, 10)
  drawText(ctx, `${taxLabel}: ${formatMoney(options.tax)}`, 380, 10)
  drawText(ctx, `Total: ${formatMoney(options.total)}`, 380, 12, true)

  const extraText =
    options.docType === 'Invoice'
      ? options.documentSettings?.payment_instructions ||
        (settings && 'payment_instructions' in settings ? settings.payment_instructions : '')
      : options.documentSettings?.terms_text ||
        (settings && 'terms_text' in settings ? settings.terms_text : '')

  if (extraText?.trim()) {
    ctx.y -= 14
    drawText(ctx, options.docType === 'Invoice' ? 'Payment instructions' : 'Terms', 50, 10, true)
    drawWrapped(ctx, extraText, 50, 9, 90)
  }

  const notes = options.notes?.trim()
  if (notes) {
    ctx.y -= 10
    drawText(ctx, 'Notes', 50, 10, true)
    drawWrapped(ctx, notes, 50, 9, 90)
  }

  const footer = options.documentSettings?.footer_text || settings?.footer_text
  if (footer?.trim()) {
    ctx.y -= 10
    drawWrapped(ctx, footer, 50, 8, 90)
  }

  return pdf.save()
}

export async function downloadQuotePdf(
  quote: CrmQuote,
  client: Client | null,
  template?: CrmCommerceTemplate | null,
): Promise<void> {
  const bytes = await buildCommercePdf({
    docType: 'Quote',
    docNumber: quote.quote_number,
    client,
    lineItems: quote.line_items,
    subtotal: quote.subtotal,
    tax: quote.tax,
    total: quote.total,
    dateLabel: 'Valid until',
    dateValue: quote.valid_until,
    notes: quote.notes,
    template: template ?? null,
    documentSettings: quote.document_settings as Record<string, string | undefined>,
  })
  triggerDownload(bytes, `${quote.quote_number}.pdf`)
}

export async function downloadInvoicePdf(
  invoice: CrmInvoice,
  client: Client | null,
  template?: CrmCommerceTemplate | null,
): Promise<void> {
  const bytes = await buildCommercePdf({
    docType: 'Invoice',
    docNumber: invoice.invoice_number,
    client,
    lineItems: invoice.line_items,
    subtotal: invoice.subtotal,
    tax: invoice.tax,
    total: invoice.total,
    dateLabel: 'Due date',
    dateValue: invoice.due_date,
    notes: invoice.notes,
    template: template ?? null,
    documentSettings: invoice.document_settings as Record<string, string | undefined>,
  })
  triggerDownload(bytes, `${invoice.invoice_number}.pdf`)
}

export async function downloadContractPdf(
  contract: CrmContract,
  client: Client | null,
  template?: CrmCommerceTemplate | null,
): Promise<void> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([612, 792])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const settings = template?.settings as CommerceContractTemplateSettings | undefined
  const branding = settings?.branding
  const ctx = createPdfContext(pdf, page, { font, fontBold }, branding)

  await drawLogoOnPage(pdf, page, branding?.logo_url, ctx.y + 8)

  const companyName = branding?.company_name || 'Your Company'
  drawText(ctx, companyName, 50, 12, true, ctx.primary)
  ctx.y -= 4
  drawText(ctx, contract.title, 50, 18, true, ctx.primary)
  ctx.y -= 8

  if (client) {
    drawText(ctx, `Client: ${client.name}`, 50, 11)
    ctx.y -= 4
  }
  if (contract.start_date || contract.end_date) {
    drawText(
      ctx,
      `Term: ${contract.start_date ?? '—'} to ${contract.end_date ?? '—'}`,
      50,
      10,
    )
    ctx.y -= 4
  }
  if (contract.value > 0) {
    drawText(ctx, `Contract value: ${formatMoney(contract.value)}`, 50, 10)
    ctx.y -= 8
  }

  const body = contract.terms?.trim() || 'No terms specified.'
  drawWrapped(ctx, body, 50, 10, 85)
  ctx.y -= 12

  drawWrapped(ctx, CONTRACT_LEGAL_DISCLAIMER, 50, 7, 95)

  const footer = contract.document_settings?.footer_text || settings?.footer_text
  if (footer?.trim()) {
    ctx.y -= 10
    drawWrapped(ctx, footer, 50, 8, 90)
  }

  const bytes = await pdf.save()
  triggerDownload(bytes, `${contract.title.replace(/\s+/g, '-').slice(0, 40)}.pdf`)
}

function triggerDownload(bytes: Uint8Array, filename: string): void {
  const copy = new Uint8Array(bytes)
  const blob = new Blob([copy], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
