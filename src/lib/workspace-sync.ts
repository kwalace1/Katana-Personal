import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { WORKSPACE_COLLECTIONS, localDb } from '@/lib/local-db'

const LAST_SYNC_KEY = 'katana-personal:workspace-last-sync'
const MERGE_DONE_KEY = 'katana-personal:workspace-merge-done'
const SYNC_TIMEOUT_MS = 45_000

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

async function writeCollection(cloudUid: string, collection: string, items: unknown[], updatedAt: string) {
  const clean = sanitizeForFirestore(items)
  await setDoc(collectionRef(cloudUid, collection), {
    items: clean,
    updatedAt,
  } satisfies CollectionDoc)
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

/** Upload this device’s workspace to cloud (overwrites cloud collections). */
export async function pushWorkspaceToCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const now = new Date().toISOString()
    let count = 0
    for (const collection of SYNC_COLLECTIONS) {
      const items = localDb.list(collection, c.localUserId)
      count += items.length
      await writeCollection(c.cloudUid, collection, items, now)
    }
    await setDoc(metaRef(c.cloudUid), {
      updatedAt: now,
      hasData: count > 0,
      localUserId: c.localUserId,
    })
    localStorage.setItem(`${LAST_SYNC_KEY}:${c.cloudUid}`, now)
    markWorkspaceMergeDone(c.cloudUid)
    setStatus({ busy: false, lastSyncedAt: now, error: null })
  })
}

/** Download cloud workspace onto this device (replaces local collections). */
export async function pullWorkspaceFromCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const now = new Date().toISOString()
    for (const collection of SYNC_COLLECTIONS) {
      const snap = await getDoc(collectionRef(c.cloudUid, collection))
      if (!snap.exists()) {
        localDb.replaceAll(collection, c.localUserId, [])
        continue
      }
      const data = snap.data() as CollectionDoc
      const items = Array.isArray(data.items) ? data.items : []
      localDb.replaceAll(collection, c.localUserId, items)
    }
    await localDb.flush()
    localStorage.setItem(`${LAST_SYNC_KEY}:${c.cloudUid}`, now)
    markWorkspaceMergeDone(c.cloudUid)
    setStatus({ busy: false, lastSyncedAt: now, error: null })
  })
}

/** Merge local + cloud per item (LWW by updated_at), write result both ways. */
export async function mergeWorkspaceBothWays(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) throw new Error('Not signed into Cloud yet.')
  await runLocked(async () => {
    const now = new Date().toISOString()
    let count = 0
    for (const collection of SYNC_COLLECTIONS) {
      const local = localDb.list(collection, c.localUserId)
      let remote: unknown[] = []
      try {
        const snap = await getDoc(collectionRef(c.cloudUid, collection))
        if (snap.exists()) {
          const data = snap.data() as CollectionDoc
          remote = Array.isArray(data.items) ? data.items : []
        }
      } catch {
        remote = []
      }
      const merged = mergeItems(local, remote)
      count += merged.length
      localDb.replaceAll(collection, c.localUserId, merged)
      await writeCollection(c.cloudUid, collection, merged, now)
    }
    await localDb.flush()
    await setDoc(metaRef(c.cloudUid), {
      updatedAt: now,
      hasData: count > 0,
      localUserId: c.localUserId,
    })
    localStorage.setItem(`${LAST_SYNC_KEY}:${c.cloudUid}`, now)
    markWorkspaceMergeDone(c.cloudUid)
    setStatus({ busy: false, lastSyncedAt: now, error: null })
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
  }, 2000)
}

/** On app focus / login — pull+merge if already linked. */
export async function syncWorkspaceNow(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  if (needsWorkspaceMergeChoice(c.cloudUid)) return
  await mergeWorkspaceBothWays(c)
}
