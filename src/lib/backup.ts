import { localDb } from '@/lib/local-db'
import type { UserProfile } from '@/contexts/AuthContext'

export const BACKUP_VERSION = 1

export interface WorkspaceBackup {
  version: number
  exported_at: string
  app: 'katana-personal'
  profile: Pick<UserProfile, 'id' | 'display_name' | 'preferences'>
  collections: Record<string, unknown[]>
}

export function buildBackup(profile: UserProfile): WorkspaceBackup {
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    app: 'katana-personal',
    profile: {
      id: profile.id,
      display_name: profile.display_name,
      preferences: profile.preferences,
    },
    collections: localDb.exportAll(profile.id),
  }
}

export function downloadBackup(profile: UserProfile) {
  const backup = buildBackup(profile)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  a.href = url
  a.download = `My Katana — ${stamp}.katana`
  a.click()
  URL.revokeObjectURL(url)
}

export function parseBackup(raw: string): WorkspaceBackup {
  let parsed: WorkspaceBackup
  try {
    parsed = JSON.parse(raw) as WorkspaceBackup
  } catch {
    throw new Error('That doesn’t look like a Katana copy. Try another file.')
  }
  if (!parsed || parsed.app !== 'katana-personal' || !parsed.collections) {
    throw new Error('That doesn’t look like a Katana copy. Try another file.')
  }
  if (typeof parsed.version !== 'number') {
    throw new Error('That copy is incomplete. Try saving a new one from Settings.')
  }
  return parsed
}

export function restoreBackup(userId: string, backup: WorkspaceBackup) {
  localDb.importAll(userId, backup.collections)
}
