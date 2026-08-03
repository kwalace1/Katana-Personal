import type { UserNotification, NotificationSourceModule } from '@/lib/notifications-api'

const MODULE_LABELS: Record<NotificationSourceModule, string> = {
  comms: 'Katana Comms',
  projects: 'Katana PM',
  inventory: 'Katana Inventory',
  customer_success: 'Katana Customers',
  hr: 'Katana HR',
  workforce: 'WFM',
  hub: 'Hub',
  general: 'Katana',
  support: 'Katana Support',
  kyi: 'Know Your Investor',
  kyc: 'Know Your Customer',
  finance: 'Katana Finance',
}

export function notificationModuleLabel(module: NotificationSourceModule): string {
  return MODULE_LABELS[module] ?? 'Katana'
}

export function isNotificationUnread(n: UserNotification): boolean {
  return n.read_at == null
}

export function formatNotificationTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM}m ago`
  if (diffH < 24) return `${diffH}h ago`
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

export function sortNotificationsNewestFirst(items: UserNotification[]): UserNotification[] {
  return [...items].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

export function countUnreadNotifications(items: UserNotification[]): number {
  return items.filter(isNotificationUnread).length
}
