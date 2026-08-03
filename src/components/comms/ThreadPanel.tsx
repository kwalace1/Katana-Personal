import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Reply } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageActionsMenu } from '@/components/comms/MessageActionsMenu'
import { MessageContent } from '@/components/comms/MessageContent'
import { MessageComposer } from '@/components/comms/MessageComposer'
import type { Message } from '@/lib/comms-api'
import { isMessageEdited } from '@/lib/comms-api'
import { getMessagePreview } from '@/lib/comms-message-content'

interface ThreadPanelProps {
  parentMessage: Message
  replies: Message[]
  loading: boolean
  currentUserId: string
  editingReply: Message | null
  onClose: () => void
  onSendReply: (content: string) => Promise<void>
  onEditMessage?: (message: Message) => void
  onRequestDeleteMessage?: (messageId: string) => void
  onCancelEdit?: () => void
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

export function ThreadPanel({
  parentMessage,
  replies,
  loading,
  currentUserId,
  editingReply,
  onClose,
  onSendReply,
  onEditMessage,
  onRequestDeleteMessage,
  onCancelEdit,
}: ThreadPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const parentName =
    parentMessage.sender_profile?.full_name ||
    parentMessage.sender_profile?.email ||
    'Unknown'
  const isParentOwn = parentMessage.sender_id === currentUserId
  const parentEdited = isMessageEdited(parentMessage)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [replies.length])

  const composerPlaceholder = editingReply
    ? 'Edit your reply...'
    : `Reply to ${getMessagePreview(parentMessage.content).slice(0, 30)}...`

  return (
    <motion.div
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="comms-thread-panel flex flex-col h-full shrink-0 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-gradient-to-r from-primary/5 to-transparent shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 ring-1 ring-primary/20"
          >
            <Reply className="w-3.5 h-3.5 text-primary shrink-0" />
          </motion.div>
          <h3 className="font-semibold text-sm truncate">Thread</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Parent message */}
      <div className="px-4 py-3 border-b border-border/60 bg-muted/40 shrink-0 group relative">
        {isParentOwn && (onEditMessage || onRequestDeleteMessage) && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageActionsMenu
              message={parentMessage}
              onEdit={onEditMessage}
              onDelete={onRequestDeleteMessage}
            />
          </div>
        )}
        <div className="flex gap-2">
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={parentMessage.sender_profile?.avatar_url ?? undefined} />
            <AvatarFallback className="text-xs">{getInitials(parentName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{parentName}</span>
              <span className="text-xs text-muted-foreground">
                {formatTime(parentMessage.created_at)}
                {parentEdited && <span className="ml-1">(edited)</span>}
              </span>
            </div>
            <MessageContent content={parentMessage.content} />
          </div>
        </div>
      </div>

      {/* Replies */}
      <div className="comms-scroll-y px-4 py-2">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : replies.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            No replies yet. Be the first to reply.
          </p>
        ) : (
          replies.map(reply => {
            const name =
              reply.sender_profile?.full_name || reply.sender_profile?.email || 'Unknown'
            const isOwn = reply.sender_id === currentUserId
            const edited = isMessageEdited(reply)
            return (
              <div key={reply.id} className="group relative flex gap-2 py-2 pr-8">
                {isOwn && (onEditMessage || onRequestDeleteMessage) && (
                  <div className="absolute top-1 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <MessageActionsMenu
                      message={reply}
                      onEdit={onEditMessage}
                      onDelete={onRequestDeleteMessage}
                    />
                  </div>
                )}
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={reply.sender_profile?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`text-xs font-semibold ${isOwn ? 'text-primary' : 'text-foreground'}`}
                    >
                      {name}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(reply.created_at)}
                      {edited && <span className="ml-1">(edited)</span>}
                    </span>
                  </div>
                  <MessageContent content={reply.content} />
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {editingReply && onCancelEdit && (
        <div className="px-3 py-1.5 bg-muted/50 border-t border-border text-xs text-muted-foreground shrink-0">
          Editing reply —{' '}
          <button type="button" className="text-primary underline" onClick={onCancelEdit}>
            cancel
          </button>
        </div>
      )}

      <MessageComposer
        key={editingReply?.id ?? 'thread-compose'}
        onSend={onSendReply}
        placeholder={composerPlaceholder}
        compact
        initialContent={editingReply?.content ?? ''}
      />
    </motion.div>
  )
}
