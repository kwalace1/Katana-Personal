import * as CommsApi from '@/lib/comms-api'
import type { Conversation, Message } from '@/lib/comms-api'
import { getCurrentUserId } from '@/lib/auth-helpers'
import { supabase } from '@/lib/supabase'
import { isCommsMessageUnread } from '@/lib/comms-read-state'
import { FEED_PRIORITY, type EmployeePortalFeedItem } from '@/lib/employee-portal-feed'

export interface IncomingCommsMessage {
  id: string
  content: string
  created_at: string
  sender_id: string
  sender_name: string
  conversation_id: string | null
  channel_id: string | null
  channel_name: string | null
  conversation_label: string | null
  /** Module record path when the channel is a context-bound discussion. */
  context_path: string | null
  channel_type: string | null
  is_announcement: boolean
}

function truncateContent(content: string, max = 120): string {
  const t = content.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM} min ago`
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`
  if (diffD < 7) return `${diffD} day${diffD !== 1 ? 's' : ''} ago`
  return d.toLocaleDateString()
}

function fallbackCommsFeedLink(msg: IncomingCommsMessage): string {
  if (msg.conversation_id) {
    return `/comms?conversation=${encodeURIComponent(msg.conversation_id)}`
  }
  if (msg.channel_id) {
    return `/comms?channel=${encodeURIComponent(msg.channel_id)}`
  }
  return `/comms?user=${encodeURIComponent(msg.sender_id)}`
}

function commsFeedLink(msg: IncomingCommsMessage): string {
  if (msg.context_path) return msg.context_path
  return fallbackCommsFeedLink(msg)
}

/** Map incoming Comms messages to portal feed items (for_you / company). */
export function commsMessagesToFeedItems(
  messages: IncomingCommsMessage[],
  lastSeenAt: string | null,
  readCursors?: { channels: Record<string, string>; conversations: Record<string, string> }
): EmployeePortalFeedItem[] {
  return messages.map((msg) => {
    let unread: boolean
    if (readCursors) {
      if (msg.channel_id) {
        const cursor = readCursors.channels[msg.channel_id]
        unread = cursor ? new Date(msg.created_at) > new Date(cursor) : true
      } else if (msg.conversation_id) {
        const cursor = readCursors.conversations[msg.conversation_id]
        unread = cursor ? new Date(msg.created_at) > new Date(cursor) : true
      } else {
        unread = isCommsMessageUnread(msg.created_at, lastSeenAt)
      }
    } else {
      unread = isCommsMessageUnread(msg.created_at, lastSeenAt)
    }

    const contextLabel = msg.conversation_label ?? msg.channel_name ?? 'Direct message'
    const isAnnouncement = msg.is_announcement
    const title = isAnnouncement
      ? `Announcement in #${msg.channel_name || 'announcements'}`
      : msg.channel_name
        ? `Message in #${msg.channel_name}`
        : `Message from ${msg.sender_name}`

    return {
      id: `comms-${msg.id}`,
      scope: isAnnouncement ? 'company' : 'for_you',
      category: isAnnouncement ? 'activity' : 'notification',
      sortAt: new Date(msg.created_at).getTime(),
      priorityRank: unread
        ? isAnnouncement
          ? FEED_PRIORITY.COMMS_UNREAD
          : FEED_PRIORITY.COMMS_UNREAD
        : FEED_PRIORITY.COMMS_READ,
      urgencyLabel: unread ? (isAnnouncement ? 'New announcement' : 'Unread message') : undefined,
      title,
      subtitle: truncateContent(msg.content),
      time: formatRelativeTime(msg.created_at),
      link: commsFeedLink(msg),
      meta: isAnnouncement ? 'Company announcement' : 'Katana Comms',
      unread,
      iconKind: 'message',
      sourceModule: 'comms',
      notificationType: isAnnouncement ? 'comms_announcement' : 'comms_message',
      commsMessageId: msg.id,
      quickView: {
        layout: 'message',
        summary: isAnnouncement
          ? `${msg.sender_name} posted a company announcement.`
          : msg.channel_name
            ? `${msg.sender_name} posted in ${msg.channel_name}.`
            : `${msg.sender_name} sent you a message.`,
        body: msg.content,
        fromName: msg.sender_name,
        contextLabel,
        details: [
          { label: 'From', value: msg.sender_name },
          { label: 'Where', value: contextLabel },
          { label: 'When', value: new Date(msg.created_at).toLocaleString() },
        ],
        moduleLabel: msg.context_path
          ? 'Open discussion'
          : isAnnouncement
            ? 'Open announcement'
            : 'Open in Comms',
        timestamp: new Date(msg.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      },
    }
  })
}

function mapRawMessage(
  m: Message & { sender_profile?: { full_name?: string | null; email?: string } | null },
  channelNames: Map<string, string>,
  conversationLabels: Map<string, string>,
  channelContextPaths: Map<string, string>,
  channelTypes: Map<string, string>
): IncomingCommsMessage {
  const senderName =
    m.sender_profile?.full_name?.trim() ||
    m.sender_profile?.email?.split('@')[0] ||
    'Someone'
  const channelType = m.channel_id ? channelTypes.get(m.channel_id) ?? null : null
  return {
    id: m.id,
    content: m.content,
    created_at: m.created_at,
    sender_id: m.sender_id,
    sender_name: senderName,
    conversation_id: m.conversation_id,
    channel_id: m.channel_id,
    channel_name: m.channel_id ? channelNames.get(m.channel_id) ?? null : null,
    conversation_label: m.conversation_id
      ? conversationLabels.get(m.conversation_id) ?? null
      : null,
    context_path: m.channel_id ? channelContextPaths.get(m.channel_id) ?? null : null,
    channel_type: channelType,
    is_announcement: channelType === 'announcement',
  }
}

function conversationDisplayLabel(conv: Conversation, currentUserId: string): string {
  if (conv.conversation_type === 'group' && conv.name) return conv.name
  const other = conv.members?.find((m) => m.member_user_id !== currentUserId)
  return other?.profile?.full_name?.trim() || other?.profile?.email || 'Direct message'
}

/**
 * Fetch recent messages sent to the current user (DMs + channels they can see).
 * Excludes messages the user sent.
 */
/** Recent incoming Comms messages for portal feed (read state applied separately). */
export async function fetchIncomingCommsMessages(limit = 30): Promise<IncomingCommsMessage[]> {
  const userId = await getCurrentUserId()

  const [conversations, channels, channelMembers] = await Promise.all([
    CommsApi.getConversations(),
    CommsApi.getAllChannels(),
    supabaseChannelIdsForUser(userId),
  ])

  const conversationIds = conversations.map((c) => c.id)
  const memberChannelIds = new Set<string>(channelMembers)
  const channelIds = new Set<string>(channelMembers)
  for (const ch of channels) {
    const isContextChannel = Boolean(
      ch.context_type || CommsApi.parseContextChannelMarker(ch.description)
    )
    if (isContextChannel) {
      if (memberChannelIds.has(ch.id)) channelIds.add(ch.id)
      continue
    }
    // Announcements and public channels are visible org-wide
    if (!ch.is_private || ch.channel_type === 'announcement') channelIds.add(ch.id)
  }

  const channelNames = new Map(channels.map((c) => [c.id, c.name]))
  const channelTypes = new Map(channels.map((c) => [c.id, c.channel_type]))
  const channelContextPaths = new Map<string, string>()
  for (const ch of channels) {
    if (ch.context_type && ch.context_id) {
      const path = CommsApi.contextRecordPath(ch.context_type, ch.context_id)
      if (path) channelContextPaths.set(ch.id, path)
      continue
    }
    const parsed = CommsApi.parseContextChannelMarker(ch.description)
    if (!parsed) continue
    const path = CommsApi.contextRecordPath(parsed.contextType, parsed.contextId)
    if (path) channelContextPaths.set(ch.id, path)
  }
  const conversationLabels = new Map(
    conversations.map((c) => [c.id, conversationDisplayLabel(c, userId)])
  )

  const messages = await CommsApi.getIncomingCommsMessages({
    conversationIds,
    channelIds: Array.from(channelIds),
    excludeSenderId: userId,
    since: null,
    limit,
  })

  return messages.map((m) =>
    mapRawMessage(m, channelNames, conversationLabels, channelContextPaths, channelTypes)
  )
}

async function supabaseChannelIdsForUser(userId: string): Promise<string[]> {
  const { data } = await supabase
    .from('comms_channel_members')
    .select('channel_id')
    .eq('member_user_id', userId)
  return (data ?? []).map((r) => r.channel_id as string)
}

export function countUnreadCommsFeedItems(items: EmployeePortalFeedItem[]): number {
  return items.filter((i) => i.id.startsWith('comms-') && i.unread).length
}

/** Build feed items using durable read cursors when available. */
export async function fetchCommsFeedItems(): Promise<EmployeePortalFeedItem[]> {
  const [messages, cursors] = await Promise.all([
    fetchIncomingCommsMessages(),
    CommsApi.getReadCursors().catch(() => ({ channels: {}, conversations: {} })),
  ])
  return commsMessagesToFeedItems(messages, null, cursors)
}
