import { healthApi } from '@/modules/health/api'
import { listConnections } from './store'

export type IntegrationStatusSummary = {
  googleCalendar: boolean
  outlookCalendar: boolean
  icsCalendar: boolean
  googleTasks: boolean
  todoist: boolean
  appleHealthImport: boolean
  calendarConnected: boolean
  healthConnected: boolean
  tasksConnected: boolean
}

/** Read-only snapshot for Settings, Calendar footer, etc. */
export function readIntegrationStatus(userId: string): IntegrationStatusSummary {
  const connections = listConnections(userId)
  const googleCalendar = connections.some((c) => c.provider === 'google_calendar' && c.status === 'connected')
  const outlookCalendar = connections.some((c) => c.provider === 'outlook_calendar' && c.status === 'connected')
  const icsCalendar = connections.some((c) => c.provider === 'ics_calendar' && c.status === 'connected')
  const googleTasks = connections.some((c) => c.provider === 'google_tasks' && c.status === 'connected')
  const todoist = connections.some((c) => c.provider === 'todoist' && c.status === 'connected')
  const appleHealthImport = healthApi
    .listSleep(userId)
    .some((s) => s.source === 'apple_health' || s.source === 'fitbit')

  return {
    googleCalendar,
    outlookCalendar,
    icsCalendar,
    googleTasks,
    todoist,
    appleHealthImport,
    calendarConnected: googleCalendar || outlookCalendar || icsCalendar,
    healthConnected: appleHealthImport,
    tasksConnected: googleTasks || todoist,
  }
}
