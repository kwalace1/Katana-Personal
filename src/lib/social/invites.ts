import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import { createNotification } from './notifications'
import { getCloudProfile } from './friends'
import { canManageCircle, getCircle, joinCircleMember } from './circles'
import type { CircleGroup } from './types'
import type { Unsubscribe } from './friends'

export type CircleInviteStatus = 'pending' | 'accepted' | 'declined' | 'link'

export interface CircleInvite {
  token: string
  circleId: string
  circleName: string
  createdBy: string
  createdAt: string
  expiresAt: string
  usedBy: string[]
  inviteeUid?: string | null
  status?: CircleInviteStatus
  respondedAt?: string | null
}

type InviteRow = {
  token: string
  circle_id: string
  circle_name: string
  created_by: string
  created_at: string
  expires_at: string
  used_by: string[]
  invitee_uid?: string | null
  status?: CircleInviteStatus | null
  responded_at?: string | null
}

function mapInvite(row: InviteRow): CircleInvite {
  return {
    token: row.token,
    circleId: row.circle_id,
    circleName: row.circle_name,
    createdBy: row.created_by,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    usedBy: row.used_by || [],
    inviteeUid: row.invitee_uid ?? null,
    status: row.status ?? undefined,
    respondedAt: row.responded_at ?? null,
  }
}

function inviteUrl(token: string) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/invite/circle/${token}`
}

export async function createCircleInvite(input: {
  circle: CircleGroup
  createdBy: string
  daysValid?: number
}): Promise<{ invite: CircleInvite; url: string }> {
  if (!canManageCircle(input.circle, input.createdBy)) {
    throw new Error('Only the owner or a moderator can create invite links.')
  }
  const token = createId().replace(/-/g, '').slice(0, 12)
  const now = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + (input.daysValid ?? 14))
  const row = {
    token,
    circle_id: input.circle.id,
    circle_name: input.circle.name,
    created_by: input.createdBy,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    used_by: [] as string[],
    invitee_uid: null as string | null,
    status: 'link' as const,
  }
  const { data, error } = await getSupabase().from('circle_invites').insert(row).select('*').single()
  if (error) throw error
  const invite = mapInvite(data as InviteRow)
  return { invite, url: inviteUrl(token) }
}

function directInviteId(circleId: string, inviteeUid: string) {
  return `direct_${circleId}_${inviteeUid}`
}

export async function inviteFriendToCircle(input: {
  circle: CircleGroup
  createdBy: string
  inviteeUid: string
  daysValid?: number
}): Promise<CircleInvite> {
  if (!canManageCircle(input.circle, input.createdBy)) {
    throw new Error('Only the owner or a moderator can invite friends.')
  }
  if (input.circle.memberIds.includes(input.inviteeUid)) {
    throw new Error('They’re already in this circle.')
  }
  if (input.inviteeUid === input.createdBy) {
    throw new Error('You can’t invite yourself.')
  }

  const token = directInviteId(input.circle.id, input.inviteeUid)
  const supabase = getSupabase()
  const { data: existingSnap } = await supabase.from('circle_invites').select('*').eq('token', token).maybeSingle()
  if (existingSnap) {
    const existing = mapInvite(existingSnap as InviteRow)
    if (existing.status === 'pending') {
      throw new Error('Invite already sent — waiting for them to accept.')
    }
  }

  const now = new Date()
  const expires = new Date(now)
  expires.setDate(expires.getDate() + (input.daysValid ?? 14))
  const row = {
    token,
    circle_id: input.circle.id,
    circle_name: input.circle.name,
    created_by: input.createdBy,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    used_by: [] as string[],
    invitee_uid: input.inviteeUid,
    status: 'pending' as const,
    responded_at: null as string | null,
  }
  const { data, error } = await supabase.from('circle_invites').upsert(row).select('*').single()
  if (error) throw error

  try {
    const inviter = await getCloudProfile(input.createdBy)
    await createNotification({
      uid: input.inviteeUid,
      kind: 'circle_invite',
      title: 'Circle invite',
      body: `${inviter?.displayName || 'A friend'} invited you to “${input.circle.name}”.`,
      href: '/friends#invites',
      meta: { circleId: input.circle.id, token },
    })
  } catch {
    // Invite is saved even if the bell ping fails
  }

  return mapInvite(data as InviteRow)
}

export async function getCircleInvite(token: string): Promise<CircleInvite | null> {
  const { data, error } = await getSupabase().from('circle_invites').select('*').eq('token', token).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapInvite(data as InviteRow)
}

export async function listMyPendingCircleInvites(uid: string): Promise<CircleInvite[]> {
  const { data, error } = await getSupabase()
    .from('circle_invites')
    .select('*')
    .eq('invitee_uid', uid)
    .eq('status', 'pending')
  if (error) throw error
  const now = Date.now()
  return (data || [])
    .map((d) => mapInvite(d as InviteRow))
    .filter((inv) => new Date(inv.expiresAt).getTime() >= now)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function subscribeMyPendingCircleInvites(
  uid: string,
  onChange: (items: CircleInvite[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void listMyPendingCircleInvites(uid)
      .then((items) => {
        if (!cancelled) onChange(items)
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  refresh()

  const channel = supabase
    .channel(`circle_invites:${uid}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'circle_invites', filter: `invitee_uid=eq.${uid}` },
      refresh,
    )
    .subscribe()

  return () => {
    cancelled = true
    void supabase.removeChannel(channel)
  }
}

export async function listOutgoingPendingForCircle(
  circleId: string,
  createdBy: string,
): Promise<CircleInvite[]> {
  const { data, error } = await getSupabase()
    .from('circle_invites')
    .select('*')
    .eq('created_by', createdBy)
    .eq('circle_id', circleId)
    .eq('status', 'pending')
  if (error) throw error
  return (data || []).map((d) => mapInvite(d as InviteRow))
}

async function joinFromInvite(invite: CircleInvite, uid: string): Promise<CircleGroup> {
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    throw new Error('That invite has expired.')
  }
  if (invite.status === 'declined') {
    throw new Error('That invite was declined.')
  }
  const circle = await getCircle(invite.circleId)
  if (!circle) throw new Error('That circle no longer exists.')
  if (circle.memberIds.includes(uid)) {
    return circle
  }
  const joined = await joinCircleMember(circle, uid)
  const usedBy = [...new Set([...(invite.usedBy || []), uid])]
  const { error } = await getSupabase()
    .from('circle_invites')
    .update({
      used_by: usedBy,
      status: 'accepted',
      responded_at: new Date().toISOString(),
    })
    .eq('token', invite.token)
  if (error) throw error
  const joiner = await getCloudProfile(uid)
  await createNotification({
    uid: invite.createdBy,
    kind: 'circle_joined',
    title: 'Someone joined your circle',
    body: `${joiner?.displayName || 'A friend'} joined “${invite.circleName}”.`,
    href: `/circles?id=${invite.circleId}`,
    meta: { circleId: invite.circleId },
  })
  return joined
}

export async function acceptCircleInvite(token: string, uid: string): Promise<CircleGroup> {
  const invite = await getCircleInvite(token)
  if (!invite) throw new Error('That invite isn’t valid.')
  if (invite.inviteeUid && invite.inviteeUid !== uid) {
    throw new Error('This invite was sent to someone else.')
  }
  return joinFromInvite(invite, uid)
}

export async function declineCircleInvite(token: string, uid: string): Promise<void> {
  const invite = await getCircleInvite(token)
  if (!invite) throw new Error('That invite isn’t valid.')
  if (invite.inviteeUid !== uid) throw new Error('This invite was sent to someone else.')
  if (invite.status !== 'pending') return
  const { error } = await getSupabase()
    .from('circle_invites')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
    })
    .eq('token', token)
  if (error) throw error
}
