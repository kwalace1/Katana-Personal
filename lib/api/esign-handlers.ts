/**
 * Public e-sign API — token-based packet / file / sign (service role).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const BUCKET = 'esign-files'

function getSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  )
}

function getServiceRoleKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || ''
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function adminClient(): SupabaseClient | null {
  const url = getSupabaseUrl()
  const key = getServiceRoleKey()
  if (!url || !key) return null
  return createClient(url, key)
}

function base64ToBytes(base64: string): Uint8Array {
  const raw = base64.includes(',') ? base64.split(',')[1]! : base64
  const binary = Buffer.from(raw, 'base64')
  return new Uint8Array(binary)
}

async function loadPacket(admin: SupabaseClient, token: string) {
  const { data: signer, error: signerError } = await admin
    .from('esign_signers')
    .select('*')
    .eq('signing_token', token)
    .maybeSingle()

  if (signerError) throw new Error(signerError.message)
  if (!signer) throw new Error('Invalid signing link')

  const { data: document, error: docError } = await admin
    .from('esign_documents')
    .select('*')
    .eq('id', signer.document_id)
    .maybeSingle()

  if (docError) throw new Error(docError.message)
  if (!document) throw new Error('Document not found')

  const { data: fields } = await admin
    .from('esign_fields')
    .select('*')
    .eq('document_id', document.id)
    .or(`signer_id.eq.${signer.id},signer_id.is.null`)

  const { data: org } = await admin
    .from('organizations')
    .select('name, settings')
    .eq('id', document.organization_id)
    .maybeSingle()

  let logoUrl: string | null = null
  const settings = (org?.settings ?? {}) as Record<string, unknown>
  if (typeof settings.logo_url === 'string' && settings.logo_url.trim()) {
    logoUrl = settings.logo_url.trim()
  } else if (
    settings.branding &&
    typeof settings.branding === 'object' &&
    settings.branding !== null &&
    typeof (settings.branding as { logo_url?: unknown }).logo_url === 'string'
  ) {
    const fromSettings = (settings.branding as { logo_url: string }).logo_url.trim()
    if (fromSettings) logoUrl = fromSettings
  }

  if (!logoUrl) {
    const { data: tpl } = await admin
      .from('cs_commerce_templates')
      .select('settings')
      .eq('organization_id', document.organization_id)
      .eq('is_default', true)
      .limit(1)
      .maybeSingle()
    const branding = (tpl?.settings as { branding?: { logo_url?: string } } | null)?.branding
    if (branding?.logo_url?.trim()) logoUrl = branding.logo_url.trim()
  }

  const expired =
    !!document.expires_at &&
    new Date(document.expires_at).getTime() < Date.now() &&
    !signer.signed_at

  return {
    signer: {
      id: signer.id,
      name: signer.name,
      email: signer.email,
      signing_order: signer.signing_order,
      signed_at: signer.signed_at,
    },
    document: {
      id: document.id,
      title: document.title,
      description: document.description,
      status: document.status,
      file_name: document.file_name,
      mime_type: document.mime_type,
      expires_at: document.expires_at,
      signed_file_path: document.signed_file_path,
      file_path: document.file_path,
      organization_id: document.organization_id,
    },
    fields: fields ?? [],
    organization: {
      name: (org?.name as string | undefined)?.trim() || 'Secure signature request',
      logoUrl,
    },
    alreadySigned: !!signer.signed_at,
    cancelled: document.status === 'cancelled',
    expired,
  }
}

async function recomputeStatus(admin: SupabaseClient, documentId: string) {
  const { data: signers } = await admin
    .from('esign_signers')
    .select('signed_at')
    .eq('document_id', documentId)

  const total = signers?.length ?? 0
  const signed = signers?.filter((s) => s.signed_at).length ?? 0
  let status = 'pending'
  if (total > 0 && signed === total) status = 'signed'
  else if (signed > 0) status = 'partially_signed'

  await admin.from('esign_documents').update({ status, updated_at: new Date().toISOString() }).eq('id', documentId)
}

export async function handleEsignRequest(req: Request): Promise<Response> {
  const admin = adminClient()
  if (!admin) {
    return json(
      { error: 'E-Sign API is not configured. Set SUPABASE_SERVICE_ROLE_KEY and Supabase URL.' },
      503,
    )
  }

  try {
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const action = url.searchParams.get('action') || 'packet'
      const token = url.searchParams.get('token')?.trim()
      if (!token) return json({ error: 'Missing token' }, 400)

      const packet = await loadPacket(admin, token)

      if (action === 'file') {
        if (packet.cancelled) return json({ error: 'Document cancelled' }, 403)
        const path =
          packet.alreadySigned && packet.document.signed_file_path
            ? packet.document.signed_file_path
            : packet.document.file_path
        const { data, error } = await admin.storage.from(BUCKET).download(path)
        if (error || !data) return json({ error: error?.message || 'File not found' }, 404)
        const bytes = await data.arrayBuffer()
        return new Response(bytes, {
          status: 200,
          headers: {
            'Content-Type': packet.document.mime_type || 'application/pdf',
            'Content-Disposition': `inline; filename="${packet.document.file_name}"`,
          },
        })
      }

      const { file_path: _fp, organization_id: _org, ...document } = packet.document
      return json({
        signer: packet.signer,
        document,
        fields: packet.fields,
        organization: packet.organization,
        alreadySigned: packet.alreadySigned,
        cancelled: packet.cancelled,
        expired: packet.expired,
      })
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        action?: string
        token?: string
        signatureText?: string | null
        signatureImageDataUrl?: string | null
        signedPdfBase64?: string | null
      }

      if (body.action !== 'sign') return json({ error: 'Unknown action' }, 400)
      const token = body.token?.trim()
      if (!token) return json({ error: 'Missing token' }, 400)
      if (!body.signatureText?.trim() && !body.signatureImageDataUrl) {
        return json({ error: 'Provide a drawn or typed signature' }, 400)
      }

      const packet = await loadPacket(admin, token)
      if (packet.cancelled) return json({ error: 'Document cancelled' }, 403)
      if (packet.expired) return json({ error: 'Document expired' }, 403)
      if (packet.alreadySigned) return json({ error: 'Already signed' }, 409)

      let signatureImagePath: string | null = null
      if (body.signatureImageDataUrl?.startsWith('data:image/')) {
        const bytes = base64ToBytes(body.signatureImageDataUrl)
        const path = `${packet.document.organization_id}/signatures/${packet.signer.id}-${Date.now()}.png`
        const { error: upErr } = await admin.storage.from(BUCKET).upload(path, bytes, {
          contentType: 'image/png',
          upsert: true,
        })
        if (upErr) return json({ error: `Signature upload failed: ${upErr.message}` }, 500)
        signatureImagePath = path
      }

      let signedFilePath: string | null = packet.document.signed_file_path
      if (body.signedPdfBase64) {
        const pdfBytes = base64ToBytes(body.signedPdfBase64)
        const path = `${packet.document.organization_id}/signed/${packet.document.id}-${Date.now()}.pdf`
        const { error: pdfErr } = await admin.storage.from(BUCKET).upload(path, pdfBytes, {
          contentType: 'application/pdf',
          upsert: true,
        })
        if (pdfErr) return json({ error: `Signed PDF upload failed: ${pdfErr.message}` }, 500)
        signedFilePath = path
      }

      const ip =
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null
      const userAgent = req.headers.get('user-agent') || null

      const { error: updateErr } = await admin
        .from('esign_signers')
        .update({
          signed_at: new Date().toISOString(),
          signature_text: body.signatureText?.trim() || null,
          signature_image_path: signatureImagePath,
          ip_address: ip,
          user_agent: userAgent,
        })
        .eq('id', packet.signer.id)

      if (updateErr) return json({ error: updateErr.message }, 500)

      if (signedFilePath) {
        await admin
          .from('esign_documents')
          .update({ signed_file_path: signedFilePath, updated_at: new Date().toISOString() })
          .eq('id', packet.document.id)
      }

      await recomputeStatus(admin, packet.document.id)
      return json({ ok: true })
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'E-Sign error'
    const status = message.includes('Invalid') || message.includes('not found') ? 404 : 500
    return json({ error: message }, status)
  }
}
