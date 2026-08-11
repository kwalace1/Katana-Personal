/** Local hide list for reported posts + report reason labels. */

export const REPORT_REASONS = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Harassment' },
  { id: 'inappropriate', label: 'Inappropriate' },
  { id: 'other', label: 'Other' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['id']

const HIDE_PREFIX = 'katana-personal:hidden-posts:'

function storageKey(uid: string) {
  return `${HIDE_PREFIX}${uid}`
}

export function listHiddenPostIds(uid: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0)
  } catch {
    return []
  }
}

export function hideReportedPost(uid: string, postId: string): void {
  const next = new Set(listHiddenPostIds(uid))
  next.add(postId)
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify([...next]))
  } catch {
    // private mode / quota
  }
}

export function isPostHidden(uid: string, postId: string): boolean {
  return listHiddenPostIds(uid).includes(postId)
}

export function filterHiddenPosts<T extends { id: string }>(uid: string, posts: T[]): T[] {
  const hidden = new Set(listHiddenPostIds(uid))
  if (hidden.size === 0) return posts
  return posts.filter((p) => !hidden.has(p.id))
}
