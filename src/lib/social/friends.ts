import { getSupabase } from '@/lib/supabase'
import {
  DEFAULT_SHARE_PREFS,
  type CloudProfile,
  type Friendship,
  type SharePrefs,
} from './types'
import { createNotification } from './notifications'

export type Unsubscribe = () => void

function codeFromUid(uid: string) {
  return uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase().padEnd(6, 'X')
}

function pairId(a: string, b: string) {
  return [a, b].sort().join('_')
}

function blockId(blocker: string, blocked: string) {
  return `${blocker}_${blocked}`
}

type ProfileRow = {
  uid: string
  email: string
  display_name: string
  friend_code: string
  photo_url?: string | null
  bio?: string | null
  share_prefs?: SharePrefs | null
  created_at: string
  updated_at: string
}

function mapProfile(row: ProfileRow): CloudProfile {
  return {
    uid: row.uid,
    email: row.email || '',
    displayName: row.display_name || 'Friend',
    friendCode: row.friend_code,
    photoURL: row.photo_url ?? null,
    bio: row.bio ?? null,
    sharePrefs: { ...DEFAULT_SHARE_PREFS, ...(row.share_prefs || {}) },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type FriendshipRow = {
  id: string
  a: string
  b: string
  status: Friendship['status']
  requested_by: string
  created_at: string
  updated_at: string
}

function mapFriendship(row: FriendshipRow): Friendship {
  return {
    id: row.id,
    a: row.a,
    b: row.b,
    status: row.status,
    requestedBy: row.requested_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Public Add-me invite URL for a friend code. */
export function getAddMeUrl(friendCode: string, origin = typeof window !== 'undefined' ? window.location.origin : ''): string {
  return `${origin}/invite/friend/${friendCode}`
}

/** Share or copy Add-me link — returns how it was delivered. */
export async function shareAddMeLink(friendCode: string): Promise<'shared' | 'copied'> {
  const url = getAddMeUrl(friendCode)
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: 'Add me on Katana',
        text: 'Join me on Katana Personal',
        url,
      })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }
  await navigator.clipboard.writeText(url)
  return 'copied'
}

export async function ensureCloudProfile(input: {
  uid: string
  email: string
  displayName: string
}): Promise<CloudProfile> {
  const supabase = getSupabase()
  const { data: existing, error: getErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', input.uid)
    .maybeSingle()
  if (getErr) throw getErr
  if (existing) return mapProfile(existing as ProfileRow)

  const now = new Date().toISOString()
  const friendCode = codeFromUid(input.uid)
  const row = {
    uid: input.uid,
    email: input.email,
    display_name: input.displayName.trim() || 'Friend',
    friend_code: friendCode,
    share_prefs: { ...DEFAULT_SHARE_PREFS },
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase.from('profiles').insert(row).select('*').single()
  if (error) throw error
  await supabase.from('friend_codes').upsert({ code: friendCode, uid: input.uid })
  return mapProfile(data as ProfileRow)
}

export async function getCloudProfile(uid: string): Promise<CloudProfile | null> {
  const { data, error } = await getSupabase().from('profiles').select('*').eq('uid', uid).maybeSingle()
  if (error) throw error
  if (!data) return null
  return mapProfile(data as ProfileRow)
}

export async function getCloudProfiles(uids: string[]): Promise<CloudProfile[]> {
  const unique = Array.from(new Set(uids.filter(Boolean)))
  if (unique.length === 0) return []
  const { data, error } = await getSupabase().from('profiles').select('*').in('uid', unique)
  if (error) throw error
  return (data || []).map((row) => mapProfile(row as ProfileRow))
}

export type FriendshipRelation = 'self' | 'friends' | 'pending_out' | 'pending_in' | 'none'

export function friendshipRelation(
  selfUid: string,
  otherUid: string,
  friendships: Friendship[],
): FriendshipRelation {
  if (selfUid === otherUid) return 'self'
  const row = friendships.find((f) => f.a === otherUid || f.b === otherUid)
  if (!row) return 'none'
  if (row.status === 'accepted') return 'friends'
  if (row.requestedBy === selfUid) return 'pending_out'
  return 'pending_in'
}

export async function updateCloudProfile(
  uid: string,
  patch: Partial<Pick<CloudProfile, 'displayName' | 'sharePrefs' | 'photoURL' | 'bio'>>,
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.displayName != null) row.display_name = patch.displayName
  if (patch.sharePrefs != null) row.share_prefs = patch.sharePrefs
  if (patch.photoURL !== undefined) row.photo_url = patch.photoURL
  if (patch.bio !== undefined) row.bio = patch.bio
  const { error } = await getSupabase().from('profiles').update(row).eq('uid', uid)
  if (error) throw error
}

/** Upload a square-ish avatar into the together bucket; stores the object path on the profile. */
export async function uploadProfilePhoto(uid: string, file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose a photo')
  if (file.size > 5 * 1024 * 1024) throw new Error('Photos must be under 5 MB')
  const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
  const objectPath = `${uid}/profile/avatar.${ext}`
  const supabase = getSupabase()
  const { error: upErr } = await supabase.storage.from('together').upload(objectPath, file, {
    contentType: file.type,
    upsert: true,
  })
  if (upErr) throw upErr
  await updateCloudProfile(uid, { photoURL: objectPath })
  return objectPath
}

/** Resolve a stored photo path (or absolute URL) to a displayable URL. */
export async function resolveProfilePhotoUrl(photo: string | null | undefined): Promise<string | null> {
  if (!photo) return null
  if (/^https?:\/\//i.test(photo)) return photo
  const path = photo.replace(/^together\//, '')
  const { data, error } = await getSupabase().storage.from('together').createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function findUidByFriendCode(code: string): Promise<string | null> {
  const normalized = code.trim().toUpperCase()
  if (!normalized) return null
  const { data, error } = await getSupabase()
    .from('friend_codes')
    .select('uid')
    .eq('code', normalized)
    .maybeSingle()
  if (error) throw error
  return data?.uid ?? null
}

export async function isBlockedEither(a: string, b: string): Promise<boolean> {
  const supabase = getSupabase()
  const ids = [blockId(a, b), blockId(b, a)]
  const { data, error } = await supabase.from('blocks').select('id').in('id', ids)
  if (error) throw error
  return (data || []).length > 0
}

export async function blockUser(blocker: string, blocked: string): Promise<void> {
  if (blocker === blocked) throw new Error('That’s you.')
  const supabase = getSupabase()
  const { error } = await supabase.from('blocks').upsert({
    id: blockId(blocker, blocked),
    blocker,
    blocked,
    created_at: new Date().toISOString(),
  })
  if (error) throw error
  const friendshipId = pairId(blocker, blocked)
  await supabase.from('friendships').delete().eq('id', friendshipId)
}

export async function listBlockedIds(blocker: string): Promise<string[]> {
  const { data, error } = await getSupabase().from('blocks').select('blocked').eq('blocker', blocker)
  if (error) throw error
  return (data || []).map((d) => d.blocked as string)
}

export async function requestFriend(fromUid: string, toUid: string): Promise<Friendship> {
  if (fromUid === toUid) throw new Error('That’s you.')
  if (await isBlockedEither(fromUid, toUid)) {
    throw new Error('You can’t connect with that person.')
  }
  const id = pairId(fromUid, toUid)
  const supabase = getSupabase()
  const { data: existing } = await supabase.from('friendships').select('*').eq('id', id).maybeSingle()
  const now = new Date().toISOString()
  if (existing) {
    const data = mapFriendship(existing as FriendshipRow)
    if (data.status === 'accepted') throw new Error('You’re already friends.')
    if (data.status === 'pending') throw new Error('Friend request already pending.')
  }
  const sorted = [fromUid, toUid].sort()
  const row = {
    id,
    a: sorted[0],
    b: sorted[1],
    status: 'pending' as const,
    requested_by: fromUid,
    created_at: now,
    updated_at: now,
  }
  const { data, error } = await supabase.from('friendships').upsert(row).select('*').single()
  if (error) throw error
  const from = await getCloudProfile(fromUid)
  await createNotification({
    uid: toUid,
    kind: 'friend_request',
    title: 'Friend request',
    body: `${from?.displayName || 'Someone'} sent you a friend request.`,
    href: '/social?tab=friends#invites',
    meta: { fromUid },
  })
  return mapFriendship(data as FriendshipRow)
}

export async function acceptFriend(uid: string, friendshipId: string): Promise<void> {
  const supabase = getSupabase()
  const { data: snap, error } = await supabase.from('friendships').select('*').eq('id', friendshipId).maybeSingle()
  if (error) throw error
  if (!snap) throw new Error('Request not found.')
  const data = mapFriendship(snap as FriendshipRow)
  if (data.a !== uid && data.b !== uid) throw new Error('Not your request.')
  if (data.requestedBy === uid) throw new Error('Waiting on them to accept.')
  const { error: updErr } = await supabase
    .from('friendships')
    .update({ status: 'accepted', updated_at: new Date().toISOString() })
    .eq('id', friendshipId)
  if (updErr) throw updErr
  const accepter = await getCloudProfile(uid)
  await createNotification({
    uid: data.requestedBy,
    kind: 'friend_accepted',
    title: 'Friend request accepted',
    body: `${accepter?.displayName || 'Someone'} accepted your request.`,
    href: '/social?tab=friends',
  })
}

export async function removeFriendship(uid: string, friendshipId: string): Promise<void> {
  const supabase = getSupabase()
  const { data: snap } = await supabase.from('friendships').select('*').eq('id', friendshipId).maybeSingle()
  if (!snap) return
  const data = mapFriendship(snap as FriendshipRow)
  if (data.a !== uid && data.b !== uid) throw new Error('Not your friendship.')
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId)
  if (error) throw error
}

export async function listFriendships(uid: string): Promise<Friendship[]> {
  const supabase = getSupabase()
  const [q1, q2] = await Promise.all([
    supabase.from('friendships').select('*').eq('a', uid),
    supabase.from('friendships').select('*').eq('b', uid),
  ])
  if (q1.error) throw q1.error
  if (q2.error) throw q2.error
  const map = new Map<string, Friendship>()
  for (const row of [...(q1.data || []), ...(q2.data || [])]) {
    const f = mapFriendship(row as FriendshipRow)
    map.set(f.id, f)
  }
  return [...map.values()].sort((x, y) => y.updatedAt.localeCompare(x.updatedAt))
}

async function fetchFriendshipsMerged(uid: string): Promise<Friendship[]> {
  return listFriendships(uid)
}

/** Live friendship list — Realtime + initial fetch. */
export function subscribeFriendships(
  uid: string,
  onChange: (items: Friendship[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  const supabase = getSupabase()
  let cancelled = false

  const refresh = () => {
    void fetchFriendshipsMerged(uid)
      .then((items) => {
        if (!cancelled) onChange(items)
      })
      .catch((err) => onError?.(err instanceof Error ? err : new Error(String(err))))
  }

  refresh()

  const topic = `friendships:${uid}:${crypto.randomUUID?.() || String(Date.now())}`
  try {
    const channel = supabase
      .channel(topic)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `a=eq.${uid}` },
        refresh,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friendships', filter: `b=eq.${uid}` },
        refresh,
      )
      .subscribe()

    return () => {
      cancelled = true
      void supabase.removeChannel(channel)
    }
  } catch (err) {
    console.warn('Realtime friendships unavailable; polling only', err)
    onError?.(err instanceof Error ? err : new Error(String(err)))
    return () => {
      cancelled = true
    }
  }
}

export async function listFriendProfiles(uid: string): Promise<CloudProfile[]> {
  const friendships = await listFriendships(uid)
  const blocked = new Set(await listBlockedIds(uid))
  const accepted = friendships.filter((f) => f.status === 'accepted')
  const ids = accepted
    .map((f) => (f.a === uid ? f.b : f.a))
    .filter((id) => !blocked.has(id))
  return getCloudProfiles(ids)
}

export type { SharePrefs }
