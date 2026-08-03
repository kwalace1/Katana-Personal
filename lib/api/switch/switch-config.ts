/**
 * Switch integration — shared config and helpers
 */

export const SWITCH_TOKEN_TTL_SECONDS = 3600
export const SWITCH_INGEST_BUCKET = 'switch-ingest'
export const SWITCH_MAX_FILE_BYTES = 25 * 1024 * 1024
export const SWITCH_MAX_RECORDS_PER_REQUEST = 500
export const SWITCH_MAX_FILES_PER_REQUEST = 100

export function getKatanaApiBaseUrl(req?: Request): string {
  const fromEnv = process.env.KATANA_API_BASE_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (req) {
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3001'
    const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https')
    return `${proto}://${host}`
  }

  return 'http://localhost:3001'
}

export function getSupabaseConfig(): { url: string; anonKey: string; serviceKey: string } {
  return {
    url: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '',
    anonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  }
}

export function isSwitchOAuthConfigured(): boolean {
  const { url, serviceKey } = getSupabaseConfig()
  return Boolean(url && serviceKey)
}
