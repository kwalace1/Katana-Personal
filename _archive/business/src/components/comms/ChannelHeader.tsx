import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Hash, Lock, Users, Info, MessageCircle, PanelLeftClose, PanelLeftOpen, BellOff, ExternalLink, Megaphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Link } from 'react-router-dom'
import { CommsOptionsMenu } from '@/components/comms/CommsOptionsMenu'
import * as CommsApi from '@/lib/comms-api'
import type { Channel, Conversation } from '@/lib/comms-api'
import type { CommsUserPreferences } from '@/lib/comms-preferences'

interface ChannelHeaderProps {
  channel: Channel | null
  conversation: Conversation | null
  currentUserId: string
  onToggleContextPanel: () => void
  showContextPanel: boolean
  onToggleSidebar: () => void
  showSidebar: boolean
  prefs: CommsUserPreferences
  channelMemberIds: Set<string>
  onPrefsUpdated: () => void
  onChannelHidden?: (channelId: string) => void
  onChannelLeft?: (channelId: string) => void
  onConversationHidden?: (conversationId: string) => void
  onConversationLeft?: (conversationId: string) => void
}

export function ChannelHeader({
  channel,
  conversation,
  currentUserId,
  onToggleContextPanel,
  showContextPanel,
  onToggleSidebar,
  showSidebar,
  prefs,
  channelMemberIds,
  onPrefsUpdated,
  onChannelHidden,
  onChannelLeft,
  onConversationHidden,
  onConversationLeft,
}: ChannelHeaderProps) {
  const [memberCount, setMemberCount] = useState(0)

  useEffect(() => {
    if (channel) {
      CommsApi.getChannelMembers(channel.id).then(members => setMemberCount(members.length))
    } else if (conversation) {
      setMemberCount(conversation.members?.length ?? 0)
    }
  }, [channel, conversation])

  const getConversationName = () => {
    if (!conversation) return ''
    if (conversation.name) return conversation.name
    const others = conversation.members?.filter(m => m.member_user_id !== currentUserId) ?? []
    if (others.length <= 1) {
      return others.map(m => m.profile?.full_name || m.profile?.email || 'Unknown').join(', ')
    }
    return others.map(m => (m.profile?.full_name?.split(' ')[0]) || m.profile?.email || 'Unknown').join(', ')
  }

  const title = channel ? channel.name : getConversationName()
  const fullTitle = channel ? channel.name : (() => {
    if (!conversation) return ''
    if (conversation.name) return conversation.name
    const others = conversation.members?.filter(m => m.member_user_id !== currentUserId) ?? []
    return others.map(m => m.profile?.full_name || m.profile?.email || 'Unknown').join(', ')
  })()
  const description = channel?.description ?? null
  const isPrivate = channel?.is_private ?? false
  const contextPath =
    channel?.context_type && channel?.context_id
      ? CommsApi.contextRecordPath(channel.context_type, channel.context_id)
      : channel?.description
        ? (() => {
            const parsed = CommsApi.parseContextChannelMarker(channel.description)
            return parsed
              ? CommsApi.contextRecordPath(parsed.contextType, parsed.contextId)
              : null
          })()
        : null
  const contextLabel = channel?.context_type
    ? `Linked ${channel.context_type}`
    : null

  const otherUserId =
    conversation?.conversation_type === 'direct'
      ? conversation.members?.find(m => m.member_user_id !== currentUserId)?.member_user_id ?? null
      : null

  const isMuted = channel
    ? prefs.mutedChannelIds.has(channel.id)
    : conversation
      ? prefs.mutedConversationIds.has(conversation.id) ||
        (otherUserId ? prefs.mutedUserIds.has(otherUserId) : false)
      : false

  return (
    <motion.div
      layout
      className="comms-header flex items-center justify-between px-4 py-3 shrink-0"
    >
      <div className="flex items-center gap-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleSidebar}
          title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
        >
          {showSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </Button>
        <div className="flex items-center gap-2.5 min-w-0">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20 shrink-0"
          >
            {channel ? (
              channel.channel_type === 'announcement' ? (
                <Megaphone className="w-4 h-4 text-primary" />
              ) : isPrivate ? (
                <Lock className="w-4 h-4 text-primary" />
              ) : (
                <Hash className="w-4 h-4 text-primary" />
              )
            ) : (
              <MessageCircle className="w-4 h-4 text-primary" />
            )}
          </motion.div>
          <motion.h2
            key={title}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-semibold text-foreground truncate"
            title={fullTitle}
          >
            {title}
          </motion.h2>
        </div>

        {contextPath && contextLabel && (
          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 hidden md:inline-flex" asChild>
            <Link to={contextPath}>
              <ExternalLink className="w-3 h-3 mr-1" />
              {contextLabel}
            </Link>
          </Button>
        )}

        {description && !contextPath && (
          <span className="text-sm text-muted-foreground truncate hidden md:block">
            {description}
          </span>
        )}

        {channel?.channel_type && (
          <Badge variant="secondary" className="text-xs shrink-0 hidden sm:flex capitalize bg-primary/10 text-primary border-primary/20">
            {channel.channel_type}
          </Badge>
        )}
        {channel?.posting_mode === 'admins_only' && (
          <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex">
            Admins post
          </Badge>
        )}
        {isMuted && (
          <Badge variant="outline" className="text-xs shrink-0 hidden sm:flex gap-1">
            <BellOff className="w-3 h-3" />
            Muted
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(channel || conversation) && (
          <CommsOptionsMenu
            target={
              channel
                ? { kind: 'channel', channel }
                : { kind: 'conversation', conversation: conversation!, otherUserId }
            }
            prefs={prefs}
            currentUserId={currentUserId}
            isChannelMember={channel ? channelMemberIds.has(channel.id) : true}
            onPrefsUpdated={onPrefsUpdated}
            onChannelHidden={onChannelHidden}
            onChannelLeft={onChannelLeft}
            onConversationHidden={onConversationHidden}
            onConversationLeft={onConversationLeft}
            iconClassName="opacity-100"
          />
        )}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.08, duration: 0.2 }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted/50 rounded-full px-2.5 py-1 ring-1 ring-border/50"
        >
          <Users className="w-3.5 h-3.5" />
          <span className="tabular-nums">{memberCount}</span>
        </motion.div>
        <Button
          variant={showContextPanel ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={onToggleContextPanel}
        >
          <Info className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  )
}
