import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import type { Organization, UserProfile } from '@/contexts/AuthContext'
import { VISIBLE_MODULE_IDS } from '@/lib/module-access'

const STORAGE_KEY = 'katana-dev-auth-bypass'

export const DEV_USER_ID = '00000000-0000-0000-0000-000000000001'
export const DEV_ORG_ID = '00000000-0000-0000-0000-000000000002'

/** Dev-only local sign-in; set VITE_DEV_AUTH_BYPASS=true in .env */
export function isDevAuthBypassEnabled(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
}

export function hasDevCredentials(): boolean {
  const email = import.meta.env.VITE_DEV_EMAIL?.trim()
  const password = import.meta.env.VITE_DEV_PASSWORD
  return Boolean(email && password && isSupabaseConfigured)
}

export function isDevBypassActive(): boolean {
  if (!isDevAuthBypassEnabled()) return false
  try {
    return sessionStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function activateDevBypass(): void {
  sessionStorage.setItem(STORAGE_KEY, '1')
}

export function clearDevBypass(): void {
  sessionStorage.removeItem(STORAGE_KEY)
}

/** Real Supabase email/password sign-in for local dev (valid JWT for RLS). */
export async function signInWithDevCredentials(): Promise<AuthError | null> {
  const email = import.meta.env.VITE_DEV_EMAIL?.trim()
  const password = import.meta.env.VITE_DEV_PASSWORD
  if (!email || !password) {
    return { message: 'Set VITE_DEV_EMAIL and VITE_DEV_PASSWORD in .env', name: 'DevAuthError', status: 400 } as AuthError
  }
  if (!isSupabaseConfigured) {
    return {
      message: 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your real Supabase project',
      name: 'DevAuthError',
      status: 400,
    } as AuthError
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error
}

export function createDevMockProfile(): UserProfile {
  const now = new Date().toISOString()
  return {
    id: DEV_USER_ID,
    organization_id: DEV_ORG_ID,
    email: 'dev@localhost',
    full_name: 'Dev User',
    avatar_url: null,
    role: 'owner',
    department: null,
    job_title: 'Local Developer',
    is_active: true,
    last_login_at: now,
    created_at: now,
    updated_at: now,
  }
}

export function createDevMockOrganization(): Organization {
  const now = new Date().toISOString()
  return {
    id: DEV_ORG_ID,
    name: 'Local Dev Organization',
    domain: 'localhost',
    slug: 'local-dev',
    subscription_tier: 'enterprise',
    subscription_status: 'active',
    max_users: 999,
    settings: { onboarding_completed: true },
    enabled_modules: [...VISIBLE_MODULE_IDS],
    created_at: now,
    updated_at: now,
  }
}

function createDevMockUser(): User {
  const now = new Date().toISOString()
  return {
    id: DEV_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'dev@localhost',
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'dev-bypass' },
    user_metadata: { full_name: 'Dev User' },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User
}

function createDevMockSession(user: User): Session {
  return {
    access_token: 'dev-bypass-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 365,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365,
    refresh_token: 'dev-bypass-refresh',
    user,
  } as Session
}

/** UI-only mock session when Supabase credentials are not configured. */
export function createDevAuthState() {
  const user = createDevMockUser()
  const session = createDevMockSession(user)
  return {
    user,
    session,
    profile: createDevMockProfile(),
    organization: createDevMockOrganization(),
  }
}
