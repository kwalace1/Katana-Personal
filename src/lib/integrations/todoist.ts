import { isOAuthRedirect, openIntegrationOAuthPopup } from './oauth-popup'
import {
  connectOAuthProvider,
  getConnectionByProvider,
  markConnectionSync,
  upsertConnection,
} from './store'
import { mergeExternalTasks, type ExternalImportedTask } from './task-merge'
import type { IntegrationConnection, OAuthTokens } from './types'

export function todoistConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TODOIST_CLIENT_ID)
}

export function openTodoistOAuth(): Promise<OAuthTokens | { redirected: true }> {
  return openIntegrationOAuthPopup('/api/integrations/todoist', 'katana-todoist-oauth', 'katana-todoist')
}

async function fetchTodoistTasks(
  connection: IntegrationConnection,
): Promise<{ tasks: ExternalImportedTask[]; tokens?: OAuthTokens }> {
  const tokens = connection.config.oauthTokens
  if (!tokens?.access_token && !tokens?.refresh_token) throw new Error('Todoist not connected')

  const res = await fetch('/api/integrations/todoist/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: tokens.access_token || tokens.refresh_token,
      refresh_token: tokens.refresh_token || tokens.access_token,
    }),
  })
  const json = (await res.json()) as {
    tasks?: ExternalImportedTask[]
    access_token?: string
    refresh_token?: string
    expiry_date?: number
    error?: string
  }
  if (!res.ok) throw new Error(json.error || 'Todoist sync failed')

  const access = json.access_token || tokens.access_token || tokens.refresh_token
  const nextTokens: OAuthTokens | undefined = access
    ? {
        access_token: access,
        refresh_token: json.refresh_token || access,
        expiry_date: json.expiry_date || tokens.expiry_date,
      }
    : undefined

  return { tasks: json.tasks || [], tokens: nextTokens }
}

export async function syncTodoist(userId: string): Promise<number> {
  const connection = getConnectionByProvider(userId, 'todoist')
  if (!connection?.config.oauthTokens) return 0

  try {
    const { tasks, tokens } = await fetchTodoistTasks(connection)
    if (tokens) {
      upsertConnection(userId, {
        ...connection,
        config: { ...connection.config, oauthTokens: tokens },
      })
    }
    const count = mergeExternalTasks(userId, 'todoist', tasks)
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

export async function connectAndSyncTodoist(userId: string): Promise<number | 'redirected'> {
  const result = await openTodoistOAuth()
  if (isOAuthRedirect(result)) return 'redirected'
  const connection = connectOAuthProvider(userId, 'todoist', result, 'Todoist')
  return syncTodoist(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}
