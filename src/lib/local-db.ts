import { createId } from './id'

const PREFIX = 'katana-personal:'
const DB_NAME = 'katana-personal'
const DB_VERSION = 1
const STORE = 'collections'
const MIGRATED_KEY = 'katana-personal:idb-migrated-v1'

export const WORKSPACE_COLLECTIONS = [
  'tasks',
  'task_lists',
  'events',
  'notes',
  'note_folders',
  'goals',
  'habits',
  'habit_logs',
  'journal_entries',
  'workouts',
  'water_logs',
  'nutrition_logs',
  'sleep_logs',
  'lift_exercises',
  'lift_sessions',
  'lift_sets',
  'training_splits',
  'body_weight_logs',
  'weight_goals',
  'documents',
  'ask_messages',
] as const

export type WorkspaceCollection = (typeof WORKSPACE_COLLECTIONS)[number]

type Cache = Map<string, unknown[]>

const memory: Cache = new Map()
let readyPromise: Promise<void> | null = null
let db: IDBDatabase | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
const dirty = new Set<string>()

function cacheKey(collection: string, userId: string) {
  return `${userId}::${collection}`
}

function legacyKey(collection: string, userId: string) {
  return `${PREFIX}${userId}:${collection}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const database = req.result
      if (!database.objectStoreNames.contains(STORE)) {
        database.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function idbGet(database: IDBDatabase, key: string): Promise<unknown[] | undefined> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)
    const req = store.get(key)
    req.onsuccess = () => resolve(req.result as unknown[] | undefined)
    req.onerror = () => reject(req.error)
  })
}

function idbPut(database: IDBDatabase, key: string, value: unknown[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function idbDelete(database: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

function readLegacy<T>(collection: string, userId: string): T[] {
  try {
    const raw = localStorage.getItem(legacyKey(collection, userId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

function scheduleFlush() {
  if (flushTimer) return
  flushTimer = setTimeout(() => {
    flushTimer = null
    void flushDirty().then(() => {
      try {
        // Dynamic import avoids circular deps with workspace-sync
        void import('@/lib/workspace-sync').then((m) => m.notifyWorkspaceDirty())
      } catch {
        // optional
      }
    })
  }, 50)
}

async function flushDirty() {
  if (!db || dirty.size === 0) return
  const keys = [...dirty]
  dirty.clear()
  for (const key of keys) {
    const rows = memory.get(key) || []
    try {
      await idbPut(db, key, rows)
    } catch (err) {
      console.warn('Could not save locally', err)
      dirty.add(key)
    }
  }
}

function ensureLoaded(collection: string, userId: string): unknown[] {
  const key = cacheKey(collection, userId)
  if (!memory.has(key)) memory.set(key, [])
  return memory.get(key)!
}

/**
 * Hydrate memory from IndexedDB (and one-time migrate from older browser storage).
 * Call once at app start before rendering the workspace.
 */
export async function initLocalDb(userIds: string[] = []): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  if (!readyPromise) {
    readyPromise = (async () => {
      db = await openDb()
      const migrated = localStorage.getItem(MIGRATED_KEY) === '1'

      // Discover user ids from session + any provided
      const ids = new Set(userIds.filter(Boolean))
      try {
        const session = localStorage.getItem('katana-personal:local-session')
        if (session) {
          const parsed = JSON.parse(session) as { id?: string }
          if (parsed.id) ids.add(parsed.id)
        }
      } catch {
        // ignore
      }

      for (const userId of ids) {
        for (const collection of WORKSPACE_COLLECTIONS) {
          const key = cacheKey(collection, userId)
          const fromIdb = await idbGet(db, key)
          if (Array.isArray(fromIdb) && fromIdb.length > 0) {
            memory.set(key, fromIdb)
            continue
          }
          if (!migrated) {
            const legacy = readLegacy(collection, userId)
            memory.set(key, legacy)
            if (legacy.length > 0) {
              await idbPut(db, key, legacy)
              localStorage.removeItem(legacyKey(collection, userId))
            }
          } else {
            memory.set(key, [])
          }
        }
      }

      if (!migrated) localStorage.setItem(MIGRATED_KEY, '1')
    })()
  }
  await readyPromise
}

/** Ensure a workspace user is loaded into memory (e.g. after restore). */
export async function ensureUserLoaded(userId: string): Promise<void> {
  await initLocalDb([userId])
  if (!db) return
  for (const collection of WORKSPACE_COLLECTIONS) {
    const key = cacheKey(collection, userId)
    if (memory.has(key)) continue
    const fromIdb = await idbGet(db, key)
    memory.set(key, Array.isArray(fromIdb) ? fromIdb : [])
  }
}

export const localDb = {
  list<T>(collection: string, userId: string): T[] {
    return [...(ensureLoaded(collection, userId) as T[])]
  },

  getById<T extends { id: string }>(collection: string, userId: string, id: string): T | null {
    return (ensureLoaded(collection, userId) as T[]).find((row) => row.id === id) ?? null
  },

  insert<T extends { id?: string }>(
    collection: string,
    userId: string,
    row: T,
  ): T & { id: string } {
    const rows = ensureLoaded(collection, userId) as Array<T & { id: string }>
    const next = { ...row, id: row.id || createId() } as T & { id: string }
    rows.push(next)
    memory.set(cacheKey(collection, userId), rows)
    dirty.add(cacheKey(collection, userId))
    scheduleFlush()
    return next
  },

  update<T extends { id: string }>(
    collection: string,
    userId: string,
    id: string,
    patch: Partial<T>,
  ): T | null {
    const rows = ensureLoaded(collection, userId) as T[]
    const index = rows.findIndex((row) => row.id === id)
    if (index < 0) return null
    const next = { ...rows[index], ...patch, id } as T
    rows[index] = next
    memory.set(cacheKey(collection, userId), rows)
    dirty.add(cacheKey(collection, userId))
    scheduleFlush()
    return next
  },

  remove(collection: string, userId: string, id: string): boolean {
    const rows = ensureLoaded(collection, userId) as Array<{ id: string }>
    const next = rows.filter((row) => row.id !== id)
    if (next.length === rows.length) return false
    memory.set(cacheKey(collection, userId), next)
    dirty.add(cacheKey(collection, userId))
    scheduleFlush()
    return true
  },

  replaceAll<T>(collection: string, userId: string, rows: T[]) {
    memory.set(cacheKey(collection, userId), [...rows])
    dirty.add(cacheKey(collection, userId))
    scheduleFlush()
  },

  exportAll(userId: string): Record<string, unknown[]> {
    const data: Record<string, unknown[]> = {}
    for (const collection of WORKSPACE_COLLECTIONS) {
      data[collection] = localDb.list(collection, userId)
    }
    return data
  },

  importAll(userId: string, data: Record<string, unknown[]>) {
    for (const collection of WORKSPACE_COLLECTIONS) {
      const rows = Array.isArray(data[collection]) ? data[collection] : []
      localDb.replaceAll(collection, userId, rows)
    }
  },

  clearAll(userId: string) {
    for (const collection of WORKSPACE_COLLECTIONS) {
      const key = cacheKey(collection, userId)
      memory.set(key, [])
      dirty.add(key)
      if (db) void idbDelete(db, key)
    }
    scheduleFlush()
  },

  async flush(): Promise<void> {
    await flushDirty()
  },
}
