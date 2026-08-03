/**
 * Customizable commerce document templates — quotes, invoices, contracts
 */

import type { LineItem } from './customer-crm-api'

export type CommerceDocType = 'quote' | 'invoice' | 'contract'

export interface CommerceBranding {
  company_name: string
  company_address: string
  company_email: string
  company_phone: string
  logo_url: string
  primary_color: string
  accent_color: string
}

export interface CommerceQuoteTemplateSettings {
  branding: CommerceBranding
  header_title: string
  intro_text: string
  footer_text: string
  terms_text: string
  validity_days: number
  tax_rate: number
  tax_label: string
  currency: string
  show_tax: boolean
  default_notes: string
  default_line_items: LineItem[]
}

export interface CommerceInvoiceTemplateSettings {
  branding: CommerceBranding
  header_title: string
  intro_text: string
  footer_text: string
  payment_instructions: string
  tax_rate: number
  tax_label: string
  currency: string
  due_days: number
  show_tax: boolean
  default_notes: string
  default_line_items: LineItem[]
}

export interface ContractSection {
  title: string
  body: string
}

export interface CommerceContractTemplateSettings {
  branding: CommerceBranding
  header_title: string
  preamble: string
  sections: ContractSection[]
  closing_text: string
  footer_text: string
}

export type CommerceTemplateSettings =
  | CommerceQuoteTemplateSettings
  | CommerceInvoiceTemplateSettings
  | CommerceContractTemplateSettings

export interface CrmCommerceTemplate {
  id: string
  organization_id: string
  doc_type: CommerceDocType
  name: string
  is_default: boolean
  settings: CommerceTemplateSettings
  created_at: string
  updated_at: string
}

export interface CommerceDocumentSettings {
  header_title?: string
  intro_text?: string
  footer_text?: string
  payment_instructions?: string
  terms_text?: string
  custom_sections?: ContractSection[]
}

export const CONTRACT_LEGAL_DISCLAIMER =
  'This contract builder is provided for convenience only and does not constitute legal advice. Katana is not a law firm. Templates and generated documents may not be enforceable in your jurisdiction. Consult a qualified attorney before using any contract with your customers.'

export const DEFAULT_BRANDING: CommerceBranding = {
  company_name: 'Your Company',
  company_address: '',
  company_email: '',
  company_phone: '',
  logo_url: '',
  primary_color: '#1e3a5f',
  accent_color: '#2563eb',
}

export const DEFAULT_QUOTE_TEMPLATE: CommerceQuoteTemplateSettings = {
  branding: { ...DEFAULT_BRANDING },
  header_title: 'Quote',
  intro_text: 'Thank you for your interest. Please find our quote below.',
  footer_text: 'This quote is valid for the period indicated above. Prices subject to change after expiration.',
  terms_text: 'Payment terms: Net 30. Work begins upon signed acceptance.',
  validity_days: 30,
  tax_rate: 0,
  tax_label: 'Tax',
  currency: 'USD',
  show_tax: true,
  default_notes: '',
  default_line_items: [{ description: 'Service or product', quantity: 1, unit_price: 0, total: 0 }],
}

export const DEFAULT_INVOICE_TEMPLATE: CommerceInvoiceTemplateSettings = {
  branding: { ...DEFAULT_BRANDING },
  header_title: 'Invoice',
  intro_text: 'Please remit payment by the due date listed below.',
  footer_text: 'Thank you for your business.',
  payment_instructions: 'Pay by check, ACH, or wire transfer. Include invoice number with payment.',
  tax_rate: 0,
  tax_label: 'Tax',
  currency: 'USD',
  due_days: 30,
  show_tax: true,
  default_notes: '',
  default_line_items: [{ description: 'Service or product', quantity: 1, unit_price: 0, total: 0 }],
}

export const DEFAULT_CONTRACT_TEMPLATE: CommerceContractTemplateSettings = {
  branding: { ...DEFAULT_BRANDING },
  header_title: 'Service Agreement',
  preamble:
    'This Agreement ("Agreement") is entered into as of the Effective Date by and between the Provider and the Client named below.',
  sections: [
    {
      title: '1. Services',
      body: 'Provider agrees to deliver the services described in any attached statement of work or quote accepted by Client.',
    },
    {
      title: '2. Term',
      body: 'This Agreement begins on the Start Date and continues until the End Date unless terminated earlier in accordance with this Agreement.',
    },
    {
      title: '3. Fees & Payment',
      body: 'Client agrees to pay fees as set forth in applicable quotes or invoices. Late payments may incur interest at the maximum rate permitted by law.',
    },
    {
      title: '4. Confidentiality',
      body: 'Each party agrees to protect the other party\'s confidential information and use it only for purposes of this Agreement.',
    },
    {
      title: '5. Limitation of Liability',
      body: 'Except for gross negligence or willful misconduct, neither party shall be liable for indirect or consequential damages.',
    },
  ],
  closing_text:
    'IN WITNESS WHEREOF, the parties have executed this Agreement as of the Effective Date.',
  footer_text: '',
}

export function defaultTemplateSettings(docType: CommerceDocType): CommerceTemplateSettings {
  switch (docType) {
    case 'quote':
      return structuredClone(DEFAULT_QUOTE_TEMPLATE)
    case 'invoice':
      return structuredClone(DEFAULT_INVOICE_TEMPLATE)
    case 'contract':
      return structuredClone(DEFAULT_CONTRACT_TEMPLATE)
  }
}

export function defaultTemplateName(docType: CommerceDocType): string {
  switch (docType) {
    case 'quote':
      return 'Standard quote'
    case 'invoice':
      return 'Standard invoice'
    case 'contract':
      return 'Standard service agreement'
  }
}

export function mergeBranding(
  branding: CommerceBranding,
  orgName?: string | null,
): CommerceBranding {
  return {
    ...branding,
    company_name: branding.company_name || orgName || DEFAULT_BRANDING.company_name,
  }
}

export function computeTotalsFromItems(
  items: LineItem[],
  taxRate = 0,
): { subtotal: number; tax: number; total: number } {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unit_price, 0)
  const tax = Math.round(subtotal * taxRate * 100) / 100
  return { subtotal, tax, total: subtotal + tax }
}

export function normalizeLineItems(items: LineItem[]): LineItem[] {
  return items.map((item) => {
    const quantity = Number(item.quantity) || 0
    const unit_price = Number(item.unit_price) || 0
    return {
      description: item.description || '',
      quantity,
      unit_price,
      total: Math.round(quantity * unit_price * 100) / 100,
    }
  })
}

export function addDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function applyTemplateVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`)
}
