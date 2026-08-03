/**
 * Tenant Context Utilities
 * Provides helper functions for multi-tenant operations
 */

import { supabase } from './supabase'

const PROFILE_ORG_RETRY_MS = 400
const PROFILE_ORG_MAX_ATTEMPTS = 10

async function waitForProfileOrganizationId(userId: string): Promise<string | null> {
  for (let attempt = 0; attempt < PROFILE_ORG_MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .maybeSingle()

    if (!error && data?.organization_id) {
      return data.organization_id as string
    }

    if (attempt < PROFILE_ORG_MAX_ATTEMPTS - 1) {
      await new Promise((resolve) => setTimeout(resolve, PROFILE_ORG_RETRY_MS))
    }
  }
  return null
}

/**
 * Get the current user's organization ID.
 * Waits briefly for invite signup to finish linking the profile before creating a default org.
 */
export async function getCurrentOrganizationId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return null

    const orgId = await waitForProfileOrganizationId(user.id)
    if (orgId) return orgId

    return await ensureMyOrganization()
  } catch (error) {
    console.error('Error getting organization ID:', error)
    return await ensureMyOrganization()
  }
}

/**
 * RPC: create default organization and user_profiles row for current user if missing.
 * Run the invite-code migration to add this function.
 */
async function ensureMyOrganization(): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('ensure_my_organization')
    if (error) {
      console.error('ensure_my_organization RPC error:', error)
      return null
    }
    return data as string | null
  } catch (error) {
    console.error('ensure_my_organization failed:', error)
    return null
  }
}

/**
 * Get organization details
 */
export async function getOrganization(organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', organizationId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error getting organization:', error)
    return null
  }
}

/**
 * Check if current user has a specific role
 */
export async function hasRole(role: string | string[]): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return false

    const { data, error } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (error) throw error

    const userRole = data?.role
    if (!userRole) return false

    if (Array.isArray(role)) {
      return role.includes(userRole)
    }

    return userRole === role
  } catch (error) {
    console.error('Error checking role:', error)
    return false
  }
}

/**
 * Get all users in the current organization
 */
export async function getOrganizationUsers(organizationId: string) {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error getting organization users:', error)
    return []
  }
}

/**
 * Update user role (admin only)
 */
export async function updateUserRole(userId: string, newRole: string) {
  try {
    // Check if current user is admin or owner
    const isAdmin = await hasRole(['owner', 'admin'])
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can update user roles')
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating user role:', error)
    throw error
  }
}

/** Generate a short invite code (8 chars, uppercase alphanumeric). */
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  const bytes = new Uint8Array(8)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
    for (let i = 0; i < 8; i++) code += chars[bytes[i]! % chars.length]
  } else {
    for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

/**
 * Invite user to organization. Creates an invite with a token and code; returns both
 * inviteLink and code so the recipient can use either (link or enter code on Have an invite? page).
 */
export async function inviteUserToOrganization(
  email: string,
  role: string = 'member'
): Promise<{ id: string; email: string; role: string; token: string; code: string; inviteLink: string; expires_at: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) throw new Error('No organization found')

    const canInvite = await hasRole(['owner', 'admin'])
    if (!canInvite) {
      throw new Error('Unauthorized: Only admins can invite users')
    }

    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)
    const code = generateInviteCode()

    const { data, error } = await supabase
      .from('organization_invitations')
      .insert({
        organization_id: organizationId,
        email: email.trim().toLowerCase(),
        role,
        invited_by: user.id,
        expires_at: expiresAt.toISOString(),
        code,
      })
      .select('id, email, role, token, code, expires_at')
      .single()

    if (error) throw error
    const token = data?.token ?? ''
    const storedCode = data?.code ?? code
    const inviteLink = typeof window !== 'undefined'
      ? `${window.location.origin}/accept-invite?token=${token}`
      : `${typeof globalThis !== 'undefined' && (globalThis as any).__APP_ORIGIN__ || ''}/accept-invite?token=${token}`
    return {
      id: data?.id ?? '',
      email: data?.email ?? email,
      role: data?.role ?? role,
      token,
      code: storedCode,
      inviteLink,
      expires_at: data?.expires_at ?? expiresAt.toISOString(),
    }
  } catch (error) {
    console.error('Error inviting user:', error)
    throw error
  }
}

/**
 * Get or create an invite for an employee (by email). Used from HR when clicking "Generate invite code"
 * on an employee. Returns existing pending invite if one exists, otherwise creates a new one.
 */
export async function getOrCreateInviteForEmployee(
  email: string,
  role: string = 'member'
): Promise<{ id: string; email: string; role: string; token: string; code: string; inviteLink: string; expires_at: string }> {
  const organizationId = await getCurrentOrganizationId()
  if (!organizationId) {
    throw new Error(
      'No organization found. Run the Supabase migration supabase-invite-code-migration.sql (it adds ensure_my_organization), then try again.'
    )
  }

  // Permission is enforced by create_employee_invite RPC (owner/admin or only user in org)

  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) throw new Error('Employee must have an email to generate an invite')

  const { data: existing } = await supabase
    .from('organization_invitations')
    .select('id, email, role, token, code, expires_at')
    .eq('organization_id', organizationId)
    .eq('email', normalizedEmail)
    .is('accepted_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .maybeSingle()

  if (existing?.code) {
    const token = existing.token ?? ''
    const inviteLink = buildInviteLink(existing.token)
    return {
      id: existing.id,
      email: existing.email ?? normalizedEmail,
      role: existing.role ?? role,
      token,
      code: existing.code,
      inviteLink,
      expires_at: existing.expires_at ?? '',
    }
  }

  // Create via RPC so the DB returns the row (and code) in one step; avoids RLS blocking SELECT after INSERT
  const { data: rpcRows, error: rpcError } = await supabase.rpc('create_employee_invite', {
    p_email: normalizedEmail,
    p_role: role,
  })

  if (rpcError) {
    console.error('create_employee_invite RPC error:', rpcError)
    throw new Error(rpcError.message || 'Failed to generate invite code')
  }

  const row = Array.isArray(rpcRows) ? rpcRows[0] : rpcRows
  if (!row || (row as { code?: string }).code == null) {
    throw new Error('Invite was created but no code was returned. Run the invite-code migration and try again.')
  }

  const r = row as { id: string; email: string; role: string; token: string; code: string; expires_at: string }
  return {
    id: r.id,
    email: r.email ?? normalizedEmail,
    role: r.role ?? role,
    token: r.token ?? '',
    code: r.code,
    inviteLink: buildInviteLink(r.token),
    expires_at: r.expires_at ?? '',
  }
}

function buildInviteLink(token: string | undefined): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : (typeof globalThis !== 'undefined' && (globalThis as { __APP_ORIGIN__?: string }).__APP_ORIGIN__) || ''
  return `${origin}/accept-invite?token=${token ?? ''}`
}

/**
 * Fetch invite details by token (for accept-invite page). Callable before login.
 */
export async function getInviteByToken(
  token: string
): Promise<{ id: string; email: string; organization_id: string; organization_name: string; role: string } | null> {
  try {
    const { data, error } = await supabase.rpc('get_invite_by_token', { invite_token: token })
    if (error) {
      console.error('get_invite_by_token error:', error)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.email) return null
    return {
      id: row.id,
      email: row.email,
      organization_id: row.organization_id,
      organization_name: row.organization_name ?? 'Your organization',
      role: row.role ?? 'member',
    }
  } catch (e) {
    console.error('getInviteByToken:', e)
    return null
  }
}

/**
 * Fetch invite details by code (for accept-invite page "enter code" flow). Callable before login.
 */
export async function getInviteByCode(
  code: string
): Promise<{ id: string; email: string; organization_id: string; organization_name: string; role: string } | null> {
  try {
    const { data, error } = await supabase.rpc('get_invite_by_code', { invite_code: code.trim() })
    if (error) {
      console.error('get_invite_by_code error:', error)
      return null
    }
    const row = Array.isArray(data) ? data[0] : data
    if (!row?.email) return null
    return {
      id: row.id,
      email: row.email,
      organization_id: row.organization_id,
      organization_name: row.organization_name ?? 'Your organization',
      role: row.role ?? 'member',
    }
  } catch (e) {
    console.error('getInviteByCode:', e)
    return null
  }
}

/**
 * After invite signup, link user_profiles + hr_employees to the invite (idempotent).
 * Requires authenticated session matching the invite email.
 */
export async function completeInviteSignup(inviteId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('complete_invite_signup', {
      p_invite_id: inviteId,
    })
    if (error) {
      console.error('complete_invite_signup RPC error:', error)
      throw new Error(error.message || 'Could not complete invite signup')
    }
    return (data as string) ?? null
  } catch (error) {
    console.error('completeInviteSignup failed:', error)
    throw error
  }
}

/**
 * Get organization statistics
 */
export async function getOrganizationStats(organizationId: string) {
  try {
    // Get user count
    const { count: userCount } = await supabase
      .from('user_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .eq('is_active', true)

    // Get project count
    const { count: projectCount } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    // Get task count
    const { count: taskCount } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId)

    return {
      userCount: userCount || 0,
      projectCount: projectCount || 0,
      taskCount: taskCount || 0,
    }
  } catch (error) {
    console.error('Error getting organization stats:', error)
    return {
      userCount: 0,
      projectCount: 0,
      taskCount: 0,
    }
  }
}

/**
 * Update organization settings
 */
export async function updateOrganizationSettings(
  organizationId: string,
  settings: Record<string, any>
) {
  try {
    // Check if current user is admin or owner
    const isAdmin = await hasRole(['owner', 'admin'])
    if (!isAdmin) {
      throw new Error('Unauthorized: Only admins can update organization settings')
    }

    const { data, error } = await supabase
      .from('organizations')
      .update({ 
        settings,
        updated_at: new Date().toISOString() 
      })
      .eq('id', organizationId)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    console.error('Error updating organization settings:', error)
    throw error
  }
}

/** Trial window fields (requires migration columns on organizations). */
export async function updateOrganizationTrial(
  organizationId: string,
  fields: {
    trial_duration_days?: number
    trial_start_at?: string | null
    trial_end_at?: string | null
  },
) {
  const isAdmin = await hasRole(['owner', 'admin'])
  if (!isAdmin) {
    throw new Error('Unauthorized: Only admins can update trial settings')
  }
  const { data, error } = await supabase
    .from('organizations')
    .update({
      ...fields,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single()
  if (error) throw error
  return data
}




