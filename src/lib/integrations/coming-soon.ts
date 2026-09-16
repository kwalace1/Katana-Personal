/** Client-side readiness flags for integrations we’ll wire with env keys next. */

export function outlookCalendarConfigured(): boolean {
  return Boolean(import.meta.env.VITE_MS_CLIENT_ID || import.meta.env.VITE_OUTLOOK_CLIENT_ID)
}

export function googleTasksConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GOOGLE_TASKS_CLIENT_ID || import.meta.env.VITE_GOOGLE_CLIENT_ID)
}

export function todoistConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TODOIST_CLIENT_ID)
}
