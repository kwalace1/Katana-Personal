import { supabase } from './supabase'

/** Default route after sign-in (email, Microsoft OAuth, invites, onboarding). */
export const DEFAULT_POST_LOGIN_PATH = '/employee'

export async function getCurrentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not authenticated')
  return session.user.id
}

let _cachedOrgId: string | null = null

export async function getOrganizationId(): Promise<string> {
  if (_cachedOrgId) return _cachedOrgId
  const userId = await getCurrentUserId()

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle()

    if (!error && data?.organization_id) {
      _cachedOrgId = data.organization_id as string
      return _cachedOrgId
    }

    if (attempt < 9) {
      await new Promise((resolve) => setTimeout(resolve, 400))
    }
  }

  throw new Error('No organization found for current user')
}

export function clearOrgCache(): void {
  _cachedOrgId = null
}

/** Display name for activity feeds and notifications (profile → auth metadata → email). */
export async function getCurrentUserDisplayName(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return 'Someone'

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.full_name && String(profile.full_name).trim()) {
    return String(profile.full_name).trim()
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string }
  if (meta.full_name?.trim()) return meta.full_name.trim()
  if (meta.name?.trim()) return meta.name.trim()
  if (profile?.email && String(profile.email).trim()) return String(profile.email).trim()
  if (user.email) return user.email
  return 'Someone'
}

const LAST_LOGIN_TOUCH_MINUTES = 5

/** Update last_login_at when the user opens the app (throttled). */
export async function touchLastLoginAt(
  userId: string,
  existingLastLoginAt: string | null | undefined
): Promise<void> {
  const now = Date.now()
  if (existingLastLoginAt) {
    const lastMs = new Date(existingLastLoginAt).getTime()
    if (!Number.isNaN(lastMs)) {
      const minutesAgo = (now - lastMs) / (1000 * 60)
      if (minutesAgo < LAST_LOGIN_TOUCH_MINUTES) return
    }
  }
  await supabase
    .from('user_profiles')
    .update({ last_login_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString() })
    .eq('id', userId)
}
