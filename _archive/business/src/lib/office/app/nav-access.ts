import type { AppView } from '@/lib/office/types'

export type NavMode = 'full' | 'katana'

const NAV_MODE_KEY = 'sc_nav_mode'
const NAV_PARAM = 'sc_nav'
const EMBED_KEY = 'sc_embedded'

/**
 * Views an embedded Katana end-user (member/viewer role) may reach. Everything
 * else is hidden from the rail and blocked at the route level. Admins/owners run
 * in 'full' mode and see the entire app.
 */
export const KATANA_ALLOWED_VIEWS = new Set<AppView>([
  'home',
  'agents',
  'org_chart',
  'settings',
])

function readSession(key: string): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(key, value)
  } catch {
    /* sessionStorage unavailable (private mode / sandboxed iframe) — ignore */
  }
}

function normalize(value: string | null): NavMode | null {
  return value === 'katana' || value === 'full' ? value : null
}

/**
 * Resolve the navigation mode for the current browsing session.
 *
 * The `?sc_nav=` query param (set by the Katana host on the iframe URL) is
 * authoritative on a fresh load and is cached in sessionStorage so it survives
 * the SPA's client-side navigation. We deliberately use sessionStorage, not
 * localStorage, so a Katana embed never leaks its limited mode into standalone
 * SwarmClaw usage in another tab. Absent any signal we default to 'full' so the
 * standalone app is unaffected.
 */
export function resolveNavMode(): NavMode {
  if (typeof window === 'undefined') return 'full'
  let fromUrl: NavMode | null = null
  try {
    fromUrl = normalize(new URLSearchParams(window.location.search).get(NAV_PARAM))
  } catch {
    fromUrl = null
  }
  if (fromUrl) {
    writeSession(NAV_MODE_KEY, fromUrl)
    return fromUrl
  }
  return normalize(readSession(NAV_MODE_KEY)) ?? 'full'
}

/** Whether a view is reachable under the given nav mode. */
export function isViewAllowed(view: AppView, mode: NavMode): boolean {
  return mode === 'full' || KATANA_ALLOWED_VIEWS.has(view)
}

/**
 * Whether the office is running embedded inside the Katana host (the host passes
 * `?sc_nav=`). When embedded we hide office-only chrome like the user/profile
 * switcher, since identity comes from Katana's Microsoft sign-in, not a separate
 * office profile. Standalone SwarmClaw (no param) returns false.
 */
export function resolveEmbedded(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (new URLSearchParams(window.location.search).get(NAV_PARAM)) {
      writeSession(EMBED_KEY, '1')
      return true
    }
  } catch {
    /* ignore */
  }
  return readSession(EMBED_KEY) === '1'
}
