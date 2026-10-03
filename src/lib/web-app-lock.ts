import { isNativeShell } from '@/lib/native/platform'

/**
 * Production website is a marketing page. The full product stays on:
 * - `npm run dev` (this repo, then git → Mac → Xcode → TestFlight)
 * - the Capacitor iOS shell (TestFlight / App Store)
 *
 * Native is never locked. Do not point Capacitor `server.url` at Vercel.
 */
export type WebAppAccessInput = {
  isDev: boolean
  isNative: boolean
  allowWebApp?: string | null
  lockWebApp?: string | null
}

function flagOn(value?: string | null): boolean {
  const s = value?.trim().toLowerCase()
  return s === 'true' || s === '1' || s === 'yes'
}

/** Pure lock rules — used by tests so we never have to mock Vite/Capacitor. */
export function resolveWebAppLocked(input: WebAppAccessInput): boolean {
  if (input.isNative) return false
  if (flagOn(input.allowWebApp)) return false
  if (flagOn(input.lockWebApp)) return true
  if (input.isDev) return false
  return true
}

export function isWebAppLocked(): boolean {
  return resolveWebAppLocked({
    isDev: import.meta.env.DEV,
    isNative: isNativeShell(),
    allowWebApp: import.meta.env.VITE_ALLOW_WEB_APP,
    lockWebApp: import.meta.env.VITE_LOCK_WEB_APP,
  })
}

/** Live App Store listing — default CTA on the public marketing site. */
export const APP_STORE_URL = 'https://apps.apple.com/us/app/katana-personal/id6813697936'

/** Pure resolver — env override wins; otherwise the live App Store URL. */
export function resolveIosDownloadUrl(fromEnv?: string | null): string {
  const trimmed = fromEnv?.trim()
  return trimmed || APP_STORE_URL
}

/** Public download URL for marketing / open-in-iOS screens. Override with `VITE_IOS_DOWNLOAD_URL`. */
export function iosDownloadUrl(): string {
  return resolveIosDownloadUrl(import.meta.env.VITE_IOS_DOWNLOAD_URL as string | undefined)
}

export function nativeInviteDeepLink(kind: 'circle' | 'friend', value: string): string {
  const token = encodeURIComponent(value)
  return kind === 'circle'
    ? `katanapersonal://invite/circle/${token}`
    : `katanapersonal://invite/friend/${token}`
}

/**
 * Routes the public site may still serve while the product UI is locked:
 * marketing, legal (App Store), auth email confirmation, invite handoff.
 */
export function isWebPublicPath(pathname: string): boolean {
  const path = (pathname.split('?')[0] || '/').replace(/\/+$/, '') || '/'
  if (path === '/') return true
  if (path === '/privacy' || path === '/terms') return true
  if (path === '/auth' || path.startsWith('/auth/')) return true
  if (path.startsWith('/invite/')) return true
  return false
}
