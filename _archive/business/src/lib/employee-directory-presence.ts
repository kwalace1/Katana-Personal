/** Minutes since last login to treat someone as actively online. */
export const PRESENCE_ONLINE_WINDOW_MINUTES = 15

export type EmployeePresenceStatus = 'online' | 'recent' | 'never'

export function normalizeDirectoryEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

/**
 * Derive presence from Katana auth profile linkage and last_login_at.
 * - online (green): signed in within the active window
 * - recent (yellow): has an account and has logged in before, but not recently
 * - never (gray): no linked account or never logged in
 */
export function deriveEmployeePresence(
  hasKatanaAccount: boolean,
  lastLoginAt: string | null | undefined,
  nowMs: number = Date.now()
): EmployeePresenceStatus {
  if (!hasKatanaAccount || !lastLoginAt) return 'never'
  const lastMs = new Date(lastLoginAt).getTime()
  if (Number.isNaN(lastMs)) return 'never'
  const minutesAgo = (nowMs - lastMs) / (1000 * 60)
  if (minutesAgo <= PRESENCE_ONLINE_WINDOW_MINUTES) return 'online'
  return 'recent'
}

export function presenceIndicatorClass(status: EmployeePresenceStatus): string {
  switch (status) {
    case 'online':
      return 'bg-green-500'
    case 'recent':
      return 'bg-yellow-500'
    case 'never':
      return 'bg-gray-400'
  }
}

export function formatRelativeLastActive(lastLoginAt: string, nowMs: number = Date.now()): string {
  const lastMs = new Date(lastLoginAt).getTime()
  if (Number.isNaN(lastMs)) return 'Unknown'
  const diffSec = Math.max(0, Math.floor((nowMs - lastMs) / 1000))
  if (diffSec < 60) return 'Just now'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? '' : 's'} ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`
  return new Date(lastLoginAt).toLocaleString()
}

export function presenceLabel(
  status: EmployeePresenceStatus,
  lastLoginAt: string | null | undefined,
  nowMs: number = Date.now()
): string {
  switch (status) {
    case 'online':
      return 'Active now'
    case 'recent':
      return lastLoginAt
        ? `Last active ${formatRelativeLastActive(lastLoginAt, nowMs)}`
        : 'Last active unknown'
    case 'never':
      return 'Not signed in yet'
  }
}
