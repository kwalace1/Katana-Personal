import { doc, getDoc, writeBatch } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { WORKSPACE_COLLECTIONS, localDb } from '@/lib/local-db'

const LAST_SYNC_KEY = 'katana-personal:workspace-last-sync'
const MERGE_DONE_KEY = 'katana-personal:workspace-merge-done'
/** Generous for mobile networks; work itself should finish in a few seconds via batching. */
const SYNC_TIMEOUT_MS = 90_000
/** Soft cap per collection payload (~700KB) to avoid Firestore 1MB hard fail. */
const MAX_COLLECTION_BYTES = 700_000

/** Skip bulky / non-essential collections from cloud sync for reliability on Spark. */
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

function collectionRef(cloudUid: string, collection: string) {
  return doc(getDb(), 'workspaces', cloudUid, 'collections', collection)
}

function metaRef(cloudUid: string) {
  return doc(getDb(), 'workspaces', cloudUid, 'meta', 'info')
}

/** Firestore rejects undefined; strip recursively. */
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

/** Drop oldest rows until under size budget (keeps sync moving on large notes/journals). */
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

function friendlyFirestoreError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  const code =
    err && typeof err === 'object' && 'code' in err
      ? String((err as { code: unknown }).code)
      : ''
  if (code.includes('permission-denied') || /permission|insufficient/i.test(msg)) {
    return 'Cloud blocked the write. Publish firestore.rules in Firebase Console (workspaces + circle rules), then try again.'
  }
  if (code.includes('unavailable') || /network|offline/i.test(msg)) {
    return 'Network issue — check connection and try again.'
  }
  if (/exceeds|too large|1,?048,?576|invalid-argument/i.test(msg)) {
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

function mergeItems(local: unknown[], remote: unknown[]): unknown[] {
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
  return [...byId.values()]
}

async function fetchAllRemote(cloudUid: string): Promise<Map<string, unknown[]>> {
  const entries = await Promise.all(
    SYNC_COLLECTIONS.map(async (collection) => {
      try {
        const snap = await getDoc(collectionRef(cloudUid, collection))
        if (!snap.exists()) return [collection, [] as unknown[]] as const
        const data = snap.data() as CollectionDoc
        return [collection, Array.isArray(data.items) ? data.items : []] as const
      } catch {
        return [collection, [] as unknown[]] as const
      }
    }),
  )
  return new Map(entries)
}

async function commitWorkspace(
  cloudUid: string,
  localUserId: string,
  byCollection: Map<string, unknown[]>,
): Promise<{ now: string; count: number }> {
  const now = new Date().toISOString()
  const db = getDb()
  const batch = writeBatch(db)
  let count = 0
  for (const collection of SYNC_COLLECTIONS) {
    const items = fitItems(byCollection.get(collection) || [])
    count += items.length
    batch.set(collectionRef(cloudUid, collection), {
      items,
      updatedAt: now,
    } satisfies CollectionDoc)
  }
  batch.set(metaRef(cloudUid), {
    updatedAt: now,
    hasData: count > 0,
    localUserId,
  })
  await batch.commit()
  return { now, count }
}

export async function cloudWorkspaceHasData(cloudUid: string): Promise<boolean> {
  try {
    const snap = await getDoc(metaRef(cloudUid))
    if (snap.exists()) {
      const data = snap.data() as { hasData?: boolean; updatedAt?: string }
      if (data.hasData) return true
    }
    const tasks = await getDoc(collectionRef(cloudUid, 'tasks'))
    if (tasks.exists()) {
      const items = (tasks.data() as CollectionDoc).items
      return Array.isArray(items) && items.length > 0
    }
  } catch {
    return false
  }
  return false
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
    const message = friendlyFirestoreError(err)
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

/** Upload this device’s workspace to cloud (overwrites cloud collections). */
export async function pushWorkspaceToCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const map = new Map<string, unknown[]>()
    for (const collection of SYNC_COLLECTIONS) {
      map.set(collection, localDb.list(collection, c.localUserId))
    }
    const { now } = await commitWorkspace(c.cloudUid, c.localUserId, map)
    finishOk(c.cloudUid, now)
  })
}

/** Download cloud workspace onto this device (replaces local collections). */
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

/** Merge local + cloud per item (LWW by updated_at), write result both ways. */
export async function mergeWorkspaceBothWays(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const remote = await fetchAllRemote(c.cloudUid)
    const mergedMap = new Map<string, unknown[]>()
    for (const collection of SYNC_COLLECTIONS) {
      const local = localDb.list(collection, c.localUserId)
      const merged = mergeItems(local, remote.get(collection) || [])
      mergedMap.set(collection, merged)
      localDb.replaceAll(collection, c.localUserId, merged)
    }
    await localDb.flush()
    const { now } = await commitWorkspace(c.cloudUid, c.localUserId, mergedMap)
    finishOk(c.cloudUid, now)
  })
}

/** Debounced push after local edits (once merge choice is done). */
export function notifyWorkspaceDirty() {
  if (!ctx || suppressDirty) return
  if (needsWorkspaceMergeChoice(ctx.cloudUid)) return
  if (pushTimer) clearTimeout(pushTimer)
  pushTimer = setTimeout(() => {
    void pushWorkspaceToCloud().catch(() => {
      // optional while offline
    })
  }, 2500)
}

/** On app focus / login — pull+merge if already linked. */
export async function syncWorkspaceNow(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  if (needsWorkspaceMergeChoice(c.cloudUid)) return
  await mergeWorkspaceBothWays(c)
}
