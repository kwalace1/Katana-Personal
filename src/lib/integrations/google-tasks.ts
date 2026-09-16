import { openIntegrationOAuthPopup } from './oauth-popup'
import {
  connectOAuthProvider,
  getConnectionByProvider,
  markConnectionSync,
  upsertConnection,
} from './store'
import { mergeExternalTasks, type ExternalImportedTask } from './task-merge'
import type { IntegrationConnection, OAuthTokens } from './types'

export function googleTasksConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_TASKS_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

export function openGoogleTasksOAuth(): Promise<OAuthTokens> {
  return openIntegrationOAuthPopup(
    '/api/integrations/google-tasks',
    'katana-google-tasks-oauth',
    'katana-google-tasks',
  )
}

async function fetchGoogleTasks(
  connection: IntegrationConnection,
): Promise<{ tasks: ExternalImportedTask[]; tokens?: OAuthTokens }> {
  const tokens = connection.config.oauthTokens
  if (!tokens?.refresh_token) throw new Error('Google Tasks not connected')

  const res = await fetch('/api/integrations/google-tasks/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    }),
  })
  const json = (await res.json()) as {
    tasks?: ExternalImportedTask[]
    access_token?: string
    expiry_date?: number
    error?: string
  }
  if (!res.ok) throw new Error(json.error || 'Google Tasks sync failed')

  const nextTokens: OAuthTokens | undefined =
    json.access_token && tokens.refresh_token
      ? {
          access_token: json.access_token,
          refresh_token: tokens.refresh_token,
          expiry_date: json.expiry_date || tokens.expiry_date,
        }
      : undefined

  return { tasks: json.tasks || [], tokens: nextTokens }
}

export async function syncGoogleTasks(userId: string): Promise<number> {
  const connection = getConnectionByProvider(userId, 'google_tasks')
  if (!connection?.config.oauthTokens?.refresh_token) return 0

  try {
    const { tasks, tokens } = await fetchGoogleTasks(connection)
    if (tokens) {
      upsertConnection(userId, {
        ...connection,
        config: { ...connection.config, oauthTokens: tokens },
      })
    }
    const count = mergeExternalTasks(userId, 'google_tasks', tasks)
    markConnectionSync(userId, connection.id, {
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      status: 'connected',
    })
    return count
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Sync failed'
    markConnectionSync(userId, connection.id, { lastError: msg, status: 'error' })
    throw err
  }
}

export async function connectAndSyncGoogleTasks(userId: string): Promise<number> {
  const tokens = await openGoogleTasksOAuth()
  if (!tokens.refresh_token) {
    throw new Error('Google did not return a refresh token. Try again and approve Tasks access.')
  }
  const connection = connectOAuthProvider(userId, 'google_tasks', tokens, 'Google Tasks')
  return syncGoogleTasks(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}
