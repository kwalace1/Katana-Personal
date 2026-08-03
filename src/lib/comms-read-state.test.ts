import { describe, expect, it } from 'vitest'
import { isCommsMessageUnread } from './comms-read-state'
import { commsMessagesToFeedItems } from './employee-portal-comms'
import type { IncomingCommsMessage } from './employee-portal-comms'

describe('isCommsMessageUnread', () => {
  it('treats messages after last seen as unread', () => {
    expect(isCommsMessageUnread('2026-05-22T12:00:00Z', '2026-05-22T11:00:00Z')).toBe(true)
    expect(isCommsMessageUnread('2026-05-22T10:00:00Z', '2026-05-22T11:00:00Z')).toBe(false)
  })

  it('treats all as unread when never seen', () => {
    expect(isCommsMessageUnread('2026-05-22T12:00:00Z', null)).toBe(true)
  })
})

describe('commsMessagesToFeedItems', () => {
  const sample: IncomingCommsMessage = {
    id: 'msg-1',
    content: 'Hello team',
    created_at: '2026-05-22T12:00:00Z',
    sender_id: 'user-a',
    sender_name: 'Alex',
    conversation_id: 'conv-1',
    channel_id: null,
    channel_name: null,
    conversation_label: 'Alex',
    context_path: null,
    channel_type: null,
    is_announcement: false,
  }

  it('builds feed items with comms link', () => {
    const items = commsMessagesToFeedItems([sample], '2026-05-22T11:00:00Z')
    expect(items).toHaveLength(1)
    expect(items[0]?.id).toBe('comms-msg-1')
    expect(items[0]?.unread).toBe(true)
    expect(items[0]?.link).toContain('conversation=conv-1')
    expect(items[0]?.iconKind).toBe('message')
  })
})
