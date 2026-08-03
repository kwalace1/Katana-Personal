import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Paperclip, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmojiPickerPopover } from '@/components/comms/EmojiPickerPopover'
import { GifPickerPopover } from '@/components/comms/GifPickerPopover'
import { encodeGifMessage, getMessagePreview } from '@/lib/comms-message-content'
import * as CommsApi from '@/lib/comms-api'
import type { Message, UserProfileSummary } from '@/lib/comms-api'

type PendingAttachment = {
  path: string
  fileName: string
  mimeType: string
  size: number
}

interface MessageComposerProps {
  onSend: (
    content: string,
    extras?: { attachments?: PendingAttachment[] }
  ) => Promise<void>
  placeholder?: string
  compact?: boolean
  replyTo?: Message | null
  onCancelReply?: () => void
  initialContent?: string
  disabled?: boolean
  disabledReason?: string
  orgMembers?: UserProfileSummary[]
  allowAttachments?: boolean
}

export function MessageComposer({
  onSend,
  placeholder = 'Type a message...',
  compact = false,
  replyTo,
  onCancelReply,
  initialContent = '',
  disabled = false,
  disabledReason,
  orgMembers = [],
  allowAttachments = true,
}: MessageComposerProps) {
  const [content, setContent] = useState(initialContent)
  const [sending, setSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setContent(initialContent)
    if (initialContent) {
      textareaRef.current?.focus()
    }
  }, [initialContent])

  const mentionSuggestions = useMemo(() => {
    if (mentionQuery === null) return []
    const q = mentionQuery.toLowerCase()
    const extras: UserProfileSummary[] = [
      {
        id: '__channel__',
        full_name: 'channel',
        email: '',
        avatar_url: null,
      },
    ]
    return [...extras, ...orgMembers]
      .filter((m) => {
        const name = m.full_name?.toLowerCase() ?? ''
        const email = m.email?.toLowerCase() ?? ''
        return !q || name.includes(q) || email.includes(q) || email.split('@')[0]?.includes(q)
      })
      .slice(0, 8)
  }, [mentionQuery, orgMembers])

  const handleSend = useCallback(async () => {
    const trimmed = content.trim()
    if ((!trimmed && pendingFiles.length === 0) || sending || disabled) return
    setSending(true)
    try {
      await onSend(trimmed || (pendingFiles.length ? 'Shared a file' : ''), {
        attachments: pendingFiles,
      })
      setContent('')
      setPendingFiles([])
      setMentionQuery(null)
      textareaRef.current?.focus()
    } finally {
      setSending(false)
    }
  }, [content, pendingFiles, sending, disabled, onSend])

  const handleSendGif = useCallback(
    async (gifUrl: string) => {
      if (sending || disabled) return
      setSending(true)
      try {
        await onSend(encodeGifMessage(gifUrl))
        textareaRef.current?.focus()
      } finally {
        setSending(false)
      }
    },
    [sending, disabled, onSend]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
      if (e.key === 'Escape') setMentionQuery(null)
    },
    [handleSend]
  )

  const handleChange = useCallback((value: string) => {
    setContent(value)
    const cursor = textareaRef.current?.selectionStart ?? value.length
    const before = value.slice(0, cursor)
    const match = before.match(/@([A-Za-z0-9._+-]*)$/)
    setMentionQuery(match ? match[1] ?? '' : null)
  }, [])

  const insertMention = useCallback((member: UserProfileSummary) => {
    const label = member.id === '__channel__' ? 'channel' : member.full_name || member.email
    setContent((prev) => {
      const cursor = textareaRef.current?.selectionStart ?? prev.length
      const before = prev.slice(0, cursor)
      const after = prev.slice(cursor)
      const replaced = before.replace(/@([A-Za-z0-9._+-]*)$/, `@${label} `)
      return replaced + after
    })
    setMentionQuery(null)
    textareaRef.current?.focus()
  }, [])

  const insertEmoji = useCallback((emoji: string) => {
    setContent((prev) => prev + emoji)
    textareaRef.current?.focus()
  }, [])

  const handleFilePick = useCallback(async (files: FileList | null) => {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files).slice(0, 5)) {
        if (file.size > 15 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 15MB`)
          continue
        }
        const result = await CommsApi.uploadCommsAttachment(file)
        if ('error' in result) {
          toast.error(result.error)
          continue
        }
        setPendingFiles((prev) => [...prev, result])
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [])

  const canSend =
    (content.trim().length > 0 || pendingFiles.length > 0) && !sending && !disabled && !uploading

  const replyName =
    replyTo?.sender_profile?.full_name || replyTo?.sender_profile?.email || 'message'

  return (
    <div className={`shrink-0 ${compact ? 'px-2 pb-2' : 'pb-3 pt-1'}`}>
      <div className={`comms-composer-shell ${compact ? '!mx-2 !mb-2' : ''} ${disabled ? 'opacity-60' : ''}`}>
        <div className={compact ? 'px-2 py-2' : 'px-3 py-3'}>
          {disabled && disabledReason && (
            <p className="text-xs text-muted-foreground mb-2 px-1">{disabledReason}</p>
          )}
          {replyTo && onCancelReply && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="flex items-center gap-2 mb-2 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs overflow-hidden"
            >
              <span className="text-muted-foreground shrink-0">Replying to</span>
              <span className="font-medium truncate flex-1">
                {replyName}: {getMessagePreview(replyTo.content)}
              </span>
              <button
                type="button"
                onClick={onCancelReply}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
          {pendingFiles.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {pendingFiles.map((f) => (
                <span
                  key={f.path}
                  className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-[11px]"
                >
                  <span className="truncate max-w-[140px]">{f.fileName}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setPendingFiles((prev) => prev.filter((p) => p.path !== f.path))
                    }
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {mentionSuggestions.length > 0 && (
            <div className="mb-2 rounded-md border bg-popover shadow-md max-h-40 overflow-y-auto">
              {mentionSuggestions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                  onClick={() => insertMention(m)}
                >
                  @{m.full_name || m.email}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1.5">
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.05, duration: 0.2 }}
              className="flex items-center shrink-0"
            >
              <EmojiPickerPopover onSelect={insertEmoji} />
              <GifPickerPopover onSelect={(url) => void handleSendGif(url)} />
              {allowAttachments && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
                    onChange={(e) => void handleFilePick(e.target.files)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled || uploading}
                    title="Attach file"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4" />
                  </Button>
                </>
              )}
            </motion.div>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? disabledReason || 'Posting disabled' : placeholder}
              disabled={disabled}
              className={`min-h-[40px] max-h-32 resize-none border-0 shadow-none focus-visible:ring-0 ${
                compact ? 'text-xs' : 'text-sm'
              }`}
              rows={1}
            />
            <Button
              size={compact ? 'sm' : 'default'}
              className="shrink-0"
              onClick={() => void handleSend()}
              disabled={!canSend}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
