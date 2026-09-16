import { localDb } from '@/lib/local-db'

const LOCAL_PREFIXES = ['katana-personal:', 'katana-personal-']

function shouldWipeStorageKey(key: string) {
  return LOCAL_PREFIXES.some((prefix) => key.startsWith(prefix))
}

function wipeWebStorage(storage: Storage) {
  const keys: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key && shouldWipeStorageKey(key)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
}

function deleteIndexedDb(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

/** Wipe this device’s Katana workspace (IndexedDB + local flags). Does not touch cloud. */
export async function eraseLocalWorkspace(userId?: string | null) {
  if (userId) {
    localDb.clearAll(userId)
    await localDb.flush()
  }
  try {
    wipeWebStorage(localStorage)
  } catch {
    // ignore
  }
  try {
    wipeWebStorage(sessionStorage)
  } catch {
    // ignore
  }
  await deleteIndexedDb('katana-personal')
}

export function shouldWipeStorageKeyForTest(key: string) {
  return shouldWipeStorageKey(key)
}
