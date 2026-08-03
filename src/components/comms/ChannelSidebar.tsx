import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Hash,
  Lock,
  MessageCircle,
  Plus,
  Search,
  Users,
  ChevronDown,
  ChevronRight,
  BellOff,
  MessageSquare,
  Radio,
  Megaphone,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { CreateChannelDialog } from './CreateChannelDialog'
import { NewConversationDialog } from './NewConversationDialog'
import { CommsOptionsMenu } from './CommsOptionsMenu'
import type { Channel, Conversation } from '@/lib/comms-api'
import type { CommsUserPreferences } from '@/lib/comms-preferences'

type ActiveView =
  | { type: 'channel'; id: string }
  | { type: 'conversation'; id: string }
  | null

interface ChannelSidebarProps {
  channels: Channel[]
  conversations: Conversation[]
  activeView: ActiveView
  onSelectChannel: (id: string) => void
  onSelectConversation: (id: string) => void
  onChannelCreated: (channel: Channel) => void
  onConversationCreated: (conversation: Conversation) => void
  loading: boolean
  organizationId: string
  currentUserId: string
  prefs: CommsUserPreferences
  channelMemberIds: Set<string>
  onPrefsUpdated: () => void
  onChannelHidden?: (channelId: string) => void
  onChannelLeft?: (channelId: string) => void
  onConversationHidden?: (conversationId: string) => void
  onConversationLeft?: (conversationId: string) => void
  unreadCounts?: { channels: Record<string, number>; conversations: Record<string, number> }
  onOpenMessageSearch?: () => void
}

const channelTypeLabels: Record<Channel['channel_type'], string> = {
  department: 'Departments',
  team: 'Teams',
  project: 'Projects',
  general: 'General',
  announcement: 'Announcements',
}

const channelTypeIcons: Record<Channel['channel_type'], typeof Hash> = {
  department: Users,
  team: Radio,
  project: Hash,
  general: MessageSquare,
  announcement: Megaphone,
}

const channelTypeAccent: Record<Channel['channel_type'], string> = {
  general: 'bg-primary/60',
  department: 'bg-katana-purple/60',
  team: 'bg-aqua/60',
  project: 'bg-katana-blue/60',
  announcement: 'bg-amber-500/60',
}

const typeOrder: Channel['channel_type'][] = [
  'announcement',
  'general',
  'department',
  'team',
  'project',
]

export function ChannelSidebar({
  channels,
  conversations,
  activeView,
  onSelectChannel,
  onSelectConversation,
  onChannelCreated,
  onConversationCreated,
  loading,
  organizationId,
  currentUserId,
  prefs,
  channelMemberIds,
  onPrefsUpdated,
  onChannelHidden,
  onChannelLeft,
  onConversationHidden,
  onConversationLeft,
  unreadCounts,
  onOpenMessageSearch,
}: ChannelSidebarProps) {
  const [search, setSearch] = useState('')
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  const [showHiddenSection, setShowHiddenSection] = useState(false)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showNewConversation, setShowNewConversation] = useState(false)

  const filteredChannels = useMemo(() => {
    if (!search) return channels
    const q = search.toLowerCase()
    return channels.filter(c => c.name.toLowerCase().includes(q))
  }, [channels, search])

  const filteredConversations = useMemo(() => {
    if (!search) return conversations
    const q = search.toLowerCase()
    return conversations.filter(c => {
      if (c.name?.toLowerCase().includes(q)) return true
      return c.members?.some(m =>
        m.profile?.full_name?.toLowerCase().includes(q) ||
        m.profile?.email?.toLowerCase().includes(q)
      )
    })
  }, [conversations, search])

  const { visibleChannels, hiddenChannels } = useMemo(() => {
    const visible: Channel[] = []
    const hidden: Channel[] = []
    for (const c of filteredChannels) {
      if (prefs.hiddenChannelIds.has(c.id)) hidden.push(c)
      else visible.push(c)
    }
    return { visibleChannels: visible, hiddenChannels: hidden }
  }, [filteredChannels, prefs.hiddenChannelIds])

  const { visibleConversations, hiddenConversations } = useMemo(() => {
    const visible: Conversation[] = []
    const hidden: Conversation[] = []
    for (const c of filteredConversations) {
      if (prefs.hiddenConversationIds.has(c.id)) hidden.push(c)
      else visible.push(c)
    }
    return { visibleConversations: visible, hiddenConversations: hidden }
  }, [filteredConversations, prefs.hiddenConversationIds])

  const groupedChannels = useMemo(() => {
    const groups: Record<string, Channel[]> = {}
    for (const type of typeOrder) {
      const items = visibleChannels.filter(c => c.channel_type === type)
      if (items.length > 0) groups[type] = items
    }
    return groups
  }, [visibleChannels])

  const getOtherUserId = (conv: Conversation) => {
    if (conv.conversation_type !== 'direct') return null
    return conv.members?.find(m => m.member_user_id !== currentUserId)?.member_user_id ?? null
  }

  const renderChannelRow = (channel: Channel) => {
    const isActive = activeView?.type === 'channel' && activeView.id === channel.id
    const isMuted = prefs.mutedChannelIds.has(channel.id)
    const unread = unreadCounts?.channels[channel.id] ?? 0
    return (
      <motion.div
        key={channel.id}
        layout
        className={`group flex items-center gap-0.5 w-full rounded-lg ${
          isActive ? 'comms-sidebar-active' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectChannel(channel.id)}
          className={`flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 text-sm transition-all duration-150 rounded-lg ${
            isActive
              ? ''
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
          }`}
        >
          {channel.is_private ? (
            <Lock className={`w-3.5 h-3.5 shrink-0 ${isActive ? '' : 'opacity-70'}`} />
          ) : (
            <Hash className={`w-3.5 h-3.5 shrink-0 ${isActive ? '' : 'opacity-70'}`} />
          )}
          <span
            className={`truncate ${isMuted ? 'opacity-70' : ''} ${unread > 0 && !isActive ? 'font-semibold text-foreground' : ''}`}
            title={channel.name}
          >
            {channel.name}
          </span>
          {channel.context_type && (
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground shrink-0">
              work
            </span>
          )}
          {isMuted && (
            <BellOff className="w-3 h-3 shrink-0 opacity-60" aria-label="Muted" />
          )}
          {unread > 0 && !isActive && (
            <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <CommsOptionsMenu
          target={{ kind: 'channel', channel }}
          prefs={prefs}
          currentUserId={currentUserId}
          isChannelMember={channelMemberIds.has(channel.id)}
          onPrefsUpdated={onPrefsUpdated}
          onChannelHidden={onChannelHidden}
          onChannelLeft={onChannelLeft}
        />
      </motion.div>
    )
  }

  const renderConversationRow = (conv: Conversation) => {
    const isActive = activeView?.type === 'conversation' && activeView.id === conv.id
    const displayName = getConversationDisplayName(conv)
    const unread = unreadCounts?.conversations[conv.id] ?? 0
    const isMuted =
      prefs.mutedConversationIds.has(conv.id) ||
      (getOtherUserId(conv) ? prefs.mutedUserIds.has(getOtherUserId(conv)!) : false)
    return (
      <motion.div
        key={conv.id}
        layout
        className={`group flex items-center gap-0.5 w-full rounded-lg ${
          isActive ? 'comms-sidebar-active' : ''
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectConversation(conv.id)}
          className={`flex items-center gap-2 flex-1 min-w-0 px-2.5 py-2 text-sm transition-all duration-150 rounded-lg ${
            isActive
              ? ''
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
          }`}
        >
          {conv.conversation_type === 'group' ? (
            <Users className={`w-3.5 h-3.5 shrink-0 ${isActive ? '' : 'opacity-70'}`} />
          ) : (
            <MessageCircle className={`w-3.5 h-3.5 shrink-0 ${isActive ? '' : 'opacity-70'}`} />
          )}
          <span
            className={`truncate ${isMuted ? 'opacity-70' : ''} ${unread > 0 && !isActive ? 'font-semibold text-foreground' : ''}`}
            title={getConversationFullName(conv)}
          >
            {displayName}
          </span>
          {isMuted && (
            <BellOff className="w-3 h-3 shrink-0 opacity-60" aria-label="Muted" />
          )}
          {unread > 0 && !isActive && (
            <span className="ml-auto shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
        <CommsOptionsMenu
          target={{
            kind: 'conversation',
            conversation: conv,
            otherUserId: getOtherUserId(conv),
          }}
          prefs={prefs}
          currentUserId={currentUserId}
          onPrefsUpdated={onPrefsUpdated}
          onConversationHidden={onConversationHidden}
          onConversationLeft={onConversationLeft}
        />
      </motion.div>
    )
  }

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev)
      if (next.has(section)) next.delete(section)
      else next.add(section)
      return next
    })
  }

  const getConversationDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name
    const otherMembers = conv.members?.filter(m => m.member_user_id !== currentUserId) ?? []
    if (otherMembers.length === 0) return 'You'
    if (otherMembers.length === 1) {
      return otherMembers[0].profile?.full_name || otherMembers[0].profile?.email || 'Unknown'
    }
    const firstName = otherMembers[0].profile?.full_name?.split(' ')[0] || otherMembers[0].profile?.email || 'Unknown'
    return `${firstName} +${otherMembers.length - 1}`
  }

  const getConversationFullName = (conv: Conversation) => {
    if (conv.name) return conv.name
    const otherMembers = conv.members?.filter(m => m.member_user_id !== currentUserId) ?? []
    if (otherMembers.length === 0) return 'You'
    return otherMembers.map(m => m.profile?.full_name || m.profile?.email || 'Unknown').join(', ')
  }

  if (loading) {
    return (
      <div className="w-72 comms-sidebar flex flex-col h-full">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="px-4 pt-4 pb-3 border-b border-border/60"
        >
          <Skeleton className="h-6 w-24 mb-3" />
          <Skeleton className="h-9 w-full rounded-xl" />
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="p-3 space-y-3"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full rounded-lg" />
          ))}
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="w-72 h-full comms-sidebar flex flex-col shrink-0"
    >
      {/* Header + Search */}
      <div className="px-4 pt-4 pb-3 border-b border-border/60 bg-gradient-to-b from-primary/5 to-transparent">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-2.5 mb-3"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, type: 'spring', stiffness: 260, damping: 20 }}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm"
          >
            <MessageSquare className="w-4 h-4" />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.22 }}
          >
            <h2 className="text-sm font-semibold text-foreground leading-tight">Comms</h2>
            <p className="text-[10px] text-muted-foreground">Channels & messages</p>
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.22 }}
          className="relative"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search channels & DMs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm rounded-xl bg-muted/50 border-border/60 focus-visible:ring-primary/30"
          />
        </motion.div>
        {onOpenMessageSearch && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full mt-2 h-8 text-xs"
            onClick={onOpenMessageSearch}
          >
            <Search className="w-3.5 h-3.5 mr-1.5" />
            Search messages
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1 min-h-0 basis-0">
        <div className="p-2">
          {/* Channels */}
          {Object.entries(groupedChannels).map(([type, items]) => {
            const isCollapsed = collapsedSections.has(type)
            const TypeIcon = channelTypeIcons[type as Channel['channel_type']]
            const accent = channelTypeAccent[type as Channel['channel_type']]
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.22 }}
                className="mb-3"
              >
                <button
                  onClick={() => toggleSection(type)}
                  className="comms-section-label w-full hover:text-foreground transition-colors rounded-md hover:bg-muted/40"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 shrink-0" />
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${accent}`} />
                  <TypeIcon className="w-3 h-3 shrink-0 opacity-60" />
                  {channelTypeLabels[type as Channel['channel_type']]}
                  <span className="ml-auto text-[10px] font-normal tabular-nums bg-muted/60 px-1.5 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {items.map(channel => renderChannelRow(channel))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })}

          {/* Create Channel */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 mb-4 rounded-xl border-dashed border-border/80 text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-primary/5 transition-all"
            onClick={() => setShowCreateChannel(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="text-sm">Create Channel</span>
          </Button>

          {/* Direct Messages */}
          <div className="mb-3">
            <motion.div
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.22, delay: 0.06 }}
              className="comms-section-label justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                <MessageCircle className="w-3 h-3 shrink-0 opacity-60" />
                Direct Messages
              </div>
              <button
                onClick={() => setShowNewConversation(true)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors"
                title="New conversation"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </motion.div>
            <AnimatePresence>
              {visibleConversations.map(conv => (
                <motion.div
                  key={conv.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                >
                  {renderConversationRow(conv)}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {(hiddenChannels.length > 0 || hiddenConversations.length > 0) && (
            <div className="mt-4 pt-2 border-t border-border">
              <button
                type="button"
                onClick={() => setShowHiddenSection(s => !s)}
                className="flex items-center gap-1 w-full px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground"
              >
                {showHiddenSection ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronRight className="w-3 h-3" />
                )}
                Hidden ({hiddenChannels.length + hiddenConversations.length})
              </button>
              {showHiddenSection && (
                <div className="mt-1 space-y-0.5">
                  {hiddenChannels.map(ch => renderChannelRow(ch))}
                  {hiddenConversations.map(conv => renderConversationRow(conv))}
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Dialogs */}
      <CreateChannelDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        organizationId={organizationId}
        onChannelCreated={onChannelCreated}
      />
      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        organizationId={organizationId}
        currentUserId={currentUserId}
        onConversationCreated={onConversationCreated}
      />
    </motion.div>
  )
}
