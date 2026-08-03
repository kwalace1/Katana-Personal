/**
 * Comms → notification dispatch and live toast helpers.
 */

import * as CommsApi from '@/lib/comms-api'
import type { Message } from '@/lib/comms-api'
import {
  filterCommsNotificationRecipients,
  shouldDeliverCommsNotification,
} from '@/lib/comms-preferences'
import { supabase } from '@/lib/supabase'
import { getCurrentUserId, getOrganizationId } from '@/lib/auth-helpers'
import {
  areNotificationsAvailable,
  createNotification,
  createNotifications,
  type CreateNotificationInput,
} from '@/lib/notifications-api'

function truncateContent(content: string, max = 140): string {
  const t = content.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1)}…`
}

function fallbackCommsLinkPath(
  msg: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>
): string {
  if (msg.conversation_id) {
    return `/comms?conversation=${encodeURIComponent(msg.conversation_id)}`
  }
  if (msg.channel_id) {
    return `/comms?channel=${encodeURIComponent(msg.channel_id)}`
  }
  return `/comms?user=${encodeURIComponent(msg.sender_id)}`
}

async function resolveCommsLinkPath(
  msg: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>
): Promise<string> {
  if (msg.channel_id) {
    const { data: channel } = await supabase
      .from('comms_channels')
      .select('description')
      .eq('id', msg.channel_id)
      .maybeSingle()
    const parsed = CommsApi.parseContextChannelMarker(channel?.description ?? null)
    if (parsed) {
      const recordPath = CommsApi.contextRecordPath(parsed.contextType, parsed.contextId)
      if (recordPath) return recordPath
    }
  }
  return fallbackCommsLinkPath(msg)
}

async function channelRecipientUserIds(
  channelId: string,
  excludeUserId: string
): Promise<string[]> {
  const { data: channel } = await supabase
    .from('comms_channels')
    .select('is_private, organization_id, description')
    .eq('id', channelId)
    .single()

  if (!channel) return []

  // Module discussion channels are org-visible but should not ping the entire org.
  const isContextChannel = Boolean(CommsApi.parseContextChannelMarker(channel.description))

  if (channel.is_private || isContextChannel) {
    const { data } = await supabase
      .from('comms_channel_members')
      .select('member_user_id')
      .eq('channel_id', channelId)

    return (data ?? [])
      .map((r) => r.member_user_id as string)
      .filter((id) => id !== excludeUserId)
  }

  const { data: members } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('organization_id', channel.organization_id)
  return (members ?? []).map((m) => m.id as string).filter((id) => id !== excludeUserId)
}

async function conversationRecipientUserIds(
  conversationId: string,
  excludeUserId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('comms_conversation_members')
    .select('member_user_id')
    .eq('conversation_id', conversationId)

  return (data ?? [])
    .map((r) => r.member_user_id as string)
    .filter((id) => id !== excludeUserId)
}

export async function getCommsRecipientUserIds(
  message: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>
): Promise<string[]> {
  if (message.channel_id) {
    return channelRecipientUserIds(message.channel_id, message.sender_id)
  }
  if (message.conversation_id) {
    return conversationRecipientUserIds(message.conversation_id, message.sender_id)
  }
  return []
}

export function commsNotificationDedupeKey(messageId: string): string {
  return `comms:${messageId}`
}

async function buildCommsNotificationInputs(
  message: Message,
  recipientIds: string[],
  organizationId: string,
  options?: { mentionedUserIds?: string[]; channelMention?: boolean }
): Promise<CreateNotificationInput[]> {

  let channelName: string | null = null
  let conversationLabel: string | null = null

  if (message.channel_id) {
    const ch = await supabase
      .from('comms_channels')
      .select('name')
      .eq('id', message.channel_id)
      .single()
    channelName = ch.data?.name ?? null
  }

  if (message.conversation_id) {
    const conv = await CommsApi.getConversations()
    const match = conv.find((c) => c.id === message.conversation_id)
    if (match) {
      conversationLabel =
        match.conversation_type === 'group' && match.name
          ? match.name
          : match.members?.find((m) => m.member_user_id !== message.sender_id)?.profile
              ?.full_name ?? 'Direct message'
    }
  }

  const senderName =
    message.sender_profile?.full_name?.trim() ||
    message.sender_profile?.email?.split('@')[0] ||
    'Someone'

  const title = channelName
    ? `New message in #${channelName}`
    : `Message from ${senderName}`

  const body = truncateContent(message.content)
  const linkPath = await resolveCommsLinkPath(message)
  const mentionedIds = new Set(options?.mentionedUserIds ?? [])

  return recipientIds.map((recipientUserId) => {
    const isMention = mentionedIds.has(recipientUserId) || Boolean(options?.channelMention)
    return {
      recipientUserId,
      organizationId,
      actorUserId: message.sender_id,
      sourceModule: 'comms',
      notificationType: isMention ? 'comms_mention' : 'comms_message',
      title: isMention
        ? channelName
          ? `Mentioned in #${channelName}`
          : `Mentioned by ${senderName}`
        : title,
      body,
      linkPath,
      dedupeKey: commsNotificationDedupeKey(message.id),
      metadata: {
        message_id: message.id,
        channel_id: message.channel_id,
        conversation_id: message.conversation_id,
        sender_name: senderName,
        channel_name: channelName,
        conversation_label: conversationLabel,
        is_mention: isMention,
      },
    }
  })
}

/** Sender client: notify all comms recipients (best-effort). */
export async function dispatchCommsMessageNotifications(message: Message): Promise<void> {
  if (!(await areNotificationsAvailable())) return

  let organizationId: string
  try {
    organizationId = await getOrganizationId()
  } catch {
    return
  }

  const mentionedUserIds = await CommsApi.getMentionedUserIdsForMessage(message.id)
  const { data: channelMentionRows } = await supabase
    .from('comms_message_mentions')
    .select('id')
    .eq('message_id', message.id)
    .eq('mention_kind', 'channel')
    .limit(1)
  const channelMention = (channelMentionRows?.length ?? 0) > 0

  const mentionOpts = { mentionedUserIds, channelMention }
  const recipientIds = await filterCommsNotificationRecipients(
    await getCommsRecipientUserIds(message),
    message,
    mentionOpts
  )
  if (recipientIds.length === 0) return

  const inputs = await buildCommsNotificationInputs(
    message,
    recipientIds,
    organizationId,
    mentionOpts
  )
  await createNotifications(inputs)
}

/**
 * Recipient client: record notification for the signed-in user when a comms message arrives.
 * Ensures the bell updates even if the sender could not insert rows for this recipient.
 */
export async function recordCommsNotificationForCurrentUser(message: Message): Promise<void> {
  if (!(await areNotificationsAvailable())) return

  const currentUserId = await getCurrentUserId()
  const mentionedUserIds = await CommsApi.getMentionedUserIdsForMessage(message.id)
  const { data: channelMentionRows } = await supabase
    .from('comms_message_mentions')
    .select('id')
    .eq('message_id', message.id)
    .eq('mention_kind', 'channel')
    .limit(1)
  const channelMention = (channelMentionRows?.length ?? 0) > 0
  const mentionOpts = { mentionedUserIds, channelMention }

  if (!(await isCurrentUserCommsRecipient(currentUserId, message, mentionOpts))) return
  if (!(await shouldDeliverCommsNotification(currentUserId, message, mentionOpts))) return

  let organizationId: string
  try {
    organizationId = await getOrganizationId()
  } catch {
    return
  }

  const inputs = await buildCommsNotificationInputs(
    message,
    [currentUserId],
    organizationId,
    mentionOpts
  )
  if (inputs[0]) {
    await createNotification(inputs[0])
  }
}

/** Whether the current user should receive a live comms alert for this message. */
export async function isCurrentUserCommsRecipient(
  currentUserId: string,
  message: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>,
  options?: { mentionedUserIds?: string[]; channelMention?: boolean }
): Promise<boolean> {
  if (message.sender_id === currentUserId) return false
  const recipients = await getCommsRecipientUserIds(message)
  if (!recipients.includes(currentUserId)) return false
  return shouldDeliverCommsNotification(currentUserId, message, options)
}

export async function enrichCommsMessageForDisplay(message: Message): Promise<Message> {
  if (message.sender_profile?.full_name || message.sender_profile?.email) {
    return message
  }
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, email')
    .eq('id', message.sender_id)
    .maybeSingle()
  if (!profile) return message
  return {
    ...message,
    sender_profile: profile,
  }
}

export function buildCommsToastPayload(
  message: Message,
  channelName?: string | null,
  linkPath?: string | null
): { title: string; body: string; linkPath: string } {
  const senderName =
    message.sender_profile?.full_name?.trim() ||
    message.sender_profile?.email?.split('@')[0] ||
    'Someone'
  const title = channelName
    ? `New message in #${channelName}`
    : `Message from ${senderName}`
  return {
    title,
    body: truncateContent(message.content),
    linkPath: linkPath ?? fallbackCommsLinkPath(message),
  }
}
