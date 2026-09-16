import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''

export const supabaseConfigured = Boolean(
  url &&
    anonKey &&
    url.startsWith('http') &&
    !url.includes('your') &&
    anonKey.length > 20,
)

/** Soft launch: Apple button only when explicitly enabled (provider must be set in Supabase). */
export const appleAuthEnabled =
  supabaseConfigured && String(import.meta.env.VITE_SUPABASE_APPLE_AUTH || '').toLowerCase() === 'true'

let client: SupabaseClient | null = null

if (supabaseConfigured) {
  client = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
}

export function getSupabase(): SupabaseClient {
  if (!client) {
    throw new Error('Cloud isn’t available in this build.')
  }
  return client
}

/** Optional client when cloud is not configured (returns null). */
export function tryGetSupabase(): SupabaseClient | null {
  return client
}

export type CloudUser = {
  uid: string
  email: string | null
  displayName: string | null
}

export function toCloudUser(user: {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown>
}): CloudUser {
  const meta = user.user_metadata || {}
  const displayName =
    (typeof meta.display_name === 'string' && meta.display_name) ||
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null
  return {
    uid: user.id,
    email: user.email ?? null,
    displayName,
  }
}
