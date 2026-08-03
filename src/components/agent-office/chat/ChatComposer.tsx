import { useCallback, useEffect, useRef, useState } from 'react'
import { Send, Square, X, CornerUpLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useChatStore } from '@/stores/office/use-chat-store'

/**
 * Message composer: auto-growing textarea, Enter to send, Shift+Enter for a
 * newline. While the agent streams, the send button becomes a stop button.
 */
export function ChatComposer({
  disabled,
  placeholder,
}: {
  disabled?: boolean
  placeholder?: string
}) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const streaming = useChatStore((s) => s.streaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const stopStreaming = useChatStore((s) => s.stopStreaming)
  const replyingTo = useChatStore((s) => s.replyingTo)
  const setReplyingTo = useChatStore((s) => s.setReplyingTo)

  const autoResize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`
  }, [])

  useEffect(() => {
    autoResize()
  }, [text, autoResize])

  const canSend = !disabled && !streaming && text.trim().length > 0

  const handleSend = useCallback(() => {
    if (!canSend) return
    const value = text
    setText('')
    void sendMessage(value)
  }, [canSend, text, sendMessage])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="rounded-2xl border border-border/70 bg-card/95 backdrop-blur-sm shadow-md overflow-hidden">
        {replyingTo && (
          <div className="flex items-center gap-2 border-b border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
            <CornerUpLeft className="h-3 w-3 shrink-0" />
            <span className="truncate flex-1">
              Replying to: {replyingTo.message.text.slice(0, 120)}
            </span>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="rounded p-0.5 hover:bg-muted"
              aria-label="Cancel reply"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 p-2 pl-3">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={disabled}
            placeholder={placeholder ?? 'Message your agent…'}
            className={cn(
              'flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground',
              'max-h-44 min-h-[2.25rem] disabled:opacity-50',
            )}
          />
          {streaming ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={stopStreaming}
              className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/10"
              title="Stop generating"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className="shrink-0"
              title="Send (Enter)"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-1.5 px-2 text-[10px] text-muted-foreground/70">
        Enter to send · Shift+Enter for a new line
      </p>
    </div>
  )
}
