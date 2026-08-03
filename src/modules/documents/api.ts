import { localDb } from '@/lib/local-db'
import { createId } from '@/lib/id'
import type { DocumentRecord } from './types'

const DOCS = 'documents'
const MAX_LOCAL_BYTES = 4 * 1024 * 1024

function now() {
  return new Date().toISOString()
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const documentsApi = {
  list(userId: string): DocumentRecord[] {
    return localDb.list<DocumentRecord>(DOCS, userId).sort((a, b) => b.created_at.localeCompare(a.created_at))
  },

  async upload(userId: string, file: File): Promise<DocumentRecord> {
    if (file.size > MAX_LOCAL_BYTES) {
      throw new Error('That file is a bit too large. Try something smaller.')
    }
    const data_url = await readFileAsDataUrl(file)
    const ts = now()
    return localDb.insert(DOCS, userId, {
      id: createId(),
      user_id: userId,
      name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size: file.size,
      data_url,
      created_at: ts,
      updated_at: ts,
    })
  },

  remove(userId: string, id: string): boolean {
    return localDb.remove(DOCS, userId, id)
  },

  update(userId: string, id: string, patch: Partial<Pick<DocumentRecord, 'name'>>): DocumentRecord | null {
    return localDb.update<DocumentRecord>(DOCS, userId, id, { ...patch, updated_at: now() })
  },

  get(userId: string, id: string): DocumentRecord | null {
    return localDb.getById<DocumentRecord>(DOCS, userId, id)
  },
}

export const storageApi = {
  validateUploadFile(file: File): { valid: boolean; error?: string } {
    if (file.size === 0) return { valid: false, error: 'That file looks empty' }
    if (file.size > MAX_LOCAL_BYTES) return { valid: false, error: 'That file is a bit too large' }
    return { valid: true }
  },
}
