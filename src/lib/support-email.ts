import emailjs from '@emailjs/browser'
import {
  SUBMISSION_CATEGORY_LABELS,
  SUBMISSION_PRIORITY_LABELS,
  SUBMISSION_TYPE_LABELS,
  MODULE_CONTEXT_OPTIONS,
  type SubmissionCategory,
  type SubmissionPriority,
  type SubmissionType,
} from './support-api'

/** EmailJS rejects with { status, text } — not a standard Error. */
export function formatEmailJsError(err: unknown): string {
  if (err && typeof err === 'object' && 'text' in err) {
    const status = (err as { status?: number }).status
    const text = String((err as { text?: string }).text ?? '').trim()
    if (status === 403 && /origin|domain|browser/i.test(text)) {
      return `${text} — In EmailJS go to Account → Security and allow http://localhost:3001 (and your production domain).`
    }
    if (/recipient.*email.*empty|recipient.*empty/i.test(text)) {
      return (
        `${text} — Fix in EmailJS: open your support template → Settings tab → set **To Email** to ` +
        'katanatechnologysystems@gmail.com (typed directly). Use Default Email Address for From. Reply-To: {{reply_to}}.'
      )
    }
    return text || `EmailJS error (HTTP ${status ?? 'unknown'})`
  }
  if (err instanceof Error && err.message) return err.message
  return 'Unknown email error'
}

/** Pilot support inbox — also overridable via VITE_SUPPORT_INBOX_EMAIL */
export const DEFAULT_SUPPORT_INBOX = 'katanatechnologysystems@gmail.com'

/**
 * Katana support EmailJS config (see EMAILJS_SETUP.md). The service/template IDs
 * and the EmailJS *public* key are all client-side identifiers — the public key is
 * designed to ship in the browser bundle, and abuse is gated by EmailJS → Account →
 * Security → Allowed Domains, not by keeping this key secret. They're baked in as
 * defaults so support email works out of the box; any matching env var still wins.
 */
export const DEFAULT_SUPPORT_SERVICE_ID = 'service_svo9pq8'
export const DEFAULT_SUPPORT_TEMPLATE_ID = 'template_u1xja4v'
export const DEFAULT_SUPPORT_PUBLIC_KEY = 'LIT8H9ccVvlJbCL7U'

export function getSupportInboxEmail(): string {
  const fromEnv = (import.meta.env.VITE_SUPPORT_INBOX_EMAIL as string | undefined)?.trim()
  return fromEnv || DEFAULT_SUPPORT_INBOX
}

export function getSupportServiceId(): string {
  return (
    import.meta.env.VITE_EMAILJS_SUPPORT_SERVICE_ID ||
    import.meta.env.VITE_EMAILJS_SERVICE_ID ||
    DEFAULT_SUPPORT_SERVICE_ID
  )
}

export function getSupportTemplateId(): string {
  return (
    import.meta.env.VITE_EMAILJS_SUPPORT_TEMPLATE_ID ||
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
    DEFAULT_SUPPORT_TEMPLATE_ID
  )
}

export function getSupportPublicKey(): string {
  return import.meta.env.VITE_EMAILJS_PUBLIC_KEY || DEFAULT_SUPPORT_PUBLIC_KEY
}

export function isSupportEmailConfigured(): boolean {
  const inbox = getSupportInboxEmail()
  const serviceId = getSupportServiceId()
  const templateId = getSupportTemplateId()
  const publicKey = getSupportPublicKey()
  return !!(inbox && serviceId && templateId && publicKey)
}

function moduleLabel(moduleContext: string | null): string {
  if (!moduleContext) return 'Not specified'
  return MODULE_CONTEXT_OPTIONS.find((m) => m.value === moduleContext)?.label ?? moduleContext
}

export function formatSupportEmailBody(options: {
  ticketId: string
  submissionType: SubmissionType
  category: SubmissionCategory
  subject: string
  description: string
  priority: SubmissionPriority
  moduleContext: string | null
  submitterName: string
  submitterEmail: string
  organizationName: string
  organizationId: string
}): string {
  const typeLabel = SUBMISSION_TYPE_LABELS[options.submissionType]
  const categoryLabel = SUBMISSION_CATEGORY_LABELS[options.category]
  const priorityLabel = SUBMISSION_PRIORITY_LABELS[options.priority]
  const mod = moduleLabel(options.moduleContext)

  return [
    '═══════════════════════════════════════════════════════',
    '  KATANA PILOT — NEW SUPPORT SUBMISSION',
    '═══════════════════════════════════════════════════════',
    '',
    '▶ REPLY TO THIS EMAIL ADDRESS (pilot user):',
    `   ${options.submitterEmail}`,
    '',
    `   Name:         ${options.submitterName}`,
    `   Organization: ${options.organizationName}`,
    '',
    '───────────────────────────────────────────────────────',
    '  TICKET DETAILS',
    '───────────────────────────────────────────────────────',
    '',
    `Ticket ID:  ${options.ticketId}`,
    `Type:       ${typeLabel}`,
    `Category:   ${categoryLabel}`,
    `Priority:   ${priorityLabel}`,
    `Module:     ${mod}`,
    '',
    `Subject: ${options.subject}`,
    '',
    'Description:',
    options.description,
    '',
    '───────────────────────────────────────────────────────',
    `Org ID: ${options.organizationId}`,
    'Submitted via Katana Support module.',
    '',
    'When you hit Reply in Gmail, your response goes to the pilot user above.',
  ].join('\n')
}

/** One-line summary for templates that only show a short {{request}} field. */
function formatRequestSummary(
  typeLabel: string,
  subject: string,
  submitterName: string,
  organizationName: string,
): string {
  return `${typeLabel}: "${subject}" from ${submitterName} (${organizationName})`
}

export async function sendSupportSubmissionEmail(options: {
  ticketId: string
  submissionType: SubmissionType
  category: SubmissionCategory
  subject: string
  description: string
  priority: SubmissionPriority
  moduleContext: string | null
  submitterName: string
  submitterEmail: string
  organizationName: string
  organizationId: string
}): Promise<void> {
  const inbox = getSupportInboxEmail()
  const submitterEmail = options.submitterEmail.trim() || inbox
  const serviceId = getSupportServiceId()
  const templateId = getSupportTemplateId()
  const publicKey = getSupportPublicKey()

  if (!inbox || !serviceId || !templateId || !publicKey) {
    throw new Error(
      'Support email is not configured. Set VITE_EMAILJS_PUBLIC_KEY (EmailJS → Account → General).',
    )
  }

  const typeLabel = SUBMISSION_TYPE_LABELS[options.submissionType]
  const categoryLabel = SUBMISSION_CATEGORY_LABELS[options.category]
  const priorityLabel = SUBMISSION_PRIORITY_LABELS[options.priority]
  const mod = moduleLabel(options.moduleContext)
  const message = formatSupportEmailBody(options)
  const requestSummary = formatRequestSummary(
    typeLabel,
    options.subject,
    options.submitterName,
    options.organizationName,
  )

  // Subject visible in inbox — includes who to reply to
  const emailSubject = `[Katana Pilot] ${typeLabel}: ${options.subject} | Reply to: ${submitterEmail}`

  emailjs.init({ publicKey })

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        // ── Recipient (Katana inbox) ──
        to_email: inbox,
        email: inbox,
        to: inbox,
        recipient: inbox,

        // ── Reply goes to pilot user ──
        reply_to: submitterEmail,
        contact_email: submitterEmail,
        user_email: submitterEmail,

        // ── Primary content (template body should use {{message}}) ──
        subject: emailSubject,
        message,
        body: message,
        content: message,
        details: message,
        html_message: message.replace(/\n/g, '<br>'),

        // ── Short fields for auto-reply-style templates ──
        request: requestSummary,
        request_type: typeLabel,
        request_details: options.description,
        user_message: options.description,
        issue: options.subject,
        title: options.subject,
        ticket_subject: options.subject,
        ticket_description: options.description,

        // ── Submitter / org ──
        from_name: options.submitterName,
        from_email: submitterEmail,
        name: options.submitterName,
        user_name: options.submitterName,
        submitter_name: options.submitterName,
        submitter_email: submitterEmail,
        company: options.organizationName,
        organization_name: options.organizationName,
        organization_id: options.organizationId,

        // ── Ticket metadata ──
        ticket_id: options.ticketId,
        submission_type: typeLabel,
        category: categoryLabel,
        priority: priorityLabel,
        module_context: mod,

        // Demo template fallbacks
        phone: submitterEmail,
        demo_date: typeLabel,
        demo_time: categoryLabel,
      },
      { publicKey },
    )
  } catch (err) {
    throw new Error(formatEmailJsError(err))
  }
}
