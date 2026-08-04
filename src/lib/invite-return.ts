const KEY = 'katana-personal:invite-return'

/** Remember an invite URL so Open / Cloud sign-in can send people back. */
export function stashInviteReturn(path: string) {
  if (!path.startsWith('/invite/')) return
  try {
    sessionStorage.setItem(KEY, path)
  } catch {
    // private mode
  }
}

export function peekInviteReturn(): string | null {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function takeInviteReturn(): string | null {
  try {
    const path = sessionStorage.getItem(KEY)
    if (path) sessionStorage.removeItem(KEY)
    return path
  } catch {
    return null
  }
}
