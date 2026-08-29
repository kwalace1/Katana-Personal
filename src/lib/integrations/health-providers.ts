import type { OAuthTokens } from './types'

export interface ImportedSleepNight {
  date: string
  hours: number
  bedtime?: string
  wake?: string
  source: 'fitbit'
}

export interface ImportedActivity {
  date: string
  activity: string
  duration_minutes: number
  notes?: string
}

export function fitbitConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FITBIT_CLIENT_ID)
}

export function openFitbitOAuth(): Promise<OAuthTokens> {
  return openOAuthPopup('fitbit', 'katana-fitbit-oauth')
}

export function openStravaOAuth(): Promise<OAuthTokens> {
  return openOAuthPopup('strava', 'katana-strava-oauth')
}

function openOAuthPopup(provider: 'fitbit' | 'strava', messageType: string): Promise<OAuthTokens> {
  return new Promise((resolve, reject) => {
    const url = `/api/integrations/${provider}?action=start&origin=${encodeURIComponent(window.location.origin)}`
    const popup = window.open(url, `katana-${provider}`, 'width=520,height=720')
    if (!popup) {
      reject(new Error('Popup blocked — allow popups to connect.'))
      return
    }

    const timeout = window.setTimeout(() => {
      cleanup()
      reject(new Error(`${provider} sign-in timed out.`))
    }, 120_000)

    function onMessage(ev: MessageEvent) {
      const data = ev.data as { type?: string; tokens?: OAuthTokens; error?: string }
      if (data?.type !== messageType) return
      cleanup()
      if (data.error) reject(new Error(data.error))
      else if (data.tokens?.refresh_token) resolve(data.tokens)
      else reject(new Error(`${provider} did not return a refresh token.`))
    }

    function cleanup() {
      window.clearTimeout(timeout)
      window.removeEventListener('message', onMessage)
    }

    window.addEventListener('message', onMessage)
  })
}

async function syncHealthProvider(
  userId: string,
  provider: 'fitbit' | 'strava',
  endpoint: string,
  apply: (payload: Record<string, unknown>) => number,
): Promise<number> {
  const { getConnectionByProvider, markConnectionSync, upsertConnection } = await import('./store')
  const connection = getConnectionByProvider(userId, provider)
  const tokens = connection?.config.oauthTokens
  if (!tokens?.refresh_token) return 0

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refresh_token: tokens.refresh_token,
      access_token: tokens.access_token,
      expiry_date: tokens.expiry_date,
    }),
  })
  const json = (await res.json()) as Record<string, unknown>
  if (!res.ok) throw new Error(String(json.error || 'Sync failed'))

  if (json.access_token && tokens.refresh_token) {
    upsertConnection(userId, {
      ...connection!,
      config: {
        ...connection!.config,
        oauthTokens: {
          access_token: String(json.access_token),
          refresh_token: tokens.refresh_token,
          expiry_date: Number(json.expiry_date || tokens.expiry_date),
        },
      },
    })
  }

  const count = apply(json)
  markConnectionSync(userId, connection!.id, {
    lastSyncAt: new Date().toISOString(),
    lastError: null,
    status: 'connected',
  })
  return count
}

export async function syncFitbit(userId: string): Promise<number> {
  const { healthApi } = await import('@/modules/health/api')
  return syncHealthProvider(userId, 'fitbit', '/api/integrations/fitbit/sync', (json) => {
    const sleep = (json.sleep as ImportedSleepNight[]) || []
    const workouts = (json.workouts as ImportedActivity[]) || []
    return (
      healthApi.importSleepNights(userId, sleep.map((s) => ({ ...s, source: 'fitbit' as const }))) +
      healthApi.importWorkouts(userId, workouts.map((w) => ({ ...w, notes: w.notes || 'Imported from Fitbit' })))
    )
  })
}

export async function syncStrava(userId: string): Promise<number> {
  const { healthApi } = await import('@/modules/health/api')
  return syncHealthProvider(userId, 'strava', '/api/integrations/strava/sync', (json) => {
    const workouts = (json.workouts as ImportedActivity[]) || []
    return healthApi.importWorkouts(
      userId,
      workouts.map((w) => ({ ...w, notes: w.notes || 'Imported from Strava' })),
    )
  })
}

export async function connectAndSyncFitbit(userId: string): Promise<number> {
  const { connectOAuthProvider, markConnectionSync } = await import('./store')
  const tokens = await openFitbitOAuth()
  const connection = connectOAuthProvider(userId, 'fitbit', tokens, 'Fitbit')
  return syncFitbit(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}

export async function connectAndSyncStrava(userId: string): Promise<number> {
  const { connectOAuthProvider, markConnectionSync } = await import('./store')
  const tokens = await openStravaOAuth()
  const connection = connectOAuthProvider(userId, 'strava', tokens, 'Strava')
  return syncStrava(userId).catch((err) => {
    markConnectionSync(userId, connection.id, {
      lastError: err instanceof Error ? err.message : 'Sync failed',
      status: 'error',
    })
    throw err
  })
}

export function stravaConfigured(): boolean {
  return Boolean(import.meta.env.VITE_STRAVA_CLIENT_ID)
}
