const SEEN_KEY = 'employeePortal_seenFeedItems'

function readSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(SEEN_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

function writeSeenIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SEEN_KEY, JSON.stringify([...ids]))
}

export function isFeedItemSeen(id: string): boolean {
  return readSeenIds().has(id)
}

export function markFeedItemSeen(id: string): void {
  if (!id || typeof window === 'undefined') return
  const ids = readSeenIds()
  if (ids.has(id)) return
  ids.add(id)
  writeSeenIds(ids)
}

export function markFeedItemsSeen(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  const seen = readSeenIds()
  let changed = false
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    changed = true
  }
  if (changed) writeSeenIds(seen)
}

export function readSeenFeedItemIds(): Set<string> {
  return readSeenIds()
}
