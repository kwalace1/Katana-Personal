import emailjs from '@emailjs/browser'
import { formatEmailJsError } from './support-email'

const DEFAULT_FROM_EMAIL = 'katanatechnologysystems@gmail.com'
const DEFAULT_FROM_NAME = 'Katana E-Sign'

export function getEsignEmailServiceId(): string {
  return (
    import.meta.env.VITE_EMAILJS_ESIGN_SERVICE_ID ||
    import.meta.env.VITE_EMAILJS_INVITE_SERVICE_ID ||
    import.meta.env.VITE_EMAILJS_SERVICE_ID ||
    ''
  )
}

export function getEsignEmailTemplateId(): string {
  return (
    import.meta.env.VITE_EMAILJS_ESIGN_TEMPLATE_ID ||
    import.meta.env.VITE_EMAILJS_INVITE_TEMPLATE_ID ||
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
    ''
  )
}

export function getEsignEmailPublicKey(): string {
  return import.meta.env.VITE_EMAILJS_PUBLIC_KEY || ''
}

export function isEsignEmailConfigured(): boolean {
  return !!(getEsignEmailServiceId() && getEsignEmailTemplateId() && getEsignEmailPublicKey())
}

export function formatEsignSigningEmailMessage(options: {
  signerName: string
  documentTitle: string
  signingUrl: string
  organizationName?: string
  requesterName?: string
  expiresAt?: string | null
}): string {
  const org = options.organizationName?.trim() || 'your organization'
  const from = options.requesterName?.trim() || 'A Katana user'
  const expiry = options.expiresAt
    ? `\nThis request expires on ${new Date(options.expiresAt).toLocaleDateString()}.\n`
    : ''

  return [
    `Hi ${options.signerName},`,
    '',
    `${from} at ${org} has asked you to sign “${options.documentTitle}”.`,
    '',
    'Open this secure link to review and sign the document:',
    options.signingUrl,
    expiry,
    'If you were not expecting this request, you can ignore this email.',
    '',
    '— Katana E-Sign',
  ].join('\n')
}

export async function sendEsignSigningRequestEmail(options: {
  toEmail: string
  signerName: string
  documentTitle: string
  signingUrl: string
  organizationName?: string
  requesterName?: string
  expiresAt?: string | null
}): Promise<void> {
  const toEmail = options.toEmail.trim()
  if (!toEmail) throw new Error('Signer email is required')

  const serviceId = getEsignEmailServiceId()
  const templateId = getEsignEmailTemplateId()
  const publicKey = getEsignEmailPublicKey()

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      'E-Sign email is not configured. Set VITE_EMAILJS_PUBLIC_KEY, VITE_EMAILJS_SERVICE_ID, and VITE_EMAILJS_TEMPLATE_ID.',
    )
  }

  const message = formatEsignSigningEmailMessage(options)
  const subject = `Signature requested: ${options.documentTitle}`

  emailjs.init({ publicKey })

  try {
    await emailjs.send(
      serviceId,
      templateId,
      {
        to_email: toEmail,
        email: toEmail,
        to: toEmail,
        recipient: toEmail,
        reply_to: DEFAULT_FROM_EMAIL,
        from_email: DEFAULT_FROM_EMAIL,
        from_name: DEFAULT_FROM_NAME,
        name: options.signerName,
        user_name: options.signerName,
        signer_name: options.signerName,
        document_title: options.documentTitle,
        signing_url: options.signingUrl,
        shareable_link: options.signingUrl,
        subject,
        message,
        body: message,
        content: message,
        html_message: message.replace(/\n/g, '<br>'),
        organization_name: options.organizationName || '',
        requester_name: options.requesterName || '',
      },
      { publicKey },
    )
  } catch (err) {
    throw new Error(formatEmailJsError(err))
  }
}

export async function sendEsignSigningEmails(options: {
  signers: Array<{ name: string; email: string | null; signing_token: string }>
  documentTitle: string
  buildUrl: (token: string) => string
  organizationName?: string
  requesterName?: string
  expiresAt?: string | null
}): Promise<{ sent: number; skipped: number; failures: Array<{ email: string; error: string }> }> {
  let sent = 0
  let skipped = 0
  const failures: Array<{ email: string; error: string }> = []

  for (const signer of options.signers) {
    const email = signer.email?.trim()
    if (!email) {
      skipped += 1
      continue
    }
    try {
      await sendEsignSigningRequestEmail({
        toEmail: email,
        signerName: signer.name,
        documentTitle: options.documentTitle,
        signingUrl: options.buildUrl(signer.signing_token),
        organizationName: options.organizationName,
        requesterName: options.requesterName,
        expiresAt: options.expiresAt,
      })
      sent += 1
    } catch (e) {
      failures.push({
        email,
        error: e instanceof Error ? e.message : 'Send failed',
      })
    }
  }

  return { sent, skipped, failures }
}
