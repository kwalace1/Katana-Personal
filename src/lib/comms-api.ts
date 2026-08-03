/**
 * Katana Comms API Layer
 * All database operations for internal communication
 */

import { supabase } from './supabase'
import { getCurrentUserId } from './auth-helpers'
import { dispatchCommsMessageNotifications } from './notification-comms'

async function resolveOrganizationId(providedOrgId?: string): Promise<string> {
  if (providedOrgId) return providedOrgId
  const userId = await getCurrentUserId()
  const { data } = await supabase
    .from('user_profiles')
    .select('organization_id')
    .eq('id', userId)
    .single()
  if (!data?.organization_id) throw new Error('No organization found for current user')
  return data.organization_id
}

// ==================== TYPE DEFINITIONS ====================

export type CommsContextType = 'task' | 'client' | 'employee' | 'project' | 'job' | 'invoice'

export interface Channel {
  id: string
  organization_id: string
  name: string
  description: string | null
  channel_type: 'department' | 'team' | 'project' | 'general' | 'announcement'
  is_private: boolean
  posting_mode?: 'open' | 'admins_only'
  context_type?: CommsContextType | null
  context_id?: string | null
  created_by: string
  user_id: string
  created_at: string
  updated_at: string
}

export interface ChannelMember {
  id: string
  channel_id: string
  member_user_id: string
  role: 'admin' | 'member'
  user_id: string
  joined_at: string
  profile?: UserProfileSummary | null
}

export interface Conversation {
  id: string
  organization_id: string
  conversation_type: 'direct' | 'group'
  name: string | null
  created_by: string
  user_id: string
  created_at: string
  updated_at: string
  members?: ConversationMember[]
}

export interface ConversationMember {
  id: string
  conversation_id: string
  member_user_id: string
  user_id: string
  joined_at: string
  profile?: UserProfileSummary | null
}

export interface Message {
  id: string
  channel_id: string | null
  conversation_id: string | null
  sender_id: string
  content: string
  parent_message_id: string | null
  user_id: string
  created_at: string
  updated_at: string
  sender_profile?: UserProfileSummary | null
  reply_count?: number
  attachments?: MessageAttachment[]
}

export interface MessageAttachment {
  id: string
  message_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  user_id: string
  created_at: string
  public_url?: string | null
}

export interface MessageMention {
  id: string
  message_id: string
  mentioned_user_id: string | null
  organization_id: string
  mention_kind: 'user' | 'channel'
  created_at: string
}

export interface CommsUnreadCounts {
  channels: Record<string, number>
  conversations: Record<string, number>
  total: number
}

export interface CommsSearchResult {
  message: Message
  channel_name: string | null
  conversation_label: string | null
  rank: number
}

export interface MessageReaction {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
  profile?: UserProfileSummary | null
}

export interface ReactionSummary {
  emoji: string
  count: number
  userIds: string[]
  reactedByMe: boolean
}

export interface ContextLink {
  id: string
  message_id: string
  context_type: CommsContextType
  context_id: string
  user_id: string
  created_at: string
}

export interface UserProfileSummary {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string
}

// ==================== CHANNELS ====================

export async function getAllChannels(): Promise<Channel[]> {
  const { data, error } = await supabase
    .from('comms_channels')
    .select('*')
    .order('name')

  if (error) {
    console.error('Error fetching channels:', error)
    return []
  }
  return data || []
}

/** Org-wide channel for embedded cross-module discussions. */
export async function getOrCreateGeneralChannel(): Promise<Channel | null> {
  const channels = await getAllChannels()
  const existing = channels.find((c) => c.channel_type === 'general')
  if (existing) return existing
  return createChannel({
    name: 'General',
    description: 'Organization-wide discussions linked to records across modules',
    channel_type: 'general',
    is_private: false,
  })
}

/** Durable marker stored in channel.description to bind a channel to a module record. */
export const CONTEXT_CHANNEL_MARKER_PREFIX = 'katana-context:'

export function buildContextChannelMarker(
  contextType: CommsContextType,
  contextId: string
): string {
  return `${CONTEXT_CHANNEL_MARKER_PREFIX}${contextType}:${contextId}`
}

export function parseContextChannelMarker(
  description: string | null | undefined
): { contextType: CommsContextType; contextId: string } | null {
  if (!description) return null
  const match = description.match(
    /katana-context:(task|client|employee|project|job|invoice):([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  )
  if (!match?.[1] || !match[2]) return null
  return {
    contextType: match[1].toLowerCase() as CommsContextType,
    contextId: match[2].toLowerCase(),
  }
}

/** Deep link for a module context record (used by notifications and Launchpad). */
export function contextRecordPath(
  contextType: CommsContextType,
  contextId: string
): string | null {
  switch (contextType) {
    case 'project':
      return `/projects/${contextId}`
    case 'task':
      // Task threads live on the parent project when known; otherwise Projects home.
      return '/projects'
    case 'job':
      return '/workforce'
    case 'employee':
      return '/hr'
    case 'client':
      return '/customer-success'
    case 'invoice':
      return '/customer-success'
    default:
      return null
  }
}

function channelTypeForContext(contextType: CommsContextType): Channel['channel_type'] {
  return contextType === 'project' ? 'project' : 'team'
}

function defaultContextChannelName(
  contextType: CommsContextType,
  displayName?: string
): string {
  const trimmed = displayName?.trim()
  if (trimmed) return trimmed.slice(0, 80)
  const labels: Record<CommsContextType, string> = {
    project: 'Project discussion',
    task: 'Task discussion',
    client: 'Client discussion',
    employee: 'Employee discussion',
    job: 'Job discussion',
    invoice: 'Invoice discussion',
  }
  return labels[contextType]
}

/** Ensure the signed-in user can participate in a private context channel. */
export async function ensureCurrentUserChannelMember(channelId: string): Promise<void> {
  const userId = await getCurrentUserId()
  const { data: existing } = await supabase
    .from('comms_channel_members')
    .select('id')
    .eq('channel_id', channelId)
    .eq('member_user_id', userId)
    .maybeSingle()
  if (existing) return
  await addChannelMember(channelId, userId, 'member')
}

/**
 * Resolve a dedicated Comms channel for a module record (project, task, etc.).
 * Replaces posting embedded discussions into #General.
 */
export async function getOrCreateChannelForContext(
  contextType: CommsContextType,
  contextId: string,
  options?: { displayName?: string }
): Promise<Channel | null> {
  if (!contextId) return null
  const marker = buildContextChannelMarker(contextType, contextId)

  // Prefer durable context columns
  const { data: byContext } = await supabase
    .from('comms_channels')
    .select('*')
    .eq('context_type', contextType)
    .eq('context_id', contextId)
    .limit(1)
    .maybeSingle()

  if (byContext) {
    await ensureCurrentUserChannelMember(byContext.id)
    return byContext as Channel
  }

  const { data: matched, error: lookupError } = await supabase
    .from('comms_channels')
    .select('*')
    .ilike('description', `%${marker}%`)
    .limit(1)
    .maybeSingle()

  if (lookupError) {
    console.error('Error looking up context channel:', lookupError)
  }

  if (matched) {
    if (!matched.context_type || !matched.context_id) {
      await supabase
        .from('comms_channels')
        .update({ context_type: contextType, context_id: contextId })
        .eq('id', matched.id)
    }
    await ensureCurrentUserChannelMember(matched.id)
    return { ...matched, context_type: contextType, context_id: contextId } as Channel
  }

  const channels = await getAllChannels()
  const existing = channels.find(
    (c) =>
      (c.context_type === contextType && c.context_id === contextId) ||
      c.description?.includes(marker)
  )
  if (existing) {
    await ensureCurrentUserChannelMember(existing.id)
    return existing
  }

  return createChannel({
    name: defaultContextChannelName(contextType, options?.displayName),
    description: `${marker} Module discussion for ${contextType} ${contextId}`,
    channel_type: channelTypeForContext(contextType),
    is_private: false,
    context_type: contextType,
    context_id: contextId,
  })
}

export async function getChannelById(channelId: string): Promise<Channel | null> {
  const { data, error } = await supabase
    .from('comms_channels')
    .select('*')
    .eq('id', channelId)
    .single()

  if (error) {
    console.error('Error fetching channel:', error)
    return null
  }
  return data
}

export async function createChannel(
  channel: Pick<Channel, 'name' | 'description' | 'channel_type' | 'is_private'> & {
    organization_id?: string
    posting_mode?: 'open' | 'admins_only'
    context_type?: CommsContextType | null
    context_id?: string | null
  }
): Promise<Channel | null> {
  const userId = await getCurrentUserId()
  const organizationId = await resolveOrganizationId(channel.organization_id || undefined)
  const postingMode =
    channel.posting_mode ??
    (channel.channel_type === 'announcement' ? 'admins_only' : 'open')
  const { data, error } = await supabase
    .from('comms_channels')
    .insert({
      name: channel.name,
      description: channel.description,
      channel_type: channel.channel_type,
      is_private: channel.is_private,
      posting_mode: postingMode,
      context_type: channel.context_type ?? null,
      context_id: channel.context_id ?? null,
      organization_id: organizationId,
      created_by: userId,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating channel:', error)
    return null
  }

  if (data) {
    await addChannelMember(data.id, userId, 'admin')
  }

  return data
}

export async function updateChannel(
  channelId: string,
  updates: Partial<Pick<Channel, 'name' | 'description' | 'channel_type' | 'is_private'>>
): Promise<Channel | null> {
  const { data, error } = await supabase
    .from('comms_channels')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', channelId)
    .select()
    .single()

  if (error) {
    console.error('Error updating channel:', error)
    return null
  }
  return data
}

export async function deleteChannel(channelId: string): Promise<boolean> {
  const { error } = await supabase
    .from('comms_channels')
    .delete()
    .eq('id', channelId)

  if (error) {
    console.error('Error deleting channel:', error)
    return false
  }
  return true
}

// ==================== CHANNEL MEMBERS ====================

export async function getChannelMembers(channelId: string): Promise<ChannelMember[]> {
  const { data, error } = await supabase
    .from('comms_channel_members')
    .select(`
      *,
      profile:user_profiles!fk_channel_member_profile(id, full_name, avatar_url, email)
    `)
    .eq('channel_id', channelId)

  if (error) {
    console.error('Error fetching channel members:', error)
    return []
  }
  return (data || []).map(m => ({
    ...m,
    profile: m.profile as unknown as UserProfileSummary | null,
  }))
}

export async function addChannelMember(
  channelId: string,
  memberUserId: string,
  role: 'admin' | 'member' = 'member'
): Promise<ChannelMember | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_channel_members')
    .insert({
      channel_id: channelId,
      member_user_id: memberUserId,
      role,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding channel member:', error)
    return null
  }
  return data
}

export async function removeChannelMember(channelId: string, memberUserId: string): Promise<boolean> {
  const { error } = await supabase
    .from('comms_channel_members')
    .delete()
    .eq('channel_id', channelId)
    .eq('member_user_id', memberUserId)

  if (error) {
    console.error('Error removing channel member:', error)
    return false
  }
  return true
}

// ==================== CONVERSATION MEMBERS (lookup) ====================

export async function getConversationMembers(conversationId: string): Promise<ConversationMember[]> {
  const { data, error } = await supabase
    .from('comms_conversation_members')
    .select(`
      *,
      profile:user_profiles!fk_conv_member_profile(id, full_name, avatar_url, email)
    `)
    .eq('conversation_id', conversationId)

  if (error) {
    console.error('Error fetching conversation members:', error)
    return []
  }
  return (data || []).map(m => ({
    ...m,
    profile: m.profile as unknown as UserProfileSummary | null,
  }))
}

// ==================== CONVERSATIONS ====================

export async function getConversations(): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('comms_conversations')
    .select(`
      *,
      members:comms_conversation_members(
        *,
        profile:user_profiles!fk_conv_member_profile(id, full_name, avatar_url, email)
      )
    `)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching conversations:', error)
    return []
  }
  return (data || []).map(c => ({
    ...c,
    members: (c.members || []).map((m: Record<string, unknown>) => ({
      ...m,
      profile: m.profile as unknown as UserProfileSummary | null,
    })),
  }))
}

export async function getOrCreateDirectConversation(
  otherUserId: string,
  organizationId?: string
): Promise<Conversation | null> {
  const userId = await getCurrentUserId()
  const orgId = await resolveOrganizationId(organizationId || undefined)

  // Find existing direct conversation between these two users
  const { data: existing } = await supabase
    .from('comms_conversations')
    .select(`
      *,
      members:comms_conversation_members(*)
    `)
    .eq('conversation_type', 'direct')
    .eq('organization_id', orgId)

  const found = existing?.find(c =>
    c.members?.length === 2 &&
    c.members.some((m: Record<string, unknown>) => m.member_user_id === userId) &&
    c.members.some((m: Record<string, unknown>) => m.member_user_id === otherUserId)
  )

  if (found) return found as Conversation

  // Create new conversation
  const { data: conv, error } = await supabase
    .from('comms_conversations')
    .insert({
      organization_id: orgId,
      conversation_type: 'direct',
      created_by: userId,
      user_id: userId,
    })
    .select()
    .single()

  if (error || !conv) {
    console.error('Error creating conversation:', error)
    return null
  }

  // Add both members (trigger auto-sets user_id = member_user_id)
  await supabase.from('comms_conversation_members').insert([
    { conversation_id: conv.id, member_user_id: userId, user_id: userId },
    { conversation_id: conv.id, member_user_id: otherUserId, user_id: userId },
  ])

  // Re-fetch with members joined
  const { data: full } = await supabase
    .from('comms_conversations')
    .select(`
      *,
      members:comms_conversation_members(
        *,
        profile:user_profiles!fk_conv_member_profile(id, full_name, avatar_url, email)
      )
    `)
    .eq('id', conv.id)
    .single()

  return (full as Conversation) ?? conv
}

export async function createGroupConversation(
  name: string,
  memberUserIds: string[],
  organizationId?: string
): Promise<Conversation | null> {
  const userId = await getCurrentUserId()
  const orgId = await resolveOrganizationId(organizationId || undefined)

  const { data: conv, error } = await supabase
    .from('comms_conversations')
    .insert({
      organization_id: orgId,
      conversation_type: 'group',
      name,
      created_by: userId,
      user_id: userId,
    })
    .select()
    .single()

  if (error || !conv) {
    console.error('Error creating group conversation:', error)
    return null
  }

  // Add all members (trigger auto-sets user_id = member_user_id)
  const allMembers = [...new Set([userId, ...memberUserIds])]
  await supabase.from('comms_conversation_members').insert(
    allMembers.map(mid => ({
      conversation_id: conv.id,
      member_user_id: mid,
      user_id: userId,
    }))
  )

  // Re-fetch with members joined
  const { data: full } = await supabase
    .from('comms_conversations')
    .select(`
      *,
      members:comms_conversation_members(
        *,
        profile:user_profiles!fk_conv_member_profile(id, full_name, avatar_url, email)
      )
    `)
    .eq('id', conv.id)
    .single()

  return (full as Conversation) ?? conv
}

// ==================== MESSAGES ====================

function mapMessageRows(rows: Record<string, unknown>[]): Message[] {
  return rows.reverse().map(m => ({
    ...m,
    sender_profile: m.sender_profile as unknown as UserProfileSummary | null,
  })) as Message[]
}

export async function getChannelMessages(
  channelId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  let query = supabase
    .from('comms_messages')
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .eq('channel_id', channelId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching channel messages:', error)
    return []
  }
  const messages = mapMessageRows((data || []) as Record<string, unknown>[])
  const counts = await getReplyCountsForMessages(messages.map(m => m.id))
  return messages.map(m => ({ ...m, reply_count: counts[m.id] ?? 0 }))
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  let query = supabase
    .from('comms_messages')
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .eq('conversation_id', conversationId)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (before) {
    query = query.lt('created_at', before)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching conversation messages:', error)
    return []
  }
  const messages = mapMessageRows((data || []) as Record<string, unknown>[])
  const counts = await getReplyCountsForMessages(messages.map(m => m.id))
  return messages.map(m => ({ ...m, reply_count: counts[m.id] ?? 0 }))
}

export async function getThreadReplies(parentMessageId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('comms_messages')
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .eq('parent_message_id', parentMessageId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching thread replies:', error)
    return []
  }
  return ((data || []) as Record<string, unknown>[]).map(m => ({
    ...m,
    sender_profile: m.sender_profile as unknown as UserProfileSummary | null,
  })) as Message[]
}

export async function getReplyCountsForMessages(
  parentIds: string[]
): Promise<Record<string, number>> {
  if (parentIds.length === 0) return {}
  const { data, error } = await supabase
    .from('comms_messages')
    .select('parent_message_id')
    .in('parent_message_id', parentIds)

  if (error) {
    console.error('Error fetching reply counts:', error)
    return {}
  }
  const counts: Record<string, number> = {}
  for (const row of data || []) {
    const pid = row.parent_message_id as string
    if (pid) counts[pid] = (counts[pid] ?? 0) + 1
  }
  return counts
}

export async function sendMessage(
  message: Pick<Message, 'content'> & {
    channel_id?: string
    conversation_id?: string
    parent_message_id?: string
    /** Pre-uploaded attachment metadata to attach after insert. */
    attachments?: Array<{ path: string; fileName: string; mimeType: string; size: number }>
  }
): Promise<Message | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_messages')
    .insert({
      channel_id: message.channel_id || null,
      conversation_id: message.conversation_id || null,
      sender_id: userId,
      content: message.content,
      parent_message_id: message.parent_message_id || null,
      user_id: userId,
    })
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .single()

  if (error) {
    console.error('Error sending message:', error)
    return null
  }

  if (message.conversation_id) {
    await supabase
      .from('comms_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.conversation_id)
  }
  if (message.channel_id) {
    await supabase
      .from('comms_channels')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', message.channel_id)
  }

  let sent = data
    ? ({
        ...data,
        sender_profile: data.sender_profile as unknown as UserProfileSummary | null,
      } as Message)
    : null

  if (sent) {
    // Mentions must be saved before notifications so mute/mention rules apply.
    try {
      const members = await getOrganizationMembers()
      const { userIds, channelMention } = await resolveMentionedUserIds(message.content, members)
      await saveMessageMentions(sent.id, userIds, channelMention)
    } catch (e) {
      console.error('Error resolving mentions:', e)
    }

    if (message.attachments?.length) {
      const atts = await saveMessageAttachments(sent.id, message.attachments)
      sent = { ...sent, attachments: atts }
    }

    void dispatchCommsMessageNotifications(sent)
  }

  return sent
}

export function isMessageEdited(message: Pick<Message, 'created_at' | 'updated_at'>): boolean {
  return message.updated_at > message.created_at
}

export async function updateMessage(messageId: string, content: string): Promise<Message | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_messages')
    .update({ content, updated_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_id', userId)
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .single()

  if (error) {
    console.error('Error updating message:', error)
    return null
  }
  return data
    ? ({
        ...data,
        sender_profile: data.sender_profile as unknown as UserProfileSummary | null,
      } as Message)
    : null
}

export async function deleteMessage(messageId: string): Promise<boolean> {
  const userId = await getCurrentUserId()
  const { error } = await supabase
    .from('comms_messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', userId)

  if (error) {
    console.error('Error deleting message:', error)
    return false
  }
  return true
}

// ==================== CONTEXT LINKS ====================

export async function addContextLink(
  messageId: string,
  contextType: ContextLink['context_type'],
  contextId: string
): Promise<ContextLink | null> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_context_links')
    .insert({
      message_id: messageId,
      context_type: contextType,
      context_id: contextId,
      user_id: userId,
    })
    .select()
    .single()

  if (error) {
    console.error('Error adding context link:', error)
    return null
  }
  return data
}

export async function getContextLinks(messageId: string): Promise<ContextLink[]> {
  const { data, error } = await supabase
    .from('comms_context_links')
    .select('*')
    .eq('message_id', messageId)

  if (error) {
    console.error('Error fetching context links:', error)
    return []
  }
  return data || []
}

export async function getMessagesForContext(
  contextType: ContextLink['context_type'],
  contextId: string
): Promise<Message[]> {
  const { data, error } = await supabase
    .from('comms_context_links')
    .select(`
      message:message_id(
        *,
        sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
      )
    `)
    .eq('context_type', contextType)
    .eq('context_id', contextId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching context messages:', error)
    return []
  }
  return (data || [])
    .map(d => d.message as unknown as Message)
    .filter(Boolean)
}

// ==================== REALTIME SUBSCRIPTIONS ====================

export interface MessageSubscriptionCallbacks {
  onInsert: (message: Message) => void
  onUpdate?: (message: Message) => void
  onDelete?: (messageId: string) => void
}

async function enrichMessageWithProfile(msg: Message): Promise<Message> {
  if (msg.sender_profile) return msg
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, email')
    .eq('id', msg.sender_id)
    .single()
  return { ...msg, sender_profile: profile }
}

function subscribeToMessages(
  filterColumn: 'channel_id' | 'conversation_id',
  targetId: string,
  channelKey: string,
  callbacks: MessageSubscriptionCallbacks
) {
  const filter = `${filterColumn}=eq.${targetId}`

  const channel = supabase
    .channel(channelKey)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comms_messages', filter },
      async payload => {
        const newMsg = await enrichMessageWithProfile(payload.new as Message)
        callbacks.onInsert(newMsg)
      }
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'comms_messages', filter },
      async payload => {
        if (!callbacks.onUpdate) return
        const updated = await enrichMessageWithProfile(payload.new as Message)
        callbacks.onUpdate(updated)
      }
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'comms_messages', filter },
      payload => {
        const old = payload.old as { id?: string }
        if (old?.id) callbacks.onDelete?.(old.id)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

export function subscribeToChannelMessages(
  channelId: string,
  callbacks: MessageSubscriptionCallbacks
) {
  return subscribeToMessages('channel_id', channelId, `comms-channel-${channelId}`, callbacks)
}

export function subscribeToConversationMessages(
  conversationId: string,
  callbacks: MessageSubscriptionCallbacks
) {
  return subscribeToMessages(
    'conversation_id',
    conversationId,
    `comms-conversation-${conversationId}`,
    callbacks
  )
}

// ==================== REACTIONS ====================

export async function getReactionsForMessages(
  messageIds: string[]
): Promise<Record<string, MessageReaction[]>> {
  if (messageIds.length === 0) return {}
  const { data, error } = await supabase
    .from('comms_message_reactions')
    .select('*')
    .in('message_id', messageIds)

  if (error) {
    console.error('Error fetching reactions:', error)
    return {}
  }

  const grouped: Record<string, MessageReaction[]> = {}
  for (const row of data || []) {
    const reaction = row as MessageReaction
    if (!grouped[reaction.message_id]) grouped[reaction.message_id] = []
    grouped[reaction.message_id].push(reaction)
  }
  return grouped
}

export function summarizeReactions(
  reactions: MessageReaction[],
  currentUserId: string
): ReactionSummary[] {
  const map = new Map<string, { count: number; userIds: string[] }>()
  for (const r of reactions) {
    const existing = map.get(r.emoji) ?? { count: 0, userIds: [] }
    existing.count += 1
    existing.userIds.push(r.user_id)
    map.set(r.emoji, existing)
  }
  return Array.from(map.entries())
    .map(([emoji, { count, userIds }]) => ({
      emoji,
      count,
      userIds,
      reactedByMe: userIds.includes(currentUserId),
    }))
    .sort((a, b) => b.count - a.count)
}

export async function toggleReaction(
  messageId: string,
  emoji: string
): Promise<'added' | 'removed' | null> {
  const userId = await getCurrentUserId()
  const { data: existing } = await supabase
    .from('comms_message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', userId)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('comms_message_reactions')
      .delete()
      .eq('id', existing.id)
    if (error) {
      console.error('Error removing reaction:', error)
      return null
    }
    return 'removed'
  }

  const { error } = await supabase.from('comms_message_reactions').insert({
    message_id: messageId,
    user_id: userId,
    emoji,
  })
  if (error) {
    console.error('Error adding reaction:', error)
    return null
  }
  return 'added'
}

export function subscribeToMessageReactions(
  messageIds: string[],
  onChange: () => void
) {
  if (messageIds.length === 0) return () => undefined

  const channel = supabase
    .channel(`comms-reactions-${messageIds.slice(0, 5).join('-')}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'comms_message_reactions',
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as { message_id?: string } | null
        if (row?.message_id && messageIds.includes(row.message_id)) {
          onChange()
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

// ==================== INCOMING MESSAGES (portal notifications) ====================

export async function getIncomingCommsMessages(options: {
  conversationIds: string[]
  channelIds: string[]
  excludeSenderId: string
  since: string | null
  limit?: number
}): Promise<Message[]> {
  const { conversationIds, channelIds, excludeSenderId, since, limit = 30 } = options
  const convIds = conversationIds.filter(Boolean)
  const chIds = channelIds.filter(Boolean)
  if (convIds.length === 0 && chIds.length === 0) return []

  const orParts: string[] = []
  if (convIds.length > 0) {
    orParts.push(`conversation_id.in.(${convIds.join(',')})`)
  }
  if (chIds.length > 0) {
    orParts.push(`channel_id.in.(${chIds.join(',')})`)
  }

  let query = supabase
    .from('comms_messages')
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .neq('sender_id', excludeSenderId)
    .or(orParts.join(','))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gt('created_at', since)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching incoming comms messages:', error)
    return []
  }

  return ((data || []) as Record<string, unknown>[]).map((m) => ({
    ...m,
    sender_profile: m.sender_profile as unknown as UserProfileSummary | null,
  })) as Message[]
}

export async function getRecentCommsMessages(limit: number = 50): Promise<Message[]> {
  const { data, error } = await supabase
    .from('comms_messages')
    .select(`
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `)
    .is('parent_message_id', null)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent comms messages:', error)
    return []
  }

  return ((data || []) as Record<string, unknown>[]).map((m) => ({
    ...m,
    sender_profile: m.sender_profile as unknown as UserProfileSummary | null,
  })) as Message[]
}

// ==================== ORG MEMBERS LOOKUP ====================

export async function getOrganizationMembers(organizationId?: string): Promise<UserProfileSummary[]> {
  let orgId = organizationId

  // If no org ID provided, look it up from the current user's profile
  if (!orgId) {
    const userId = await getCurrentUserId()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('organization_id')
      .eq('id', userId)
      .single()
    orgId = profile?.organization_id
  }

  if (!orgId) {
    console.error('No organization ID available')
    return []
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, full_name, avatar_url, email')
    .eq('organization_id', orgId)
    .order('full_name')

  if (error) {
    console.error('Error fetching org members:', error)
    return []
  }
  return data || []
}

// ==================== READ CURSORS (M1) ====================

export async function markChannelRead(
  channelId: string,
  lastReadAt: string = new Date().toISOString()
): Promise<void> {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('comms_read_cursors').upsert(
    {
      user_id: userId,
      channel_id: channelId,
      conversation_id: null,
      last_read_at: lastReadAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,channel_id' }
  )
  if (error) {
    await supabase
      .from('comms_read_cursors')
      .delete()
      .eq('user_id', userId)
      .eq('channel_id', channelId)
    await supabase.from('comms_read_cursors').insert({
      user_id: userId,
      channel_id: channelId,
      conversation_id: null,
      last_read_at: lastReadAt,
      updated_at: new Date().toISOString(),
    })
  }
}

export async function markConversationRead(
  conversationId: string,
  lastReadAt: string = new Date().toISOString()
): Promise<void> {
  const userId = await getCurrentUserId()
  const { error } = await supabase.from('comms_read_cursors').upsert(
    {
      user_id: userId,
      channel_id: null,
      conversation_id: conversationId,
      last_read_at: lastReadAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,conversation_id' }
  )
  if (error) {
    await supabase
      .from('comms_read_cursors')
      .delete()
      .eq('user_id', userId)
      .eq('conversation_id', conversationId)
    await supabase.from('comms_read_cursors').insert({
      user_id: userId,
      channel_id: null,
      conversation_id: conversationId,
      last_read_at: lastReadAt,
      updated_at: new Date().toISOString(),
    })
  }
}

export async function getReadCursors(): Promise<{
  channels: Record<string, string>
  conversations: Record<string, string>
}> {
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_read_cursors')
    .select('channel_id, conversation_id, last_read_at')
    .eq('user_id', userId)

  const channels: Record<string, string> = {}
  const conversations: Record<string, string> = {}
  if (error) {
    console.error('Error fetching read cursors:', error)
    return { channels, conversations }
  }
  for (const row of data || []) {
    if (row.channel_id) channels[row.channel_id as string] = row.last_read_at as string
    if (row.conversation_id) {
      conversations[row.conversation_id as string] = row.last_read_at as string
    }
  }
  return { channels, conversations }
}

export async function getUnreadCounts(
  channelIds: string[],
  conversationIds: string[]
): Promise<CommsUnreadCounts> {
  const userId = await getCurrentUserId()
  const cursors = await getReadCursors()
  const result: CommsUnreadCounts = { channels: {}, conversations: {}, total: 0 }

  await Promise.all([
    ...channelIds.map(async (id) => {
      const since = cursors.channels[id] ?? '1970-01-01T00:00:00.000Z'
      const { count, error } = await supabase
        .from('comms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('channel_id', id)
        .is('parent_message_id', null)
        .neq('sender_id', userId)
        .gt('created_at', since)
      if (error) {
        console.error('Error counting channel unread:', error)
        return
      }
      const n = count ?? 0
      if (n > 0) {
        result.channels[id] = n
        result.total += n
      }
    }),
    ...conversationIds.map(async (id) => {
      const since = cursors.conversations[id] ?? '1970-01-01T00:00:00.000Z'
      const { count, error } = await supabase
        .from('comms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', id)
        .is('parent_message_id', null)
        .neq('sender_id', userId)
        .gt('created_at', since)
      if (error) {
        console.error('Error counting conversation unread:', error)
        return
      }
      const n = count ?? 0
      if (n > 0) {
        result.conversations[id] = n
        result.total += n
      }
    }),
  ])

  return result
}

export async function getOrCreateAnnouncementsChannel(): Promise<Channel | null> {
  const channels = await getAllChannels()
  const existing = channels.find((c) => c.channel_type === 'announcement')
  if (existing) return existing
  return createChannel({
    name: 'announcements',
    description: 'Company-wide announcements',
    channel_type: 'announcement',
    is_private: false,
    posting_mode: 'admins_only',
  })
}

// ==================== MENTIONS (M2) ====================

export function parseMentionTokens(content: string): string[] {
  const tokens = new Set<string>()
  if (/\B@channel\b/i.test(content)) tokens.add('channel')
  // Prefer Title Case multi-word names (@Alex Smith) over gobbling lowercase connectors
  const re = /@([A-Za-z][\w.+-]*(?:\s+[A-Z][\w.+-]*){0,2})/g
  let match: RegExpExecArray | null
  while ((match = re.exec(content)) !== null) {
    const raw = match[1]?.trim()
    if (raw && raw.toLowerCase() !== 'channel') tokens.add(raw)
  }
  return Array.from(tokens)
}

export async function resolveMentionedUserIds(
  content: string,
  members: UserProfileSummary[]
): Promise<{ userIds: string[]; channelMention: boolean }> {
  const tokens = parseMentionTokens(content)
  const channelMention = tokens.some((t) => t.toLowerCase() === 'channel')
  const userIds = new Set<string>()

  for (const token of tokens) {
    if (token.toLowerCase() === 'channel') continue
    const lower = token.toLowerCase()
    const match = members.find((m) => {
      const name = m.full_name?.trim().toLowerCase()
      const email = m.email?.toLowerCase()
      const emailLocal = email?.split('@')[0]
      return name === lower || email === lower || emailLocal === lower
    })
    if (match) userIds.add(match.id)
  }

  return { userIds: Array.from(userIds), channelMention }
}

export async function saveMessageMentions(
  messageId: string,
  mentionedUserIds: string[],
  channelMention: boolean
): Promise<void> {
  if (mentionedUserIds.length === 0 && !channelMention) return
  const organizationId = await resolveOrganizationId()
  const rows: Array<{
    message_id: string
    mentioned_user_id: string | null
    organization_id: string
    mention_kind: 'user' | 'channel'
  }> = mentionedUserIds.map((uid) => ({
    message_id: messageId,
    mentioned_user_id: uid,
    organization_id: organizationId,
    mention_kind: 'user' as const,
  }))
  if (channelMention) {
    rows.push({
      message_id: messageId,
      mentioned_user_id: null,
      organization_id: organizationId,
      mention_kind: 'channel',
    })
  }
  const { error } = await supabase.from('comms_message_mentions').insert(rows)
  if (error) console.error('Error saving mentions:', error)
}

export async function getMentionedUserIdsForMessage(messageId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('comms_message_mentions')
    .select('mentioned_user_id, mention_kind')
    .eq('message_id', messageId)
  if (error) {
    console.error('Error fetching mentions:', error)
    return []
  }
  return (data || [])
    .filter((r) => r.mention_kind === 'user' && r.mentioned_user_id)
    .map((r) => r.mentioned_user_id as string)
}

// ==================== SEARCH (M4) ====================

export async function searchMessages(
  query: string,
  limit = 30
): Promise<CommsSearchResult[]> {
  const q = query.trim()
  if (!q) return []

  let { data, error } = await supabase
    .from('comms_messages')
    .select(
      `
      *,
      sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
    `
    )
    .textSearch('content_tsv', q, { type: 'websearch', config: 'english' })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    const fallback = await supabase
      .from('comms_messages')
      .select(
        `
        *,
        sender_profile:user_profiles!fk_message_sender_profile(id, full_name, avatar_url, email)
      `
      )
      .ilike('content', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(limit)
    data = fallback.data
    error = fallback.error
  }

  if (error) {
    console.error('Error searching messages:', error)
    return []
  }

  const channels = await getAllChannels()
  const channelNames = new Map(channels.map((c) => [c.id, c.name]))
  const conversations = await getConversations()
  const convLabels = new Map(
    conversations.map((c) => [c.id, c.name || 'Direct message'])
  )

  return ((data || []) as Record<string, unknown>[]).map((row, i) => {
    const message = {
      ...row,
      sender_profile: row.sender_profile as unknown as UserProfileSummary | null,
    } as Message
    return {
      message,
      channel_name: message.channel_id ? channelNames.get(message.channel_id) ?? null : null,
      conversation_label: message.conversation_id
        ? convLabels.get(message.conversation_id) ?? null
        : null,
      rank: limit - i,
    }
  })
}

// ==================== ATTACHMENTS (M5) ====================

const COMMS_ATTACHMENTS_BUCKET = 'comms-attachments'

export function getCommsAttachmentUrl(storagePath: string): string {
  const { data } = supabase.storage.from(COMMS_ATTACHMENTS_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function uploadCommsAttachment(
  file: File
): Promise<{ path: string; fileName: string; mimeType: string; size: number } | { error: string }> {
  const userId = await getCurrentUserId()
  const ext = file.name.split('.').pop() || 'bin'
  const storagePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage
    .from(COMMS_ATTACHMENTS_BUCKET)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false })
  if (error) return { error: error.message }
  return {
    path: storagePath,
    fileName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  }
}

export async function saveMessageAttachments(
  messageId: string,
  files: Array<{ path: string; fileName: string; mimeType: string; size: number }>
): Promise<MessageAttachment[]> {
  if (files.length === 0) return []
  const userId = await getCurrentUserId()
  const { data, error } = await supabase
    .from('comms_message_attachments')
    .insert(
      files.map((f) => ({
        message_id: messageId,
        storage_path: f.path,
        file_name: f.fileName,
        mime_type: f.mimeType,
        size_bytes: f.size,
        user_id: userId,
      }))
    )
    .select()
  if (error) {
    console.error('Error saving attachments:', error)
    return []
  }
  return (data || []).map((row) => ({
    ...(row as MessageAttachment),
    public_url: getCommsAttachmentUrl((row as MessageAttachment).storage_path),
  }))
}

export async function getAttachmentsForMessages(
  messageIds: string[]
): Promise<Record<string, MessageAttachment[]>> {
  if (messageIds.length === 0) return {}
  const { data, error } = await supabase
    .from('comms_message_attachments')
    .select('*')
    .in('message_id', messageIds)
  if (error) {
    console.error('Error fetching attachments:', error)
    return {}
  }
  const grouped: Record<string, MessageAttachment[]> = {}
  for (const row of data || []) {
    const att = {
      ...(row as MessageAttachment),
      public_url: getCommsAttachmentUrl((row as MessageAttachment).storage_path),
    }
    if (!grouped[att.message_id]) grouped[att.message_id] = []
    grouped[att.message_id].push(att)
  }
  return grouped
}

export async function isChannelAdmin(channelId: string, userId?: string): Promise<boolean> {
  const uid = userId || (await getCurrentUserId())
  const { data: channel } = await supabase
    .from('comms_channels')
    .select('created_by')
    .eq('id', channelId)
    .maybeSingle()
  if (channel?.created_by === uid) return true
  const { data: member } = await supabase
    .from('comms_channel_members')
    .select('role')
    .eq('channel_id', channelId)
    .eq('member_user_id', uid)
    .maybeSingle()
  return member?.role === 'admin'
}

export function canPostToChannel(channel: Channel | null, isAdmin: boolean): boolean {
  if (!channel) return false
  if ((channel.posting_mode ?? 'open') === 'admins_only') return isAdmin
  return true
}
