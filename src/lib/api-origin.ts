import { DEFAULT_NATIVE_APP_URL } from '@/lib/billing/catalog'
import { isNativeShell } from '@/lib/native/platform'

/** Production site the iOS binary should call for `/api/*`. */
export function appOrigin(): string {
  const fromEnv = (import.meta.env.VITE_APP_URL as string | undefined)?.trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (isNativeShell()) return DEFAULT_NATIVE_APP_URL
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin
  return DEFAULT_NATIVE_APP_URL
}

/**
 * Rewrite same-origin `/api/*` calls so the Capacitor WebView hits Vercel
 * instead of `capacitor://localhost` / `https://localhost`.
 */
export function resolveApiUrl(input: string, pageOrigin: string, apiBase: string): string {
  const base = apiBase.replace(/\/$/, '')
  try {
    const url = new URL(input, pageOrigin)
    if (!url.pathname.startsWith('/api/')) return input
    const target = new URL(base)
    if (url.origin === target.origin) return input
    return `${base}${url.pathname}${url.search}${url.hash}`
  } catch {
    return input
  }
}

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  if (!isNativeShell()) return p
  return resolveApiUrl(p, typeof window !== 'undefined' ? window.location.origin : 'https://localhost', appOrigin())
}

function rewriteInput(input: RequestInfo | URL, pageOrigin: string, apiBase: string): RequestInfo | URL {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  const next = resolveApiUrl(raw, pageOrigin, apiBase)
  if (next === raw) return input
  if (typeof input === 'string' || input instanceof URL) return next
  return new Request(next, input)
}

/** Patch `fetch` once so existing `/api/...` calls work inside the iOS shell. */
export function patchNativeApiFetch() {
  if (typeof window === 'undefined') return
  if (!isNativeShell()) return
  const w = window as Window & { __katanaApiFetchPatched?: boolean }
  if (w.__katanaApiFetchPatched) return
  w.__katanaApiFetchPatched = true

  const orig = window.fetch.bind(window)
  const pageOrigin = window.location.origin
  const apiBase = appOrigin()

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    orig(rewriteInput(input, pageOrigin, apiBase), init)) as typeof window.fetch
}
