/**
 * Map incoming custom-scheme / https URLs onto in-app paths.
 * OAuth return is handled separately; this is invites (and similar handoff).
 */
export function appPathFromDeepLink(url: string): string | null {
  const invite = url.match(/\/invite\/(circle|friend)\/([^/?#]+)/i)
  if (invite?.[1] && invite[2]) {
    const kind = invite[1].toLowerCase()
    try {
      return `/invite/${kind}/${decodeURIComponent(invite[2])}`
    } catch {
      return `/invite/${kind}/${invite[2]}`
    }
  }
  return null
}
