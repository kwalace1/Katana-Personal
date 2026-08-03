import { useRef, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MessageSquare, Reply, SmilePlus } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { MessageActionsMenu } from '@/components/comms/MessageActionsMenu'
import { MessageContent } from '@/components/comms/MessageContent'
import { MessageReactions } from '@/components/comms/MessageReactions'
import type { Message, ReactionSummary } from '@/lib/comms-api'
import { isMessageEdited } from '@/lib/comms-api'
import { QUICK_REACTIONS } from '@/lib/comms-emojis'

interface MessageThreadProps {
  messages: Message[]
  loading: boolean
  currentUserId: string
  reactionsByMessage: Record<string, ReactionSummary[]>
  onToggleReaction: (messageId: string, emoji: string) => void
  onOpenThread: (message: Message) => void
  onReplyInChannel: (message: Message) => void
  onEditMessage?: (message: Message) => void
  onRequestDeleteMessage?: (messageId: string) => void
  activeThreadId?: string | null
}

function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const isYesterday = d.toDateString() === yesterday.toDateString()
  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].created_at).toDateString()
  const curr = new Date(messages[index].created_at).toDateString()
  return prev !== curr
}

function shouldGroupWithPrevious(messages: Message[], index: number): boolean {
  if (index === 0) return false
  const prev = messages[index - 1]
  const curr = messages[index]
  if (prev.sender_id !== curr.sender_id) return false
  const diff = new Date(curr.created_at).getTime() - new Date(prev.created_at).getTime()
  return diff < 5 * 60 * 1000
}

export function MessageThread({
  messages,
  loading,
  currentUserId,
  reactionsByMessage,
  onToggleReaction,
  onOpenThread,
  onReplyInChannel,
  onEditMessage,
  onRequestDeleteMessage,
  activeThreadId,
}: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [reactionPickerFor, setReactionPickerFor] = useState<string | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (loading) {
    return (
      <div className="flex-1 p-4 space-y-4 comms-scroll-y">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="text-center max-w-xs"
        >
          <div className="comms-empty-icon scale-75 mb-4">
            <MessageSquare className="w-8 h-8 text-primary/70" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No messages yet</p>
          <p className="text-xs text-muted-foreground">Start the conversation — say hello!</p>
        </motion.div>
      </div>
    )
  }

  return (
    <motion.div ref={containerRef} className="comms-scroll-y px-4 py-2 min-h-0">
      {messages.map((msg, i) => {
        const showDate = shouldShowDateSeparator(messages, i)
        const grouped = shouldGroupWithPrevious(messages, i)
        const isOwn = msg.sender_id === currentUserId
        const senderName = msg.sender_profile?.full_name || msg.sender_profile?.email || 'Unknown'
        const summaries = reactionsByMessage[msg.id] ?? []
        const replyCount = msg.reply_count ?? 0
        const isThreadActive = activeThreadId === msg.id
        const edited = isMessageEdited(msg)

        return (
          <div key={msg.id}>
            {showDate && (
              <div className="flex items-center justify-center my-5">
                <span className="comms-date-pill">
                  {formatDateSeparator(msg.created_at)}
                </span>
              </div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
              className={`group relative flex gap-3 py-1.5 px-3 -mx-1 comms-message-hover ${
                grouped ? 'mt-0.5' : 'mt-3'
              } ${isThreadActive ? 'bg-primary/10 ring-1 ring-primary/25 shadow-sm' : ''} ${
                isOwn && !isThreadActive ? 'comms-own-message' : ''
              }`}
            >
              {/* Hover actions */}
              <div className="absolute -top-3 right-2 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 backdrop-blur-sm border border-border/70 rounded-lg shadow-md p-0.5">
                <Popover
                  open={reactionPickerFor === msg.id}
                  onOpenChange={open => setReactionPickerFor(open ? msg.id : null)}
                >
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="Add reaction">
                      <SmilePlus className="w-3.5 h-3.5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-1" align="end">
                    <div className="flex gap-0.5">
                      {QUICK_REACTIONS.map(emoji => (
                        <button
                          key={emoji}
                          type="button"
                          className="text-lg p-1.5 rounded hover:bg-muted"
                          onClick={() => {
                            onToggleReaction(msg.id, emoji)
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
                  className="h-7 w-7"
                  title="Reply in thread"
                  onClick={() => onOpenThread(msg)}
                >
                  <Reply className="w-3.5 h-3.5" />
                </Button>
                <MessageActionsMenu
                  message={msg}
                  onEdit={isOwn ? onEditMessage : undefined}
                  onDelete={isOwn ? onRequestDeleteMessage : undefined}
                />
              </div>

              {grouped ? (
                <div className="w-9 shrink-0" />
              ) : (
                <Avatar className="w-9 h-9 shrink-0 mt-0.5 ring-2 ring-background shadow-sm">
                  <AvatarImage src={msg.sender_profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
                    {getInitials(senderName)}
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="min-w-0 flex-1">
                {!grouped && (
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className={`text-sm font-semibold ${isOwn ? 'text-primary' : 'text-foreground'}`}>
                      {senderName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(msg.created_at)}
                      {edited && <span className="ml-1">(edited)</span>}
                    </span>
                  </div>
                )}

                <MessageContent content={msg.content} attachments={msg.attachments} />

                {summaries.length > 0 && (
                  <MessageReactions
                    summaries={summaries}
                    onToggle={emoji => onToggleReaction(msg.id, emoji)}
                  />
                )}

                {replyCount > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenThread(msg)}
                    className="mt-1.5 flex items-center gap-1.5 text-xs text-primary font-medium bg-primary/10 hover:bg-primary/15 rounded-full px-2.5 py-1 transition-colors"
                  >
                    <Reply className="w-3.5 h-3.5" />
                    {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                  </button>
                )}

                {replyCount === 0 && (
                  <button
                    type="button"
                    onClick={() => onReplyInChannel(msg)}
                    className="mt-0.5 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
                  >
                    Reply
                  </button>
                )}
              </div>

              {grouped && (
                <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center shrink-0">
                  {formatTime(msg.created_at)}
                </span>
              )}
            </motion.div>
          </div>
        )
      })}
      <div ref={bottomRef} />
    </motion.div>
  )
}
