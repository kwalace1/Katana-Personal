/**
 * OAuth helpers for CRM email/calendar integrations
 */

export type CrmOAuthProvider = 'gmail' | 'outlook' | 'google_calendar' | 'outlook_calendar'

export const CRM_OAUTH_SCOPES: Record<CrmOAuthProvider, { vendor: 'google' | 'microsoft'; scope: string }> = {
  gmail: {
    vendor: 'google',
    scope: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
  },
  google_calendar: {
    vendor: 'google',
    scope: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
  },
  outlook: {
    vendor: 'microsoft',
    scope: 'https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send offline_access',
  },
  outlook_calendar: {
    vendor: 'microsoft',
    scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
  },
}

export function getCrmOAuthStartUrl(integration: CrmOAuthProvider, returnPath = '/customer-success'): string {
  const params = new URLSearchParams({
    action: 'start',
    integration,
    return_to: returnPath,
  })
  return `/api/crm-oauth?${params.toString()}`
}

export function integrationLabel(integration: CrmOAuthProvider): string {
  switch (integration) {
    case 'gmail':
      return 'Gmail'
    case 'google_calendar':
      return 'Google Calendar'
    case 'outlook':
      return 'Outlook Mail'
    case 'outlook_calendar':
      return 'Outlook Calendar'
    default:
      return integration
  }
}
