import type { Organization } from '@/contexts/AuthContext'
import type { UserProfile } from '@/contexts/AuthContext'

/** Katana operator org — sees all pilot support tickets across every tenant. */
const DEFAULT_PLATFORM_EMAIL_DOMAINS = [
  'dwgrowthcapital.onmicrosoft.com',
  'dwgrowth.onmicrosoft.com',
]

export function getPlatformEmailDomains(): string[] {
  const raw = (import.meta.env.VITE_KATANA_PLATFORM_EMAIL_DOMAINS as string | undefined)?.trim()
  if (!raw) return DEFAULT_PLATFORM_EMAIL_DOMAINS
  const domains = raw
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  return domains.length > 0 ? domains : DEFAULT_PLATFORM_EMAIL_DOMAINS
}

export function getPlatformOrgId(): string | null {
  const id = (import.meta.env.VITE_KATANA_PLATFORM_ORG_ID as string | undefined)?.trim()
  return id || null
}

function emailMatchesPlatformDomain(email: string, domains: string[]): boolean {
  const normalized = email.trim().toLowerCase()
  const at = normalized.lastIndexOf('@')
  if (at < 0) return false
  const domain = normalized.slice(at + 1)
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`))
}

/**
 * Katana platform team (owner/admin in the operator org or on an allowed email domain).
 * These users see every support submission across all pilot organizations.
 */
export function isKatanaPlatformOperator(options: {
  profile: UserProfile | null
  organization: Organization | null
  userEmail?: string | null
}): boolean {
  const { profile, organization } = options
  if (!profile) return false
  if (profile.role !== 'owner' && profile.role !== 'admin') return false

  const platformOrgId = getPlatformOrgId()
  if (platformOrgId && profile.organization_id === platformOrgId) return true

  const domains = getPlatformEmailDomains()
  const email = (options.userEmail ?? profile.email ?? '').trim()
  if (emailMatchesPlatformDomain(email, domains)) return true

  const orgDomain = (organization?.domain ?? '').trim().toLowerCase()
  if (orgDomain && domains.some((d) => orgDomain === d || orgDomain.endsWith(`.${d}`))) {
    return true
  }

  return false
}

/** The operator org itself, matched by name ("DW Growth Capital"). Mirrors the
 *  server-side `isDwGrowthCapitalOrg` used for module entitlements. */
export function orgIsOperatorOrg(organization: Organization | null): boolean {
  const name = (organization?.name ?? '').toLowerCase()
  if (name.includes('dw growth') && name.includes('capital')) return true

  const platformOrgId = getPlatformOrgId()
  if (platformOrgId && organization?.id === platformOrgId) return true

  const domains = getPlatformEmailDomains()
  const orgDomain = (organization?.domain ?? '').trim().toLowerCase()
  return Boolean(orgDomain && domains.some((d) => orgDomain === d || orgDomain.endsWith(`.${d}`)))
}

/**
 * Any member of the Katana operator org (DW Growth Capital) — regardless of role.
 * Unlike {@link isKatanaPlatformOperator}, this does NOT require owner/admin, so
 * every member of the operator org can view org-wide tooling such as the AI
 * Usage & Credits dashboard. Membership is established by the user's org (name /
 * id / domain) OR by a verified platform email domain.
 */
export function isOperatorOrgMember(options: {
  profile: UserProfile | null
  organization: Organization | null
  userEmail?: string | null
}): boolean {
  const { profile, organization } = options
  if (!profile) return false

  if (orgIsOperatorOrg(organization)) return true

  const platformOrgId = getPlatformOrgId()
  if (platformOrgId && profile.organization_id === platformOrgId) return true

  const domains = getPlatformEmailDomains()
  const email = (options.userEmail ?? profile.email ?? '').trim()
  return emailMatchesPlatformDomain(email, domains)
}
