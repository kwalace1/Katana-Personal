import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { MotionPage } from '@/components/motion-page'
import { MessageSquare, PanelLeftOpen, Sparkles } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAuth } from '@/contexts/AuthContext'
import * as CommsApi from '@/lib/comms-api'
import type { Channel, Conversation, Message, ReactionSummary, UserProfileSummary, CommsUnreadCounts, CommsSearchResult } from '@/lib/comms-api'
import { ChannelSidebar } from '@/components/comms/ChannelSidebar'
import { ChannelHeader } from '@/components/comms/ChannelHeader'
import { MessageThread } from '@/components/comms/MessageThread'
import { MessageComposer } from '@/components/comms/MessageComposer'
import { ContextPanel } from '@/components/comms/ContextPanel'
import { ThreadPanel } from '@/components/comms/ThreadPanel'
import {
  emptyCommsPreferences,
  getCommsPreferences,
  getUserChannelMembershipIds,
  type CommsUserPreferences,
} from '@/lib/comms-preferences'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type ActiveView =
  | { type: 'channel'; id: string }
  | { type: 'conversation'; id: string }
  | null

export default function CommsPage() {
  const { user, profile, organization } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkHandledRef = useRef<string | null>(null)

  const [channels, setChannels] = useState<Channel[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [activeView, setActiveView] = useState<ActiveView>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [showContextPanel, setShowContextPanel] = useState(false)
  const [showSidebar, setShowSidebar] = useState(true)
  const [orgMembers, setOrgMembers] = useState<UserProfileSummary[]>([])
  const [unreadCounts, setUnreadCounts] = useState<CommsUnreadCounts>({
    channels: {},
    conversations: {},
    total: 0,
  })
  const [canPost, setCanPost] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMoreOlder, setHasMoreOlder] = useState(true)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<CommsSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [reactionsRaw, setReactionsRaw] = useState<Record<string, CommsApi.MessageReaction[]>>({})
  const [threadParent, setThreadParent] = useState<Message | null>(null)
  const [threadReplies, setThreadReplies] = useState<Message[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingMessage, setEditingMessage] = useState<Message | null>(null)
  const [editingThreadReply, setEditingThreadReply] = useState<Message | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<CommsUserPreferences>(emptyCommsPreferences)
  const [channelMemberIds, setChannelMemberIds] = useState<Set<string>>(new Set())

  const currentUserId = user?.id ?? ''

  const refreshPrefs = useCallback(async () => {
    const [p, memberships] = await Promise.all([
      getCommsPreferences(),
      getUserChannelMembershipIds(),
    ])
    setPrefs(p)
    setChannelMemberIds(memberships)
  }, [])

  const activeChannel = activeView?.type === 'channel'
    ? channels.find(c => c.id === activeView.id) ?? null
    : null

  const activeConversation = activeView?.type === 'conversation'
    ? conversations.find(c => c.id === activeView.id) ?? null
    : null

  const messageIds = useMemo(() => messages.map(m => m.id), [messages])

  const reactionsByMessage = useMemo(() => {
    const result: Record<string, ReactionSummary[]> = {}
    for (const id of messageIds) {
      const raw = reactionsRaw[id] ?? []
      result[id] = CommsApi.summarizeReactions(raw, currentUserId)
    }
    return result
  }, [messageIds, reactionsRaw, currentUserId])

  const loadReactions = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return
    const grouped = await CommsApi.getReactionsForMessages(ids)
    setReactionsRaw(prev => ({ ...prev, ...grouped }))
  }, [])

  const refreshUnread = useCallback(async (ch: Channel[], cv: Conversation[]) => {
    const counts = await CommsApi.getUnreadCounts(
      ch.map((c) => c.id),
      cv.map((c) => c.id)
    )
    setUnreadCounts(counts)
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      setLoading(true)
      await CommsApi.getOrCreateAnnouncementsChannel().catch(() => null)
      const [ch, cv, members] = await Promise.all([
        CommsApi.getAllChannels(),
        CommsApi.getConversations(),
        CommsApi.getOrganizationMembers(organization?.id),
      ])
      const [p, memberships] = await Promise.all([
        getCommsPreferences(),
        getUserChannelMembershipIds(),
      ])
      setChannels(ch)
      setConversations(cv)
      setOrgMembers(members)
      setPrefs(p)
      setChannelMemberIds(memberships)
      await refreshUnread(ch, cv)
      setLoading(false)
    }
    void load()
  }, [user, organization?.id, refreshUnread])

  useEffect(() => {
    if (!activeView) {
      setMessages([])
      setThreadParent(null)
      setReplyTo(null)
      setEditingMessage(null)
      setEditingThreadReply(null)
      setHasMoreOlder(true)
      return
    }
    const loadMessages = async () => {
      setMessagesLoading(true)
      setThreadParent(null)
      setReplyTo(null)
      setEditingMessage(null)
      setEditingThreadReply(null)
      setHasMoreOlder(true)
      const msgs =
        activeView.type === 'channel'
          ? await CommsApi.getChannelMessages(activeView.id)
          : await CommsApi.getConversationMessages(activeView.id)
      const attachments = await CommsApi.getAttachmentsForMessages(msgs.map((m) => m.id))
      const withAtt = msgs.map((m) => ({ ...m, attachments: attachments[m.id] ?? [] }))
      setMessages(withAtt)
      setMessagesLoading(false)
      void loadReactions(withAtt.map((m) => m.id))

      const latest = withAtt[withAtt.length - 1]?.created_at ?? new Date().toISOString()
      if (activeView.type === 'channel') {
        await CommsApi.markChannelRead(activeView.id, latest)
      } else {
        await CommsApi.markConversationRead(activeView.id, latest)
      }
      setUnreadCounts((prev) => {
        const next = {
          channels: { ...prev.channels },
          conversations: { ...prev.conversations },
          total: prev.total,
        }
        if (activeView.type === 'channel') {
          const cleared = next.channels[activeView.id] ?? 0
          delete next.channels[activeView.id]
          next.total = Math.max(0, next.total - cleared)
        } else {
          const cleared = next.conversations[activeView.id] ?? 0
          delete next.conversations[activeView.id]
          next.total = Math.max(0, next.total - cleared)
        }
        return next
      })
    }
    void loadMessages()
  }, [activeView, loadReactions])

  useEffect(() => {
    if (!activeChannel || !user?.id) {
      setCanPost(true)
      return
    }
    void CommsApi.isChannelAdmin(activeChannel.id, user.id).then((admin) => {
      setCanPost(CommsApi.canPostToChannel(activeChannel, admin))
    })
  }, [activeChannel, user?.id])

  useEffect(() => {
    if (messageIds.length === 0) return
    const unsub = CommsApi.subscribeToMessageReactions(messageIds, () => {
      void loadReactions(messageIds)
    })
    return unsub
  }, [messageIds, loadReactions])

  useEffect(() => {
    if (!threadParent) {
      setThreadReplies([])
      return
    }
    const loadThread = async () => {
      setThreadLoading(true)
      const replies = await CommsApi.getThreadReplies(threadParent.id)
      setThreadReplies(replies)
      setThreadLoading(false)
    }
    loadThread()
  }, [threadParent?.id])

  useEffect(() => {
    if (!activeView) return

    const applyMessageUpdate = (msg: Message) => {
      setMessages(prev =>
        prev.map(m => (m.id === msg.id ? { ...m, ...msg, sender_profile: msg.sender_profile ?? m.sender_profile } : m))
      )
      setThreadParent(prev =>
        prev?.id === msg.id ? { ...prev, ...msg, sender_profile: msg.sender_profile ?? prev.sender_profile } : prev
      )
      setThreadReplies(prev =>
        prev.map(m => (m.id === msg.id ? { ...m, ...msg, sender_profile: msg.sender_profile ?? m.sender_profile } : m))
      )
    }

    const applyMessageDelete = (messageId: string) => {
      const deletedReply = threadReplies.some(r => r.id === messageId)
      const parentId = deletedReply ? threadParent?.id : undefined

      setMessages(prev => {
        let next = prev.filter(m => m.id !== messageId)
        if (deletedReply && parentId) {
          next = next.map(m =>
            m.id === parentId
              ? { ...m, reply_count: Math.max(0, (m.reply_count ?? 1) - 1) }
              : m
          )
        }
        return next
      })
      setThreadReplies(prev => prev.filter(m => m.id !== messageId))
      if (threadParent?.id === messageId) setThreadParent(null)
      if (editingMessage?.id === messageId) setEditingMessage(null)
      if (editingThreadReply?.id === messageId) setEditingThreadReply(null)
    }

    const onNewMessage = (msg: Message) => {
      if (msg.parent_message_id) {
        setMessages(prev =>
          prev.map(m =>
            m.id === msg.parent_message_id
              ? { ...m, reply_count: (m.reply_count ?? 0) + 1 }
              : m
          )
        )
        if (threadParent?.id === msg.parent_message_id) {
          setThreadReplies(prev => {
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
        }
        return
      }

      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
      void loadReactions([msg.id])
    }

    const callbacks: CommsApi.MessageSubscriptionCallbacks = {
      onInsert: onNewMessage,
      onUpdate: applyMessageUpdate,
      onDelete: applyMessageDelete,
    }

    const unsub = activeView.type === 'channel'
      ? CommsApi.subscribeToChannelMessages(activeView.id, callbacks)
      : CommsApi.subscribeToConversationMessages(activeView.id, callbacks)

    return unsub
  }, [activeView, threadParent?.id, loadReactions])

  const handleSendMessage = useCallback(
    async (
      content: string,
      extras?: {
        attachments?: Array<{ path: string; fileName: string; mimeType: string; size: number }>
      }
    ) => {
      if (!activeView) return

      if (editingMessage) {
        const updated = await CommsApi.updateMessage(editingMessage.id, content)
        if (updated) {
          setMessages((prev) =>
            prev.map((m) => (m.id === editingMessage.id ? { ...m, ...updated } : m))
          )
          setThreadParent((prev) =>
            prev?.id === editingMessage.id ? { ...prev, ...updated } : prev
          )
          setEditingMessage(null)
        } else {
          toast.error('Could not update message')
        }
        return
      }

      const msg = await CommsApi.sendMessage({
        content,
        channel_id: activeView.type === 'channel' ? activeView.id : undefined,
        conversation_id: activeView.type === 'conversation' ? activeView.id : undefined,
        parent_message_id: replyTo?.id,
        attachments: extras?.attachments,
      })

      if (msg) {
        if (replyTo) {
          setReplyTo(null)
          if (msg.parent_message_id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === msg.parent_message_id
                  ? { ...m, reply_count: (m.reply_count ?? 0) + 1 }
                  : m
              )
            )
          }
        } else if (!msg.parent_message_id) {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          void loadReactions([msg.id])
        }
        if (activeView.type === 'channel') {
          void CommsApi.markChannelRead(activeView.id)
        } else {
          void CommsApi.markConversationRead(activeView.id)
        }
      } else {
        toast.error('Could not send message')
      }
    },
    [activeView, editingMessage, replyTo, loadReactions]
  )

  const handleLoadOlder = useCallback(async () => {
    if (!activeView || loadingOlder || messages.length === 0) return
    setLoadingOlder(true)
    const before = messages[0]?.created_at
    const older =
      activeView.type === 'channel'
        ? await CommsApi.getChannelMessages(activeView.id, 50, before)
        : await CommsApi.getConversationMessages(activeView.id, 50, before)
    if (older.length === 0) {
      setHasMoreOlder(false)
    } else {
      const attachments = await CommsApi.getAttachmentsForMessages(older.map((m) => m.id))
      const withAtt = older.map((m) => ({ ...m, attachments: attachments[m.id] ?? [] }))
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id))
        return [...withAtt.filter((m) => !ids.has(m.id)), ...prev]
      })
      void loadReactions(withAtt.map((m) => m.id))
      if (older.length < 50) setHasMoreOlder(false)
    }
    setLoadingOlder(false)
  }, [activeView, loadingOlder, messages, loadReactions])

  const handleSearchMessages = useCallback(async (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    const results = await CommsApi.searchMessages(q.trim())
    setSearchResults(results)
    setSearchLoading(false)
  }, [])

  const handleSendThreadReply = useCallback(
    async (content: string) => {
      if (!activeView || !threadParent) return

      if (editingThreadReply) {
        const updated = await CommsApi.updateMessage(editingThreadReply.id, content)
        if (updated) {
          setThreadReplies(prev =>
            prev.map(m => (m.id === editingThreadReply.id ? { ...m, ...updated } : m))
          )
          setEditingThreadReply(null)
        } else {
          toast.error('Could not update message')
        }
        return
      }

      const msg = await CommsApi.sendMessage({
        content,
        channel_id: activeView.type === 'channel' ? activeView.id : undefined,
        conversation_id: activeView.type === 'conversation' ? activeView.id : undefined,
        parent_message_id: threadParent.id,
      })
      if (msg) {
        setThreadReplies(prev => {
          if (prev.some(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setMessages(prev =>
          prev.map(m =>
            m.id === threadParent.id ? { ...m, reply_count: (m.reply_count ?? 0) + 1 } : m
          )
        )
      }
    },
    [activeView, threadParent, editingThreadReply]
  )

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const result = await CommsApi.toggleReaction(messageId, emoji)
      if (result) {
        await loadReactions([messageId])
      }
    },
    [loadReactions]
  )

  const handleOpenThread = useCallback((message: Message) => {
    setThreadParent(message)
    setReplyTo(null)
    setEditingMessage(null)
    setEditingThreadReply(null)
  }, [])

  const handleEditMessage = useCallback(
    (message: Message) => {
      setReplyTo(null)
      if (threadReplies.some(r => r.id === message.id)) {
        setEditingMessage(null)
        setEditingThreadReply(message)
      } else {
        setEditingThreadReply(null)
        setEditingMessage(message)
      }
    },
    [threadReplies]
  )

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return
    const messageId = deleteTargetId
    const ok = await CommsApi.deleteMessage(messageId)
    if (ok) {
      const deletedReply = threadReplies.some(r => r.id === messageId)
      const parentId = deletedReply ? threadParent?.id : undefined

      setMessages(prev => {
        let next = prev.filter(m => m.id !== messageId)
        if (deletedReply && parentId) {
          next = next.map(m =>
            m.id === parentId
              ? { ...m, reply_count: Math.max(0, (m.reply_count ?? 1) - 1) }
              : m
          )
        }
        return next
      })
      setThreadReplies(prev => prev.filter(m => m.id !== messageId))
      if (threadParent?.id === messageId) setThreadParent(null)
      if (editingMessage?.id === messageId) setEditingMessage(null)
      if (editingThreadReply?.id === messageId) setEditingThreadReply(null)
      toast.success('Message deleted')
    } else {
      toast.error('Could not delete message')
    }
    setDeleteTargetId(null)
  }, [deleteTargetId, threadReplies, threadParent?.id, editingMessage?.id, editingThreadReply?.id])

  const handleSelectChannel = useCallback((channelId: string) => {
    setActiveView({ type: 'channel', id: channelId })
    setShowContextPanel(false)
    setThreadParent(null)
  }, [])

  const handleSelectConversation = useCallback((conversationId: string) => {
    setActiveView({ type: 'conversation', id: conversationId })
    setShowContextPanel(false)
    setThreadParent(null)
  }, [])

  const handleChannelCreated = useCallback((channel: Channel) => {
    setChannels(prev => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)))
    setActiveView({ type: 'channel', id: channel.id })
  }, [])

  const handleConversationCreated = useCallback(async (conversation: Conversation) => {
    setActiveView({ type: 'conversation', id: conversation.id })
    const cv = await CommsApi.getConversations()
    setConversations(cv.some(c => c.id === conversation.id) ? cv : [conversation, ...cv])
  }, [])

  const handleChannelUpdated = useCallback((updated: Channel) => {
    setChannels(prev => prev.map(c => (c.id === updated.id ? updated : c)))
  }, [])

  const handleChannelDeleted = useCallback((channelId: string) => {
    setChannels(prev => prev.filter(c => c.id !== channelId))
    setActiveView(null)
    setShowContextPanel(false)
    setThreadParent(null)
  }, [])

  const handleChannelHidden = useCallback((channelId: string) => {
    if (activeView?.type === 'channel' && activeView.id === channelId) {
      setActiveView(null)
      setThreadParent(null)
    }
    toast.success('Channel hidden')
  }, [activeView])

  const handleChannelLeft = useCallback((channelId: string) => {
    void refreshPrefs()
    if (activeView?.type === 'channel' && activeView.id === channelId) {
      setActiveView(null)
      setThreadParent(null)
    }
    toast.success('Left channel')
  }, [activeView, refreshPrefs])

  const handleConversationHidden = useCallback(
    (conversationId: string) => {
      if (activeView?.type === 'conversation' && activeView.id === conversationId) {
        setActiveView(null)
        setThreadParent(null)
      }
      toast.success('Conversation removed from sidebar')
    },
    [activeView]
  )

  const handleConversationLeft = useCallback(
    async (conversationId: string) => {
      setConversations(prev => prev.filter(c => c.id !== conversationId))
      if (activeView?.type === 'conversation' && activeView.id === conversationId) {
        setActiveView(null)
        setThreadParent(null)
      }
      await refreshPrefs()
      toast.success('Conversation deleted')
    },
    [activeView, refreshPrefs]
  )

  useEffect(() => {
    if (!user?.id || loading) return

    const conversationId = searchParams.get('conversation')
    const channelId = searchParams.get('channel')
    const targetUserId = searchParams.get('user')
    const deepKey = conversationId ?? channelId ?? targetUserId
    if (!deepKey) return
    if (deepLinkHandledRef.current === deepKey) return

    if (conversationId) {
      const exists = conversations.some(c => c.id === conversationId)
      if (exists) {
        deepLinkHandledRef.current = deepKey
        setActiveView({ type: 'conversation', id: conversationId })
        setSearchParams({}, { replace: true })
      }
      return
    }

    if (channelId) {
      const exists = channels.some(c => c.id === channelId)
      if (exists) {
        deepLinkHandledRef.current = deepKey
        setActiveView({ type: 'channel', id: channelId })
        setSearchParams({}, { replace: true })
      }
      return
    }

    if (!targetUserId || !organization?.id) return
    if (targetUserId === user.id) {
      toast.error('You cannot message yourself')
      setSearchParams({}, { replace: true })
      return
    }

    deepLinkHandledRef.current = deepKey
    let cancelled = false

    const openDirect = async () => {
      const conversation = await CommsApi.getOrCreateDirectConversation(
        targetUserId,
        organization.id
      )
      if (cancelled) return
      if (!conversation) {
        toast.error('Could not start conversation')
        deepLinkHandledRef.current = null
        return
      }
      await handleConversationCreated(conversation)
      setSearchParams({}, { replace: true })
    }

    void openDirect()
    return () => {
      cancelled = true
    }
  }, [
    searchParams,
    user?.id,
    organization?.id,
    loading,
    conversations,
    channels,
    handleConversationCreated,
    setSearchParams,
  ])

  const composerPlaceholder = editingMessage
    ? 'Edit your message...'
    : replyTo
      ? 'Reply in channel...'
      : 'Type a message...'

  return (
    <MotionPage subtle className="comms-shell flex h-[calc(100dvh-3.5rem)] max-h-[calc(100dvh-3.5rem)] overflow-hidden">
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden shrink-0 h-full min-h-0"
          >
            <ChannelSidebar
              channels={channels}
              conversations={conversations}
              activeView={activeView}
              onSelectChannel={handleSelectChannel}
              onSelectConversation={handleSelectConversation}
              onChannelCreated={handleChannelCreated}
              onConversationCreated={handleConversationCreated}
              loading={loading}
              organizationId={organization?.id ?? ''}
              currentUserId={currentUserId}
              prefs={prefs}
              channelMemberIds={channelMemberIds}
              onPrefsUpdated={() => void refreshPrefs()}
              onChannelHidden={handleChannelHidden}
              onChannelLeft={handleChannelLeft}
              onConversationHidden={handleConversationHidden}
              onConversationLeft={handleConversationLeft}
              unreadCounts={unreadCounts}
              onOpenMessageSearch={() => setSearchOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="flex-1 flex flex-col min-w-0 min-h-0 h-full overflow-hidden comms-main"
      >
        <AnimatePresence mode="wait">
          {activeView ? (
            <motion.div
              key={activeView.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden"
            >
              <ChannelHeader
                channel={activeChannel}
                conversation={activeConversation}
                currentUserId={currentUserId}
                onToggleContextPanel={() => setShowContextPanel(p => !p)}
                showContextPanel={showContextPanel}
                onToggleSidebar={() => setShowSidebar(p => !p)}
                showSidebar={showSidebar}
                prefs={prefs}
                channelMemberIds={channelMemberIds}
                onPrefsUpdated={() => void refreshPrefs()}
                onChannelHidden={handleChannelHidden}
                onChannelLeft={handleChannelLeft}
                onConversationHidden={handleConversationHidden}
                onConversationLeft={handleConversationLeft}
              />
              <div className="flex flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
                  {hasMoreOlder && messages.length > 0 && (
                    <div className="flex justify-center py-2 border-b border-border/40">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-xs h-7"
                        disabled={loadingOlder}
                        onClick={() => void handleLoadOlder()}
                      >
                        {loadingOlder ? 'Loading…' : 'Load older messages'}
                      </Button>
                    </div>
                  )}
                  <MessageThread
                    messages={messages}
                    loading={messagesLoading}
                    currentUserId={currentUserId}
                    reactionsByMessage={reactionsByMessage}
                    onToggleReaction={handleToggleReaction}
                    onOpenThread={handleOpenThread}
                    onReplyInChannel={setReplyTo}
                    onEditMessage={handleEditMessage}
                    onRequestDeleteMessage={setDeleteTargetId}
                    activeThreadId={threadParent?.id}
                  />
                  {editingMessage && (
                    <div className="px-4 py-1.5 bg-muted/50 border-t border-border flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        Editing message — send to save,{' '}
                        <button
                          type="button"
                          className="text-primary underline"
                          onClick={() => setEditingMessage(null)}
                        >
                          cancel
                        </button>
                      </span>
                    </div>
                  )}
                  <MessageComposer
                    key={editingMessage?.id ?? 'compose'}
                    onSend={handleSendMessage}
                    placeholder={composerPlaceholder}
                    replyTo={replyTo}
                    onCancelReply={() => setReplyTo(null)}
                    initialContent={editingMessage?.content ?? ''}
                    orgMembers={orgMembers}
                    disabled={!canPost && !editingMessage}
                    disabledReason={
                      !canPost && !editingMessage
                        ? 'Only channel admins can post in this channel'
                        : undefined
                    }
                  />
                </div>

                <AnimatePresence>
                  {threadParent && (
                    <ThreadPanel
                      parentMessage={threadParent}
                      replies={threadReplies}
                      loading={threadLoading}
                      currentUserId={currentUserId}
                      editingReply={editingThreadReply}
                      onClose={() => {
                        setThreadParent(null)
                        setEditingThreadReply(null)
                      }}
                      onSendReply={handleSendThreadReply}
                      onEditMessage={handleEditMessage}
                      onRequestDeleteMessage={setDeleteTargetId}
                      onCancelEdit={() => setEditingThreadReply(null)}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex flex-col min-h-0 h-full overflow-hidden"
            >
              {!showSidebar && (
                <div className="px-4 py-3 border-b border-border bg-card shrink-0">
                  <button
                    onClick={() => setShowSidebar(true)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Show sidebar"
                  >
                    <PanelLeftOpen className="w-4 h-4" />
                  </button>
                </div>
              )}
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-sm">
                  <div className="comms-empty-icon">
                    <MessageSquare className="w-9 h-9 text-primary/70" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Katana Comms</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select a channel or conversation to start messaging your team
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15, duration: 0.25 }}
                    className="inline-flex items-center gap-2 text-xs text-muted-foreground bg-muted/60 rounded-full px-3 py-1.5 ring-1 ring-border/50"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-primary/70" />
                    Real-time channels, DMs & threads
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence>
        {showContextPanel && activeView && (
          <ContextPanel
            channel={activeChannel}
            conversation={activeConversation}
            currentUserId={currentUserId}
            onClose={() => setShowContextPanel(false)}
            onChannelUpdated={handleChannelUpdated}
            onChannelDeleted={handleChannelDeleted}
            prefs={prefs}
            onPrefsUpdated={() => void refreshPrefs()}
            onChannelHidden={handleChannelHidden}
            onChannelLeft={handleChannelLeft}
            onConversationHidden={handleConversationHidden}
            onConversationLeft={handleConversationLeft}
          />
        )}
      </AnimatePresence>

      <AlertDialog open={deleteTargetId !== null} onOpenChange={open => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Replies in a thread will also be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleConfirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Search messages</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            placeholder="Search conversation history…"
            value={searchQuery}
            onChange={(e) => void handleSearchMessages(e.target.value)}
          />
          <div className="max-h-72 overflow-y-auto space-y-1 mt-2">
            {searchLoading && (
              <p className="text-xs text-muted-foreground px-1 py-2">Searching…</p>
            )}
            {!searchLoading && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground px-1 py-2">No matches</p>
            )}
            {searchResults.map((r) => (
              <button
                key={r.message.id}
                type="button"
                className="w-full text-left rounded-md border px-3 py-2 hover:bg-muted/60"
                onClick={() => {
                  if (r.message.channel_id) {
                    handleSelectChannel(r.message.channel_id)
                  } else if (r.message.conversation_id) {
                    handleSelectConversation(r.message.conversation_id)
                  }
                  setSearchOpen(false)
                }}
              >
                <p className="text-[11px] text-muted-foreground mb-0.5">
                  {r.channel_name
                    ? `#${r.channel_name}`
                    : r.conversation_label || 'Direct message'}
                </p>
                <p className="text-xs line-clamp-2">{r.message.content}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}
