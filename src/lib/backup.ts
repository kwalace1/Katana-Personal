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

function backupFilename(stamp = new Date()) {
  const label = stamp.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  return `My Katana — ${label}.katana`
}

export function backupBlob(profile: UserProfile): { blob: Blob; filename: string } {
  const backup = buildBackup(profile)
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/octet-stream' })
  return { blob, filename: backupFilename() }
}

export function downloadBackup(profile: UserProfile) {
  const { blob, filename } = backupBlob(profile)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Prefer native share (AirDrop / Files on iOS) when available; otherwise download. */
export async function shareOrDownloadBackup(profile: UserProfile): Promise<'shared' | 'downloaded'> {
  const { blob, filename } = backupBlob(profile)
  const file = new File([blob], filename, { type: 'application/octet-stream' })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  try {
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({
        files: [file],
        title: 'Katana backup',
        text: 'Your Katana space — open on another device and Bring a copy back.',
      })
      return 'shared'
    }
  } catch (err) {
    // User cancelled share — don't fall through to download
    if (err instanceof Error && err.name === 'AbortError') throw err
  }
  downloadBackup(profile)
  return 'downloaded'
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
