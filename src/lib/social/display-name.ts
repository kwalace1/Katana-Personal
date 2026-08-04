/** True when a label is just the email local-part (e.g. kwalls1 from kwalls1@…). */
export function isEmailLocalPartName(name: string | null | undefined, email: string | null | undefined): boolean {
  if (!name?.trim() || !email?.includes('@')) return false
  const local = email.split('@')[0]?.trim().toLowerCase()
  return !!local && name.trim().toLowerCase() === local
}

export function isPlaceholderDisplayName(
  name: string | null | undefined,
  email?: string | null,
): boolean {
  const n = name?.trim()
  if (!n) return true
  if (n === 'You' || n === 'Friend' || n === 'there') return true
  if (email && isEmailLocalPartName(n, email)) return true
  return false
}

/**
 * Prefer a real human name over email-prefix / placeholder labels.
 * Order: local (Settings) → auth → cloud, skipping placeholders when a better option exists.
 */
export function pickBestDisplayName(input: {
  authName?: string | null
  cloudName?: string | null
  localName?: string | null
  email?: string | null
  fallback?: string
}): string {
  const email = input.email || ''
  const candidates = [input.localName, input.authName, input.cloudName]
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)

  const real = candidates.find((c) => !isPlaceholderDisplayName(c, email))
  if (real) return real

  return candidates[0] || input.fallback || 'Friend'
}

/** Only replace a placeholder/empty name with a better candidate. Never overwrite a real name. */
export function upgradePlaceholderName(
  current: string | null | undefined,
  candidate: string | null | undefined,
  email?: string | null,
): string | null {
  const next = candidate?.trim()
  if (!next) return null
  if (!isPlaceholderDisplayName(current, email)) return null
  if (current?.trim() === next) return null
  if (isPlaceholderDisplayName(next, email) && current?.trim()) return null
  return next
}
