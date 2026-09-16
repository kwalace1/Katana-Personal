export type IntegrationProvider =
  | 'google_calendar'
  | 'ics_calendar'
  | 'outlook_calendar'
  | 'google_tasks'
  | 'todoist'
  | 'fitbit'
  | 'strava'

export type IntegrationStatus = 'connected' | 'error' | 'disconnected'

export interface OAuthTokens {
  access_token: string
  refresh_token: string
  expiry_date: number
}

export type GoogleCalendarTokens = OAuthTokens

export interface IntegrationConnection {
  id: string
  provider: IntegrationProvider
  label: string
  status: IntegrationStatus
  lastSyncAt: string | null
  lastError: string | null
  config: {
    calendarId?: string
    icsUrl?: string
    googleTokens?: GoogleCalendarTokens
    oauthTokens?: OAuthTokens
  }
}

export interface ExternalCalendarEvent {
  external_id: string
  title: string
  notes: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string
}

export interface IntegrationConnector {
  provider: IntegrationProvider
  label: string
  description: string
  reads: string
  writes: string
  sync(userId: string, connection: IntegrationConnection): Promise<{ imported: number; error?: string }>
}
