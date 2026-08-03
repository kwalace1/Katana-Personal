/**
 * next/navigation shim for the Agent Office port.
 *
 * SwarmClaw's code navigates in its own path vocabulary ('/home', '/agents/:id',
 * '/tasks', ...). In Katana the office is mounted under /agents, so these hooks
 * translate between the two vocabularies transparently: ported code keeps using
 * office paths and the browser URL stays in Katana's /agents/* namespace.
 */
import { useCallback, useMemo } from 'react'
import {
  useLocation,
  useNavigate as useRRNavigate,
  useParams as useRRParams,
} from 'react-router-dom'

const KATANA_BASE = '/agents'

/** office path -> katana path (query/hash preserved) */
export function officeToKatana(href: string): string {
  if (!href.startsWith('/')) return href // external / relative — leave alone
  const m = href.match(/^([^?#]*)(.*)$/)
  const pathname = m?.[1] ?? href
  const suffix = m?.[2] ?? ''
  let mapped: string
  if (pathname === '/' || pathname === '/home') mapped = KATANA_BASE
  else if (pathname === '/agents') mapped = `${KATANA_BASE}/chat`
  else if (pathname.startsWith('/agents/')) mapped = `${KATANA_BASE}/chat/${pathname.slice('/agents/'.length)}`
  else mapped = `${KATANA_BASE}${pathname}`
  return mapped + suffix
}

/** katana path -> office path */
export function katanaToOffice(pathname: string): string {
  if (pathname === KATANA_BASE || pathname === `${KATANA_BASE}/`) return '/home'
  if (!pathname.startsWith(`${KATANA_BASE}/`)) return pathname
  const rest = pathname.slice(KATANA_BASE.length) // '/chat/123', '/tasks', ...
  if (rest === '/chat') return '/agents'
  if (rest.startsWith('/chat/')) return `/agents/${rest.slice('/chat/'.length)}`
  return rest
}

export interface OfficeRouter {
  push: (href: string, options?: { scroll?: boolean }) => void
  replace: (href: string, options?: { scroll?: boolean }) => void
  back: () => void
  forward: () => void
  refresh: () => void
  prefetch: (href: string) => void
}

export function useRouter(): OfficeRouter {
  const navigate = useRRNavigate()
  return useMemo<OfficeRouter>(() => ({
    push: (href: string, _options?: { scroll?: boolean }) => navigate(officeToKatana(href)),
    replace: (href: string, _options?: { scroll?: boolean }) => navigate(officeToKatana(href), { replace: true }),
    back: () => navigate(-1),
    forward: () => navigate(1),
    refresh: () => { /* no-op: SPA state is live */ },
    prefetch: () => { /* no-op in Vite SPA */ },
  }), [navigate])
}

/** Returns the OFFICE-relative pathname (e.g. '/home', '/agents/abc'). */
export function usePathname(): string {
  const location = useLocation()
  return katanaToOffice(location.pathname)
}

export function useSearchParams(): URLSearchParams {
  const location = useLocation()
  return useMemo(() => new URLSearchParams(location.search), [location.search])
}

export function useParams<T extends Record<string, string | string[] | undefined> = Record<string, string | undefined>>(): T {
  return useRRParams() as unknown as T
}

/** Imperative redirect (rarely used client-side). */
export function redirect(href: string): void {
  window.location.assign(officeToKatana(href))
}

export function useSelectedLayoutSegment(): string | null {
  const pathname = usePathname()
  const seg = pathname.split('/').filter(Boolean)[0]
  return seg ?? null
}

/** Hook flavor parity with next/navigation's useServerInsertedHTML etc. is not needed. */
export function useOfficeHrefBuilder(): (officeHref: string) => string {
  return useCallback((officeHref: string) => officeToKatana(officeHref), [])
}
