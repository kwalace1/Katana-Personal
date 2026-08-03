/**
 * Switch OAuth — client credentials auth + bearer token validation
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseConfig, SWITCH_TOKEN_TTL_SECONDS } from './switch-config'

export interface SwitchAuthContext {
  clientRef: string
  clientId: string
  organizationId: string
  actingUserId: string | null
}

export async function hashSecret(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function adminClient(): SupabaseClient | null {
  const { url, serviceKey } = getSupabaseConfig()
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey)
}

async function resolveClientFromDb(
  clientId: string,
  clientSecret: string,
): Promise<SwitchAuthContext | null> {
  const admin = adminClient()
  if (!admin) return null

  const { data: row } = await admin
    .from('switch_oauth_clients')
    .select('id, client_id, client_secret_hash, organization_id, acting_user_id, is_active')
    .eq('client_id', clientId)
    .eq('is_active', true)
    .maybeSingle()

  if (!row) return null
  if (row.client_secret_hash !== (await hashSecret(clientSecret))) return null

  return {
    clientRef: row.id as string,
    clientId: row.client_id as string,
    organizationId: row.organization_id as string,
    actingUserId: (row.acting_user_id as string | null) ?? null,
  }
}

function resolveClientFromEnv(clientId: string, clientSecret: string): SwitchAuthContext | null {
  const envId = process.env.SWITCH_OAUTH_CLIENT_ID?.trim()
  const envSecret = process.env.SWITCH_OAUTH_CLIENT_SECRET?.trim()
  const orgId = process.env.SWITCH_DEFAULT_ORG_ID?.trim()
  if (!envId || !envSecret || !orgId) return null
  if (clientId !== envId || clientSecret !== envSecret) return null

  return {
    clientRef: 'env-client',
    clientId: envId,
    organizationId: orgId,
    actingUserId: process.env.SWITCH_ACTING_USER_ID?.trim() || null,
  }
}

export async function authenticateClientCredentials(
  clientId: string,
  clientSecret: string,
): Promise<SwitchAuthContext | null> {
  const fromEnv = resolveClientFromEnv(clientId, clientSecret)
  if (fromEnv) return fromEnv
  return resolveClientFromDb(clientId, clientSecret)
}

export async function resolveClientRef(ctx: SwitchAuthContext): Promise<string | null> {
  if (ctx.clientRef !== 'env-client') return ctx.clientRef

  const admin = adminClient()
  if (!admin) return null

  await ensureEnvClientRow(admin, ctx)
  const { data: row } = await admin
    .from('switch_oauth_clients')
    .select('id')
    .eq('client_id', ctx.clientId)
    .maybeSingle()

  return (row?.id as string | null) ?? null
}

export async function issueAccessToken(ctx: SwitchAuthContext): Promise<{
  access_token: string
  token_type: 'Bearer'
  expires_in: number
} | null> {
  const admin = adminClient()
  if (!admin) return null

  const clientRef = await resolveClientRef(ctx)
  if (!clientRef) return null

  const token = generateToken()
  const expiresAt = new Date(Date.now() + SWITCH_TOKEN_TTL_SECONDS * 1000).toISOString()

  const { error } = await admin.from('switch_oauth_tokens').insert({
    client_ref: clientRef,
    access_token_hash: await hashSecret(token),
    expires_at: expiresAt,
  })

  if (error) return null

  return { access_token: token, token_type: 'Bearer', expires_in: SWITCH_TOKEN_TTL_SECONDS }
}

async function ensureEnvClientRow(admin: SupabaseClient, ctx: SwitchAuthContext): Promise<void> {
  const secret = process.env.SWITCH_OAUTH_CLIENT_SECRET?.trim() || ''
  const { data: existing } = await admin
    .from('switch_oauth_clients')
    .select('id')
    .eq('client_id', ctx.clientId)
    .maybeSingle()

  if (existing?.id) return

  await admin.from('switch_oauth_clients').insert({
    client_id: ctx.clientId,
    client_secret_hash: await hashSecret(secret),
    name: 'Switch (env)',
    organization_id: ctx.organizationId,
    acting_user_id: ctx.actingUserId,
  })
}

export async function validateBearerToken(token: string): Promise<SwitchAuthContext | null> {
  const admin = adminClient()
  if (!admin) return null

  const tokenHash = await hashSecret(token)
  const now = new Date().toISOString()

  const { data: tokenRow } = await admin
    .from('switch_oauth_tokens')
    .select('client_ref, expires_at')
    .eq('access_token_hash', tokenHash)
    .gt('expires_at', now)
    .maybeSingle()

  if (!tokenRow?.client_ref) return null

  const { data: client } = await admin
    .from('switch_oauth_clients')
    .select('id, client_id, organization_id, acting_user_id, is_active')
    .eq('id', tokenRow.client_ref)
    .eq('is_active', true)
    .maybeSingle()

  if (!client) return null

  return {
    clientRef: client.id as string,
    clientId: client.client_id as string,
    organizationId: client.organization_id as string,
    actingUserId: (client.acting_user_id as string | null) ?? null,
  }
}

export async function authenticateSwitchRequest(req: Request): Promise<SwitchAuthContext | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  const token = authHeader.slice(7).trim()
  if (!token) return null
  return validateBearerToken(token)
}

export function getAdminClient(): SupabaseClient | null {
  return adminClient()
}
