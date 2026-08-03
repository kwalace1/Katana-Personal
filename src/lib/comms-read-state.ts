const COMMS_LAST_SEEN_KEY = 'employeePortal_commsLastSeenAt'

export function getCommsLastSeenAt(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(COMMS_LAST_SEEN_KEY)
}

export function markCommsSeenAt(iso: string = new Date().toISOString()): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(COMMS_LAST_SEEN_KEY, iso)
}

export function isCommsMessageUnread(messageCreatedAt: string, lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true
  return new Date(messageCreatedAt).getTime() > new Date(lastSeenAt).getTime()
}
