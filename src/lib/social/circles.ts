import { getSupabase } from '@/lib/supabase'
import { createId } from '@/lib/id'
import type { CircleChallenge, CircleGroup } from './types'

type CircleRow = {
  id: string
  name: string
  owner_id: string
  member_ids: string[]
  moderator_ids?: string[] | null
  challenge?: CircleChallenge | null
  created_at: string
  updated_at: string
}

function mapCircle(row: CircleRow): CircleGroup {
  return normalizeCircle({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    memberIds: row.member_ids || [],
    moderatorIds: row.moderator_ids || [],
    challenge: row.challenge ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })
}

export function normalizeCircle(raw: CircleGroup): CircleGroup {
  const memberIds = Array.isArray(raw.memberIds) ? raw.memberIds : []
  const moderatorIds = (Array.isArray(raw.moderatorIds) ? raw.moderatorIds : []).filter(
    (id) => memberIds.includes(id) && id !== raw.ownerId,
  )
  return { ...raw, memberIds, moderatorIds }
}

export function canManageCircle(circle: CircleGroup, uid: string): boolean {
  if (circle.ownerId === uid) return true
  return (circle.moderatorIds || []).includes(uid)
}

export function circleRole(circle: CircleGroup, uid: string): 'owner' | 'moderator' | 'member' {
  if (circle.ownerId === uid) return 'owner'
  if ((circle.moderatorIds || []).includes(uid)) return 'moderator'
  return 'member'
}

export async function createCircle(input: {
  name: string
  ownerId: string
  memberIds?: string[]
}): Promise<CircleGroup> {
  const now = new Date().toISOString()
  const memberIds = Array.from(new Set([input.ownerId, ...(input.memberIds || [])]))
  const id = createId()
  const row = {
    id,
    name: input.name.trim() || 'Circle',
    owner_id: input.ownerId,
    member_ids: memberIds,
    moderator_ids: [] as string[],
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await getSupabase().from('circles').insert(row).select('*').single()
  if (error) throw error
  return mapCircle(data as CircleRow)
}

export async function listMyCircles(uid: string): Promise<CircleGroup[]> {
  const { data, error } = await getSupabase().from('circles').select('*').contains('member_ids', [uid])
  if (error) throw error
  return (data || [])
    .map((d) => mapCircle(d as CircleRow))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function getCircle(id: string): Promise<CircleGroup | null> {
  const { data, error } = await getSupabase().from('circles').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapCircle(data as CircleRow)
}

export async function renameCircle(circle: CircleGroup, name: string, actorUid: string): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can rename this circle.')
  }
  const { error } = await getSupabase()
    .from('circles')
    .update({ name: name.trim() || 'Circle', updated_at: new Date().toISOString() })
    .eq('id', circle.id)
  if (error) throw error
}

export async function setCircleMembers(
  circle: CircleGroup,
  memberIds: string[],
  actorUid: string,
): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can change members.')
  }
  const unique = Array.from(new Set(memberIds))
  if (unique.length === 0) throw new Error('A circle needs at least one member.')
  if (!unique.includes(circle.ownerId)) {
    throw new Error('Can’t remove the circle owner.')
  }
  const moderatorIds = (circle.moderatorIds || []).filter(
    (id) => unique.includes(id) && id !== circle.ownerId,
  )
  const { error } = await getSupabase()
    .from('circles')
    .update({
      member_ids: unique,
      moderator_ids: moderatorIds,
      updated_at: new Date().toISOString(),
    })
    .eq('id', circle.id)
  if (error) throw error
}

export async function setCircleModerators(
  circle: CircleGroup,
  moderatorIds: string[],
  actorUid: string,
): Promise<void> {
  if (!canManageCircle(circle, actorUid)) {
    throw new Error('Only the owner or a moderator can change moderators.')
  }
  const next = Array.from(new Set(moderatorIds)).filter(
    (id) => circle.memberIds.includes(id) && id !== circle.ownerId,
  )
  const { error } = await getSupabase()
    .from('circles')
    .update({ moderator_ids: next, updated_at: new Date().toISOString() })
    .eq('id', circle.id)
  if (error) throw error
}

export async function leaveCircle(circle: CircleGroup, uid: string): Promise<void> {
  if (circle.ownerId === uid) {
    throw new Error('Owners can’t leave — delete the circle or transfer ownership later.')
  }
  const nextMembers = circle.memberIds.filter((id) => id !== uid)
  const nextMods = (circle.moderatorIds || []).filter((id) => id !== uid && nextMembers.includes(id))
  const { error } = await getSupabase()
    .from('circles')
    .update({
      member_ids: nextMembers,
      moderator_ids: nextMods,
      updated_at: new Date().toISOString(),
    })
    .eq('id', circle.id)
  if (error) throw error
}

export async function joinCircleMember(circle: CircleGroup, uid: string): Promise<CircleGroup> {
  if (circle.memberIds.includes(uid)) return normalizeCircle(circle)
  const nextMembers = [...circle.memberIds, uid]
  const { error } = await getSupabase()
    .from('circles')
    .update({ member_ids: nextMembers, updated_at: new Date().toISOString() })
    .eq('id', circle.id)
  if (error) throw error
  return normalizeCircle({ ...circle, memberIds: nextMembers })
}

export async function deleteCircle(id: string, actorUid: string, ownerId: string): Promise<void> {
  if (actorUid !== ownerId) {
    throw new Error('Only the owner can delete this circle.')
  }
  const { error } = await getSupabase().from('circles').delete().eq('id', id)
  if (error) throw error
}

export async function setCircleChallenge(
  id: string,
  challenge: CircleChallenge | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('circles')
    .update({ challenge, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
