import type { EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

const DISMISSED_KEY = 'employeePortal_dismissedFeedItems'

function readDismissedIds(): Set<string> {
  if (typeof window === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(DISMISSED_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0))
  } catch {
    return new Set()
  }
}

function writeDismissedIds(ids: Set<string>): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]))
}

export function isFeedItemDismissed(id: string): boolean {
  return readDismissedIds().has(id)
}

export function dismissFeedItem(id: string): void {
  if (!id || typeof window === 'undefined') return
  const ids = readDismissedIds()
  if (ids.has(id)) return
  ids.add(id)
  writeDismissedIds(ids)
}

export function dismissFeedItems(ids: string[]): void {
  if (typeof window === 'undefined' || ids.length === 0) return
  const dismissed = readDismissedIds()
  let changed = false
  for (const id of ids) {
    if (!id || dismissed.has(id)) continue
    dismissed.add(id)
    changed = true
  }
  if (changed) writeDismissedIds(dismissed)
}

/** Synthetic rows the user can clear from the feed without a persisted notification. */
export function isDismissibleSyntheticFeedItem(item: EmployeePortalFeedItem): boolean {
  if (item.scope !== 'for_you' || !item.unread) return false
  if (item.id.startsWith('timeoff-')) return true
  return false
}

export function filterDismissedFeedItems(items: EmployeePortalFeedItem[]): EmployeePortalFeedItem[] {
  const dismissed = readDismissedIds()
  if (dismissed.size === 0) return items
  return items.filter((item) => !dismissed.has(item.id))
}

export function listDismissibleSyntheticIds(items: EmployeePortalFeedItem[]): string[] {
  return items.filter(isDismissibleSyntheticFeedItem).map((item) => item.id)
}
