import { healthApi } from '@/modules/health/api'
import { listConnections } from './store'

export type IntegrationStatusSummary = {
  googleCalendar: boolean
  icsCalendar: boolean
  fitbit: boolean
  strava: boolean
  appleHealthImport: boolean
  calendarConnected: boolean
  healthConnected: boolean
}

/** Read-only snapshot for Settings, Calendar footer, etc. */
export function readIntegrationStatus(userId: string): IntegrationStatusSummary {
  const connections = listConnections(userId)
  const googleCalendar = connections.some((c) => c.provider === 'google_calendar' && c.status === 'connected')
  const icsCalendar = connections.some((c) => c.provider === 'ics_calendar' && c.status === 'connected')
  const fitbit = connections.some((c) => c.provider === 'fitbit' && c.status === 'connected')
  const strava = connections.some((c) => c.provider === 'strava' && c.status === 'connected')
  const appleHealthImport = healthApi
    .listSleep(userId)
    .some((s) => s.source === 'apple_health' || s.source === 'fitbit')

  return {
    googleCalendar,
    icsCalendar,
    fitbit,
    strava,
    appleHealthImport,
    calendarConnected: googleCalendar || icsCalendar,
    healthConnected: fitbit || strava || appleHealthImport,
  }
}
