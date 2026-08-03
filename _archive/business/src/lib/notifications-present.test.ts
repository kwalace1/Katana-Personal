import { describe, expect, it } from 'vitest'
import {
  countUnreadNotifications,
  formatNotificationTime,
  isNotificationUnread,
  notificationModuleLabel,
  sortNotificationsNewestFirst,
} from './notifications-present'
import type { UserNotification } from './notifications-api'

function sample(overrides: Partial<UserNotification> = {}): UserNotification {
  return {
    id: 'n1',
    organization_id: 'org',
    recipient_user_id: 'u1',
    actor_user_id: null,
    source_module: 'comms',
    notification_type: 'comms_message',
    title: 'Test',
    body: null,
    link_path: '/comms',
    metadata: {},
    read_at: null,
    created_at: '2026-01-01T12:00:00Z',
    ...overrides,
  }
}

describe('notifications-present', () => {
  it('labels modules', () => {
    expect(notificationModuleLabel('comms')).toBe('Katana Comms')
    expect(notificationModuleLabel('projects')).toBe('Katana PM')
  })

  it('detects unread state', () => {
    expect(isNotificationUnread(sample())).toBe(true)
    expect(isNotificationUnread(sample({ read_at: '2026-01-02T00:00:00Z' }))).toBe(false)
  })

  it('counts unread', () => {
    const items = [
      sample({ id: 'a' }),
      sample({ id: 'b', read_at: '2026-01-02T00:00:00Z' }),
    ]
    expect(countUnreadNotifications(items)).toBe(1)
  })

  it('sorts newest first', () => {
    const items = [
      sample({ id: 'old', created_at: '2026-01-01T10:00:00Z' }),
      sample({ id: 'new', created_at: '2026-01-02T10:00:00Z' }),
    ]
    expect(sortNotificationsNewestFirst(items).map((n) => n.id)).toEqual(['new', 'old'])
  })

  it('formats relative time', () => {
    const recent = new Date(Date.now() - 30_000).toISOString()
    expect(formatNotificationTime(recent)).toBe('Just now')
  })
})
