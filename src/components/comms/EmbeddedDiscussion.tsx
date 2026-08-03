import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Reply,
  SmilePlus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { MessageActionsMenu } from '@/components/comms/MessageActionsMenu'
import { MessageContent } from '@/components/comms/MessageContent'
import { MessageReactions } from '@/components/comms/MessageReactions'
import { useAuth } from '@/contexts/AuthContext'
import * as CommsApi from '@/lib/comms-api'
import type { Message, CommsContextType, ReactionSummary } from '@/lib/comms-api'
import { QUICK_REACTIONS } from '@/lib/comms-emojis'
import { getMessagePreview } from '@/lib/comms-message-content'

interface EmbeddedDiscussionProps {
  contextType: CommsContextType
  contextId: string
  title?: string
  channelId?: string
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const now = Date.now()
  const diffMs = now - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM}m ago`
  if (diffH < 24) return `${diffH}h ago`
  if (diffD < 7) return `${diffD}d ago`
  return d.toLocaleDateString()
}

export function EmbeddedDiscussion({
  contextType,
  contextId,
  title = 'Discussion',
  channelId,
}: EmbeddedDiscussionProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [isOpen, setIsOpen] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)
  const [reactionsByMessage, setReactionsByMessage] = useState<
    Record<string, ReactionSummary[]>
  >({})
  const bottomRef = useRef<HTMLDivElement>(null)
  const messageIdsKey = useMemo(() => messages.map((m) => m.id).join(','), [messages])

  const refreshReactions = useCallback(
    async (msgs: Message[]) => {
      if (!user?.id || msgs.length === 0) {
        setReactionsByMessage({})
        return
      }
      const grouped = await CommsApi.getReactionsForMessages(msgs.map((m) => m.id))
      const next: Record<string, ReactionSummary[]> = {}
      for (const msg of msgs) {
        next[msg.id] = CommsApi.summarizeReactions(grouped[msg.id] ?? [], user.id)
      }
      setReactionsByMessage(next)
    },
    [user?.id]
  )

  const loadMessages = useCallback(async () => {
    if (!contextId) return
    setLoading(true)
    const linked = await CommsApi.getMessagesForContext(contextType, contextId)
    let merged = linked
    if (channelId) {
      const channelMsgs = await CommsApi.getChannelMessages(channelId)
      const byId = new Map<string, Message>()
      for (const m of [...linked, ...channelMsgs]) {
        byId.set(m.id, m)
      }
      merged = Array.from(byId.values()).sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    }
    setMessages(merged)
    await refreshReactions(merged)
    setLoading(false)
  }, [contextType, contextId, channelId, refreshReactions])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length])

  // Realtime: keep discussion in sync for this context channel
  useEffect(() => {
    if (!channelId) return
    return CommsApi.subscribeToChannelMessages(channelId, {
      onInsert: (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          // Context-bound channels are 1:1 with the record; also accept legacy linked msgs.
          return [...prev, msg]
        })
      },
      onUpdate: (msg) => {
        setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)))
      },
      onDelete: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId))
        if (replyTo?.id === messageId) setReplyTo(null)
        if (editing?.id === messageId) setEditing(null)
      },
    })
  }, [channelId, replyTo?.id, editing?.id])

  useEffect(() => {
    const ids = messages.map((m) => m.id)
    if (ids.length === 0) return
    return CommsApi.subscribeToMessageReactions(ids, () => {
      void refreshReactions(messages)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by message id set
  }, [messageIdsKey, refreshReactions])

  const handleToggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      await CommsApi.toggleReaction(messageId, emoji)
      await refreshReactions(messages)
    },
    [messages, refreshReactions]
  )

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim()
    if (!trimmed || sending || !channelId || !user) return

    setSending(true)
    try {
      if (editing) {
        const updated = await CommsApi.updateMessage(editing.id, trimmed)
        if (updated) {
          setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          setEditing(null)
          setNewMessage('')
          setReplyTo(null)
        }
        return
      }

      const msg = await CommsApi.sendMessage({
        content: trimmed,
        channel_id: channelId,
        parent_message_id: replyTo?.id,
      })
      if (msg) {
        await CommsApi.addContextLink(msg.id, contextType, contextId)
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
        setNewMessage('')
        setReplyTo(null)
      }
    } finally {
      setSending(false)
    }
  }, [
    newMessage,
    sending,
    channelId,
    user,
    editing,
    replyTo,
    contextType,
    contextId,
  ])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(null)
          setNewMessage('')
        } else if (replyTo) {
          setReplyTo(null)
        }
      }
    },
    [handleSend, editing, replyTo]
  )

  const handleStartEdit = useCallback((message: Message) => {
    setEditing(message)
    setReplyTo(null)
    setNewMessage(message.content)
  }, [])

  const handleStartReply = useCallback((message: Message) => {
    setReplyTo(message)
    setEditing(null)
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTargetId) return
    const ok = await CommsApi.deleteMessage(deleteTargetId)
    if (ok) {
      setMessages((prev) => prev.filter((m) => m.id !== deleteTargetId))
      toast.success('Message deleted')
    } else {
      toast.error('Could not delete message')
    }
    setDeleteTargetId(null)
  }, [deleteTargetId])

  const parentPreviewById = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of messages) {
      map.set(m.id, getMessagePreview(m.content))
    }
    return map
  }, [messages])

  const openInCommsHref = channelId ? `/comms?channel=${encodeURIComponent(channelId)}` : null

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex-1 justify-between px-3 py-2 h-auto">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{title}</span>
                {messages.length > 0 && (
                  <span className="text-xs text-muted-foreground">({messages.length})</span>
                )}
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </Button>
          </CollapsibleTrigger>
          {openInCommsHref && (
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs shrink-0" asChild>
              <Link to={openInCommsHref} title="Open in Comms">
                <ExternalLink className="w-3.5 h-3.5 mr-1" />
                Comms
              </Link>
            </Button>
          )}
        </div>

        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="border rounded-lg mx-1 mb-2"
          >
            <div className="max-h-80 overflow-y-auto p-3 space-y-3">
              {loading ? (
                <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
              ) : messages.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No discussion yet
                </p>
              ) : (
                <AnimatePresence>
                  {messages.map((msg) => {
                    const senderName =
                      msg.sender_profile?.full_name ||
                      msg.sender_profile?.email ||
                      'Unknown'
                    const isOwn = user?.id === msg.sender_id
                    const summaries = reactionsByMessage[msg.id] ?? []
                    const parentPreview = msg.parent_message_id
                      ? parentPreviewById.get(msg.parent_message_id)
                      : null
                    const edited = CommsApi.isMessageEdited(msg)

                    return (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`group relative flex gap-2 ${
                          msg.parent_message_id ? 'ml-4 pl-2 border-l border-border/60' : ''
                        }`}
                      >
                        <div className="absolute -top-2 right-0 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 backdrop-blur-sm border border-border/70 rounded-md shadow-sm p-0.5">
                          <Popover
                            open={reactionPickerFor === msg.id}
                            onOpenChange={(open) =>
                              setReactionPickerFor(open ? msg.id : null)
                            }
                          >
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Add reaction"
                              >
                                <SmilePlus className="w-3 h-3" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-1" align="end">
                              <div className="flex gap-0.5">
                                {QUICK_REACTIONS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className="text-base p-1 rounded hover:bg-muted"
                                    onClick={() => {
                                      void handleToggleReaction(msg.id, emoji)
                                      setReactionPickerFor(null)
                                    }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            title="Reply"
                            onClick={() => handleStartReply(msg)}
                          >
                            <Reply className="w-3 h-3" />
                          </Button>
                          <MessageActionsMenu
                            message={msg}
                            onEdit={isOwn ? handleStartEdit : undefined}
                            onDelete={isOwn ? setDeleteTargetId : undefined}
                          />
                        </div>

                        <Avatar className="w-6 h-6 shrink-0 mt-0.5">
                          <AvatarImage
                            src={msg.sender_profile?.avatar_url ?? undefined}
                          />
                          <AvatarFallback className="text-[10px]">
                            {getInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-xs font-semibold">{senderName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeTime(msg.created_at)}
                              {edited && <span className="ml-1">(edited)</span>}
                            </span>
                          </div>
                          {parentPreview && (
                            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">
                              Replying to: {parentPreview}
                            </p>
                          )}
                          <MessageContent
                            content={msg.content}
                            className="text-xs"
                          />
                          {summaries.length > 0 && (
                            <MessageReactions
                              summaries={summaries}
                              onToggle={(emoji) => void handleToggleReaction(msg.id, emoji)}
                            />
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              )}
              <div ref={bottomRef} />
            </div>

            {channelId && user && (
              <div className="border-t p-2 space-y-2">
                {(replyTo || editing) && (
                  <div className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-2 py-1.5">
                    <p className="text-[11px] text-muted-foreground truncate">
                      {editing
                        ? 'Editing message'
                        : `Replying to ${
                            replyTo?.sender_profile?.full_name ||
                            replyTo?.sender_profile?.email ||
                            'message'
                          }`}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => {
                        setReplyTo(null)
                        setEditing(null)
                        setNewMessage('')
                      }}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      editing
                        ? 'Edit your message...'
                        : replyTo
                          ? 'Write a reply...'
                          : 'Add to discussion...'
                    }
                    className="min-h-[32px] text-xs resize-none"
                    rows={1}
                  />
                  <Button
                    size="sm"
                    className="shrink-0 h-8"
                    onClick={() => void handleSend()}
                    disabled={!newMessage.trim() || sending}
                  >
                    {editing ? 'Save' : 'Send'}
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => {
          if (!open) setDeleteTargetId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete message?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the message from the discussion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
