import { doc, getDoc, setDoc } from 'firebase/firestore'
import { getDb } from '@/lib/firebase'
import { WORKSPACE_COLLECTIONS, localDb } from '@/lib/local-db'

const LAST_SYNC_KEY = 'katana-personal:workspace-last-sync'
const MERGE_DONE_KEY = 'katana-personal:workspace-merge-done'

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

export async function cloudWorkspaceHasData(cloudUid: string): Promise<boolean> {
  try {
    const snap = await getDoc(metaRef(cloudUid))
    if (snap.exists()) {
      const data = snap.data() as { hasData?: boolean; updatedAt?: string }
      if (data.hasData) return true
    }
    // Probe one hot collection
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
  for (const collection of WORKSPACE_COLLECTIONS) {
    if (localDb.list(collection, localUserId).length > 0) return true
  }
  return false
}

/** Upload this device’s workspace to cloud (overwrites cloud collections). */
export async function pushWorkspaceToCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  setStatus({ busy: true, error: null })
  try {
    const now = new Date().toISOString()
    let count = 0
    for (const collection of WORKSPACE_COLLECTIONS) {
      const items = localDb.list(collection, c.localUserId)
      count += items.length
      await setDoc(collectionRef(c.cloudUid, collection), {
        items,
        updatedAt: now,
      } satisfies CollectionDoc)
    }
    await setDoc(metaRef(c.cloudUid), {
      updatedAt: now,
      hasData: count > 0,
      localUserId: c.localUserId,
    })
    localStorage.setItem(`${LAST_SYNC_KEY}:${c.cloudUid}`, now)
    markWorkspaceMergeDone(c.cloudUid)
    setStatus({ busy: false, lastSyncedAt: now, error: null })
  } catch (err) {
    setStatus({
      busy: false,
      error: err instanceof Error ? err.message : 'Couldn’t upload workspace',
    })
    throw err
  }
}

/** Download cloud workspace onto this device (replaces local collections). */
export async function pullWorkspaceFromCloud(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  setStatus({ busy: true, error: null })
  try {
    const now = new Date().toISOString()
    for (const collection of WORKSPACE_COLLECTIONS) {
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
  } catch (err) {
    setStatus({
      busy: false,
      error: err instanceof Error ? err.message : 'Couldn’t download workspace',
    })
    throw err
  }
}

/** Merge local + cloud per item (LWW by updated_at), write result both ways. */
export async function mergeWorkspaceBothWays(input?: SyncContext): Promise<void> {
  const c = input || ctx
  if (!c) return
  setStatus({ busy: true, error: null })
  try {
    const now = new Date().toISOString()
    let count = 0
    for (const collection of WORKSPACE_COLLECTIONS) {
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
      await setDoc(collectionRef(c.cloudUid, collection), {
        items: merged,
        updatedAt: now,
      } satisfies CollectionDoc)
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
  } catch (err) {
    setStatus({
      busy: false,
      error: err instanceof Error ? err.message : 'Couldn’t merge workspace',
    })
    throw err
  }
}

/** Debounced push after local edits (once merge choice is done). */
export function notifyWorkspaceDirty() {
  if (!ctx) return
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
