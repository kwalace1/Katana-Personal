import { getSupabase } from '@/lib/supabase'
import { WORKSPACE_COLLECTIONS, localDb } from '@/lib/local-db'

const LAST_SYNC_KEY = 'katana-personal:workspace-last-sync'
const MERGE_DONE_KEY = 'katana-personal:workspace-merge-done'
const SYNC_TIMEOUT_MS = 90_000
const MAX_COLLECTION_BYTES = 700_000

const SYNC_COLLECTIONS = WORKSPACE_COLLECTIONS.filter(
  (c) => c !== 'documents' && c !== 'ask_messages',
)

export type WorkspaceSyncStatus = {
  lastSyncedAt: string | null
  busy: boolean
  error: string | null
}

type CollectionDoc = {
  items: unknown[]
  updatedAt: string
}

type SyncContext = {
  cloudUid: string
  localUserId: string
}

let ctx: SyncContext | null = null
let pushTimer: ReturnType<typeof setTimeout> | null = null
let suppressDirty = false
let statusListeners = new Set<(s: WorkspaceSyncStatus) => void>()
let status: WorkspaceSyncStatus = { lastSyncedAt: null, busy: false, error: null }

function setStatus(patch: Partial<WorkspaceSyncStatus>) {
  status = { ...status, ...patch }
  for (const fn of statusListeners) fn(status)
}

export function getWorkspaceSyncStatus() {
  return status
}

export function subscribeWorkspaceSyncStatus(fn: (s: WorkspaceSyncStatus) => void) {
  statusListeners.add(fn)
  fn(status)
  return () => {
    statusListeners.delete(fn)
  }
}

export function registerWorkspaceSync(next: SyncContext | null) {
  ctx = next
  if (next) {
    const stored = localStorage.getItem(`${LAST_SYNC_KEY}:${next.cloudUid}`)
    setStatus({ lastSyncedAt: stored, error: null })
  } else {
    setStatus({ lastSyncedAt: null, busy: false, error: null })
  }
}

export function needsWorkspaceMergeChoice(cloudUid: string) {
  return localStorage.getItem(`${MERGE_DONE_KEY}:${cloudUid}`) !== '1'
}

export function markWorkspaceMergeDone(cloudUid: string) {
  localStorage.setItem(`${MERGE_DONE_KEY}:${cloudUid}`, '1')
}

/** Strip undefined so JSON/Postgres jsonb stays clean. */
export function sanitizeForFirestore<T>(value: T): T {
  if (value === undefined) return null as T
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeForFirestore(v)).filter((v) => v !== undefined) as T
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = sanitizeForFirestore(v)
  }
  return out as T
}

function approxBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size
  } catch {
    return JSON.stringify(value).length
  }
}

function fitItems(items: unknown[]): unknown[] {
  const clean = sanitizeForFirestore(items) as unknown[]
  if (approxBytes(clean) <= MAX_COLLECTION_BYTES) return clean
  const sorted = [...clean].sort((a, b) => rowStamp(b).localeCompare(rowStamp(a)))
  const kept: unknown[] = []
  for (const row of sorted) {
    const next = [...kept, row]
    if (approxBytes(next) > MAX_COLLECTION_BYTES) break
    kept.push(row)
  }
  return kept
}

function friendlyCloudError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code.includes('42501') || /permission|rls|policy|insufficient/i.test(msg)) {
    return 'Cloud blocked the write. Apply supabase/migrations SQL (RLS) in the Supabase SQL editor, then try again.'
  }
  if (/network|offline|fetch/i.test(msg)) {
    return 'Network issue — check connection and try again.'
  }
  if (/exceeds|too large|payload/i.test(msg)) {
    return 'Some data is too large to sync in one piece. Try Sync again, or use Save a copy.'
  }
  if (/timed out|timeout/i.test(msg)) {
    return 'Sync timed out. Check Wi‑Fi and try again.'
  }
  return msg || 'Couldn’t sync workspace'
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${SYNC_TIMEOUT_MS / 1000}s`)),
          SYNC_TIMEOUT_MS,
        )
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function rowStamp(row: unknown): string {
  if (!row || typeof row !== 'object') return ''
  const r = row as Record<string, unknown>
  if (typeof r.updated_at === 'string') return r.updated_at
  if (typeof r.updatedAt === 'string') return r.updatedAt
  if (typeof r.created_at === 'string') return r.created_at
  if (typeof r.createdAt === 'string') return r.createdAt
  return ''
}

type DeletionRow = {
  id: string
  collection: string
  item_id: string
  deleted_at: string
}

function isDeletionRow(row: unknown): row is DeletionRow {
  return Boolean(
    row &&
      typeof row === 'object' &&
      typeof (row as DeletionRow).id === 'string' &&
      typeof (row as DeletionRow).collection === 'string' &&
      typeof (row as DeletionRow).item_id === 'string',
  )
}

function mergeDeletions(local: unknown[], remote: unknown[]): DeletionRow[] {
  const byId = new Map<string, DeletionRow>()
  for (const row of [...remote, ...local]) {
    if (!isDeletionRow(row)) continue
    const existing = byId.get(row.id)
    if (!existing || (row.deleted_at || '') >= (existing.deleted_at || '')) {
      byId.set(row.id, row)
    }
  }
  return [...byId.values()]
}

function mergeItems(local: unknown[], remote: unknown[], deletedItemIds: Set<string>): unknown[] {
  const byId = new Map<string, unknown>()
  for (const row of remote) {
    if (row && typeof row === 'object' && 'id' in row && typeof (row as { id: unknown }).id === 'string') {
      byId.set((row as { id: string }).id, row)
    }
  }
  for (const row of local) {
    if (!row || typeof row !== 'object' || !('id' in row)) continue
    const id = (row as { id: string }).id
    if (typeof id !== 'string') continue
    const existing = byId.get(id)
    if (!existing) {
      byId.set(id, row)
      continue
    }
    const localT = rowStamp(row)
    const remoteT = rowStamp(existing)
    if (!remoteT || localT >= remoteT) byId.set(id, row)
  }
  if (deletedItemIds.size === 0) return [...byId.values()]
  return [...byId.values()].filter((row) => {
    if (!row || typeof row !== 'object' || !('id' in row)) return true
    const id = (row as { id: unknown }).id
    return typeof id !== 'string' || !deletedItemIds.has(id)
  })
}

/** One water log per date — keep the highest glass count, then newest stamp. */
function dedupeWaterByDate(items: unknown[]): unknown[] {
  const byDate = new Map<string, unknown>()
  for (const row of items) {
    if (!row || typeof row !== 'object') continue
    const r = row as { id?: unknown; date?: unknown; glasses?: unknown }
    if (typeof r.date !== 'string') continue
    const existing = byDate.get(r.date)
    if (!existing) {
      byDate.set(r.date, row)
      continue
    }
    const eg = Number((existing as { glasses?: unknown }).glasses) || 0
    const ng = Number(r.glasses) || 0
    if (ng > eg || (ng === eg && rowStamp(row) >= rowStamp(existing))) {
      byDate.set(r.date, row)
    }
  }
  return [...byDate.values()]
}

async function fetchAllRemote(cloudUid: string): Promise<Map<string, unknown[]>> {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('workspace_collections')
    .select('collection, items')
    .eq('user_id', cloudUid)
  if (error) throw error
  const map = new Map<string, unknown[]>()
  for (const collection of SYNC_COLLECTIONS) {
    map.set(collection, [])
  }
  for (const row of data || []) {
    const collection = row.collection as string
    const items = Array.isArray(row.items) ? (row.items as unknown[]) : []
    map.set(collection, items)
  }
  return map
}

async function commitWorkspace(
  cloudUid: string,
  localUserId: string,
  byCollection: Map<string, unknown[]>,
): Promise<{ now: string; count: number }> {
  const now = new Date().toISOString()
  const supabase = getSupabase()
  let count = 0
  const rows = SYNC_COLLECTIONS.map((collection) => {
    const items = fitItems(byCollection.get(collection) || [])
    count += items.length
    return {
      user_id: cloudUid,
      collection,
      items,
      updated_at: now,
    }
  })
  const { error } = await supabase.from('workspace_collections').upsert(rows)
  if (error) throw error
  const { error: metaErr } = await supabase.from('workspace_meta').upsert({
    user_id: cloudUid,
    updated_at: now,
    has_data: count > 0,
    local_user_id: localUserId,
  })
  if (metaErr) throw metaErr
  return { now, count }
}

export async function cloudWorkspaceHasData(cloudUid: string): Promise<boolean> {
  try {
    const supabase = getSupabase()
    const { data: meta } = await supabase
      .from('workspace_meta')
      .select('has_data')
      .eq('user_id', cloudUid)
      .maybeSingle()
    if (meta?.has_data) return true
    // Don't rely on tasks alone — many users only have health/habit data.
    const { data: rows } = await supabase
      .from('workspace_collections')
      .select('items')
      .eq('user_id', cloudUid)
    return (rows || []).some((row) => Array.isArray(row.items) && row.items.length > 0)
  } catch {
    return false
  }
}

export function localWorkspaceHasData(localUserId: string): boolean {
  for (const collection of SYNC_COLLECTIONS) {
    if (localDb.list(collection, localUserId).length > 0) return true
  }
  return false
}

async function runLocked(fn: () => Promise<void>): Promise<void> {
  suppressDirty = true
  setStatus({ busy: true, error: null })
  try {
    await withTimeout(fn(), 'Workspace sync')
  } catch (err) {
    const message = friendlyCloudError(err)
    setStatus({ busy: false, error: message })
    throw new Error(message)
  } finally {
    suppressDirty = false
  }
}

function finishOk(cloudUid: string, now: string) {
  localStorage.setItem(`${LAST_SYNC_KEY}:${cloudUid}`, now)
  markWorkspaceMergeDone(cloudUid)
  setStatus({ busy: false, lastSyncedAt: now, error: null })
}

export async function pushWorkspaceToCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    // Never blind-upload an empty device over a non-empty cloud workspace.
    let localCount = 0
    const map = new Map<string, unknown[]>()
    for (const collection of SYNC_COLLECTIONS) {
      const items = localDb.list(collection, c.localUserId)
      localCount += items.length
      map.set(collection, items)
    }
    if (localCount === 0) {
      const remote = await fetchAllRemote(c.cloudUid)
      let remoteCount = 0
      for (const items of remote.values()) remoteCount += items.length
      if (remoteCount > 0) {
        throw new Error(
          'This device has no personal data, but the cloud does. Use “Sync now” or “Use cloud copy” instead of uploading.',
        )
      }
    }
    const { now } = await commitWorkspace(c.cloudUid, c.localUserId, map)
    finishOk(c.cloudUid, now)
  })
}

export async function pullWorkspaceFromCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const remote = await fetchAllRemote(c.cloudUid)
    for (const collection of SYNC_COLLECTIONS) {
      localDb.replaceAll(collection, c.localUserId, remote.get(collection) || [])
    }
    await localDb.flush()
    const now = new Date().toISOString()
    finishOk(c.cloudUid, now)
  })
}

export async function mergeWorkspaceBothWays(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const remote = await fetchAllRemote(c.cloudUid)
    const mergedMap = new Map<string, unknown[]>()

    const mergedDeletions = mergeDeletions(
      localDb.list('deletions', c.localUserId),
      remote.get('deletions') || [],
    )
    const deletedByCollection = new Map<string, Set<string>>()
    for (const row of mergedDeletions) {
      let set = deletedByCollection.get(row.collection)
      if (!set) {
        set = new Set()
        deletedByCollection.set(row.collection, set)
      }
      set.add(row.item_id)
    }
    mergedMap.set('deletions', mergedDeletions)
    localDb.replaceAll('deletions', c.localUserId, mergedDeletions)

    for (const collection of SYNC_COLLECTIONS) {
      if (collection === 'deletions') continue
      const local = localDb.list(collection, c.localUserId)
      let merged = mergeItems(local, remote.get(collection) || [], deletedByCollection.get(collection) || new Set())
      if (collection === 'water_logs') {
        merged = dedupeWaterByDate(merged)
      }
      mergedMap.set(collection, merged)
      localDb.replaceAll(collection, c.localUserId, merged)
    }
    await localDb.flush()
    const { now } = await commitWorkspace(c.cloudUid, c.localUserId, mergedMap)
    finishOk(c.cloudUid, now)
  })
}

export function notifyWorkspaceDirty() {
  if (!ctx || suppressDirty) return
  if (needsWorkspaceMergeChoice(ctx.cloudUid)) return
  if (pushTimer) clearTimeout(pushTimer)
  // Merge on dirty so a sparse/empty device cannot wipe richer cloud data.
  pushTimer = setTimeout(() => {
    void mergeWorkspaceBothWays()
      .then(() => {
        void import('@/hooks/useLocalRefresh').then((m) => m.broadcastLocalRefresh())
      })
      .catch(() => {
        // optional while offline
      })
  }, 2500)
}

export async function syncWorkspaceNow(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  if (needsWorkspaceMergeChoice(c.cloudUid)) return
  await mergeWorkspaceBothWays(c)
}

// Keep type export for any leftover imports
export type { CollectionDoc }
