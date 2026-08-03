/**
 * Per-user comms preferences: mute/hide channels & DMs, mute individuals.
 */

import { supabase } from './supabase'
import { getCurrentUserId } from './auth-helpers'
import type { Message } from './comms-api'
import { removeChannelMember } from './comms-api'

export interface CommsUserPreferences {
  mutedChannelIds: Set<string>
  hiddenChannelIds: Set<string>
  mutedConversationIds: Set<string>
  hiddenConversationIds: Set<string>
  mutedUserIds: Set<string>
  mentionsOnlyChannelIds: Set<string>
  mentionsOnlyConversationIds: Set<string>
}

export const emptyCommsPreferences: CommsUserPreferences = {
  mutedChannelIds: new Set(),
  hiddenChannelIds: new Set(),
  mutedConversationIds: new Set(),
  hiddenConversationIds: new Set(),
  mutedUserIds: new Set(),
  mentionsOnlyChannelIds: new Set(),
  mentionsOnlyConversationIds: new Set(),
}

export async function getCommsPreferences(): Promise<CommsUserPreferences> {
  const userId = await getCurrentUserId()
  const [channelPrefs, convPrefs, userMutes] = await Promise.all([
    supabase
      .from('comms_channel_prefs')
      .select('channel_id, is_muted, is_hidden, notify_on_mentions_only')
      .eq('user_id', userId),
    supabase
      .from('comms_conversation_prefs')
      .select('conversation_id, is_muted, is_hidden, notify_on_mentions_only')
      .eq('user_id', userId),
    supabase.from('comms_user_mutes').select('muted_user_id').eq('user_id', userId),
  ])

  const prefs = { ...emptyCommsPreferences,
    mutedChannelIds: new Set<string>(),
    hiddenChannelIds: new Set<string>(),
    mutedConversationIds: new Set<string>(),
    hiddenConversationIds: new Set<string>(),
    mutedUserIds: new Set<string>(),
    mentionsOnlyChannelIds: new Set<string>(),
    mentionsOnlyConversationIds: new Set<string>(),
  }
  for (const row of channelPrefs.data ?? []) {
    if (row.is_muted) prefs.mutedChannelIds.add(row.channel_id as string)
    if (row.is_hidden) prefs.hiddenChannelIds.add(row.channel_id as string)
    if (row.notify_on_mentions_only) prefs.mentionsOnlyChannelIds.add(row.channel_id as string)
  }
  for (const row of convPrefs.data ?? []) {
    if (row.is_muted) prefs.mutedConversationIds.add(row.conversation_id as string)
    if (row.is_hidden) prefs.hiddenConversationIds.add(row.conversation_id as string)
    if (row.notify_on_mentions_only) {
      prefs.mentionsOnlyConversationIds.add(row.conversation_id as string)
    }
  }
  for (const row of userMutes.data ?? []) {
    prefs.mutedUserIds.add(row.muted_user_id as string)
  }
  return prefs
}

async function upsertChannelPref(
  channelId: string,
  patch: { is_muted?: boolean; is_hidden?: boolean; notify_on_mentions_only?: boolean }
): Promise<boolean> {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('comms_channel_prefs').upsert(
    {
      user_id: userId,
      channel_id: channelId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,channel_id' }
  )
  if (error) {
    console.error('Error updating channel prefs:', error)
    return false
  }
  return true
}

async function upsertConversationPref(
  conversationId: string,
  patch: { is_muted?: boolean; is_hidden?: boolean; notify_on_mentions_only?: boolean }
): Promise<boolean> {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('comms_conversation_prefs').upsert(
    {
      user_id: userId,
      conversation_id: conversationId,
      ...patch,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,conversation_id' }
  )
  if (error) {
    console.error('Error updating conversation prefs:', error)
    return false
  }
  return true
}

export async function setChannelMuted(channelId: string, muted: boolean): Promise<boolean> {
  return upsertChannelPref(channelId, { is_muted: muted })
}

export async function setChannelMentionsOnly(
  channelId: string,
  mentionsOnly: boolean
): Promise<boolean> {
  if (mentionsOnly) {
    return upsertChannelPref(channelId, { notify_on_mentions_only: true, is_muted: false })
  }
  return upsertChannelPref(channelId, { notify_on_mentions_only: false })
}

export async function setChannelHidden(channelId: string, hidden: boolean): Promise<boolean> {
  return upsertChannelPref(channelId, { is_hidden: hidden })
}

export async function setConversationMuted(conversationId: string, muted: boolean): Promise<boolean> {
  return upsertConversationPref(conversationId, { is_muted: muted })
}

export async function setConversationHidden(
  conversationId: string,
  hidden: boolean
): Promise<boolean> {
  return upsertConversationPref(conversationId, { is_hidden: hidden })
}

export async function setUserMuted(mutedUserId: string, muted: boolean): Promise<boolean> {
  const userId = await getCurrentUserId()
  if (muted) {
    const { error } = await supabase.from('comms_user_mutes').upsert(
      { user_id: userId, muted_user_id: mutedUserId },
      { onConflict: 'user_id,muted_user_id' }
    )
    if (error) {
      console.error('Error muting user:', error)
      return false
    }
    return true
  }
  const { error } = await supabase
    .from('comms_user_mutes')
    .delete()
    .eq('user_id', userId)
    .eq('muted_user_id', mutedUserId)
  if (error) {
    console.error('Error unmuting user:', error)
    return false
  }
  return true
}

export async function leaveChannel(channelId: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  return removeChannelMember(channelId, userId)
}

export async function leaveConversation(conversationId: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('comms_conversation_members')
    .delete()
    .eq('conversation_id', conversationId)
    .eq('member_user_id', userId)
  if (error) {
    console.error('Error leaving conversation:', error)
    return false
  }
  await setConversationHidden(conversationId, true)
  return true
}

/** Hide a DM/group from the sidebar (does not remove membership). */
export async function hideConversation(conversationId: string): Promise<boolean> {
  return setConversationHidden(conversationId, true)
}

export async function unhideConversation(conversationId: string): Promise<boolean> {
  return setConversationHidden(conversationId, false)
}

export async function unhideChannel(channelId: string): Promise<boolean> {
  return setChannelHidden(channelId, false)
}

export async function getUserChannelMembershipIds(): Promise<Set<string>> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_channel_members')
    .select('channel_id')
    .eq('member_user_id', userId)

  if (error) {
    console.error('Error fetching channel memberships:', error)
    return new Set()
  }
  return new Set((data ?? []).map(r => r.channel_id as string))
}

/** Filter notification recipients based on mute prefs and optional mentions. */
export async function filterCommsNotificationRecipients(
  recipientIds: string[],
  message: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>,
  options?: { mentionedUserIds?: string[]; channelMention?: boolean }
): Promise<string[]> {
  if (recipientIds.length === 0) return []

  let filtered = [...recipientIds]
  const mentioned = new Set(options?.mentionedUserIds ?? [])
  const channelMention = Boolean(options?.channelMention)

  const { data: userMutes } = await supabase
    .from('comms_user_mutes')
    .select('user_id')
    .in('user_id', filtered)
    .eq('muted_user_id', message.sender_id)

  const mutedSender = new Set((userMutes ?? []).map((r) => r.user_id as string))
  filtered = filtered.filter((id) => !mutedSender.has(id))
  if (filtered.length === 0) return []

  if (message.channel_id) {
    const { data: channelPrefs } = await supabase
      .from('comms_channel_prefs')
      .select('user_id, is_muted, notify_on_mentions_only')
      .in('user_id', filtered)
      .eq('channel_id', message.channel_id)

    const mutedFully = new Set<string>()
    const mentionsOnly = new Set<string>()
    for (const row of channelPrefs ?? []) {
      const uid = row.user_id as string
      if (row.notify_on_mentions_only) mentionsOnly.add(uid)
      else if (row.is_muted) mutedFully.add(uid)
    }

    filtered = filtered.filter((id) => {
      const isMentioned = channelMention || mentioned.has(id)
      if (mutedFully.has(id)) return isMentioned
      if (mentionsOnly.has(id)) return isMentioned
      return true
    })
  }

  if (message.conversation_id) {
    const { data: convPrefs } = await supabase
      .from('comms_conversation_prefs')
      .select('user_id, is_muted, notify_on_mentions_only')
      .in('user_id', filtered)
      .eq('conversation_id', message.conversation_id)

    const mutedFully = new Set<string>()
    const mentionsOnly = new Set<string>()
    for (const row of convPrefs ?? []) {
      const uid = row.user_id as string
      if (row.notify_on_mentions_only) mentionsOnly.add(uid)
      else if (row.is_muted) mutedFully.add(uid)
    }

    filtered = filtered.filter((id) => {
      const isMentioned = mentioned.has(id)
      if (mutedFully.has(id)) return isMentioned
      if (mentionsOnly.has(id)) return isMentioned
      return true
    })
  }

  return filtered
}

export async function shouldDeliverCommsNotification(
  recipientId: string,
  message: Pick<Message, 'channel_id' | 'conversation_id' | 'sender_id'>,
  options?: { mentionedUserIds?: string[]; channelMention?: boolean }
): Promise<boolean> {
  const [result] = await filterCommsNotificationRecipients([recipientId], message, options)
  return result === recipientId
}
