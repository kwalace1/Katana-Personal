import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Copy, Paperclip } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Agent, Message } from '@/lib/office/types'
import { sanitizeAgentText } from './sanitize-agent-text'
import { extractActionProposals } from '@/lib/office/actions/proposals'
import { ActionProposalCard } from './ActionProposalCard'
import { AgentAvatar } from './AgentAvatar'
import { UserAvatar } from './UserAvatar'
import { MarkdownBody } from './MarkdownBody'

function fileName(path: string): string {
  return path.split(/[\\/]/).pop() || path
}

/** Small copy-to-clipboard button shown in the message footer row. */
function CopyButton({ text, alignEnd }: { text: string; alignEnd?: boolean }) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard unavailable (permissions/insecure context) — stay silent.
    }
  }, [text])

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? 'Copied' : 'Copy message'}
      title={copied ? 'Copied' : 'Copy message'}
      className={cn(
        'inline-flex items-center gap-1 rounded p-0.5 text-muted-foreground/70 transition-all hover:text-foreground',
        'opacity-0 group-hover/msg:opacity-100 focus-visible:opacity-100',
        copied && 'opacity-100 text-emerald-500 hover:text-emerald-500',
        alignEnd && 'order-first',
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

/**
 * One transcript row. User messages sit right in a brand-gradient bubble;
 * assistant messages sit left beside the agent avatar in a card bubble with
 * optional reasoning, tool events, and suggestion chips.
 */
export const MessageBubble = memo(function MessageBubble({
  message,
  agent,
  sessionId,
  streaming = false,
  onSuggestion,
  userAvatarUrl,
  userName,
}: {
  message: Message
  agent: Agent | null
  /** Active chat session id — recorded on any action executed from this row. */
  sessionId?: string | null
  /** True for the in-flight assistant row (adds the typing cursor). */
  streaming?: boolean
  onSuggestion?: (text: string) => void
  /** Signed-in user's avatar/name, shown on their own (right-aligned) messages. */
  userAvatarUrl?: string | null
  userName?: string | null
}) {
  const isUser = message.role === 'user'
  // Relay models occasionally restate their answer around an empty code fence;
  // sanitize persisted assistant text exactly like SwarmClaw's own UI did.
  // Live streaming text stays raw (partial text would trip the dedup heuristics).
  const assistantText = !isUser && !streaming ? sanitizeAgentText(message.text) : message.text
  const proposals = !isUser ? extractActionProposals(message.toolEvents) : []

  if (message.kind === 'context-clear') {
    return (
      <div className="flex items-center gap-3 py-1 text-[11px] text-muted-foreground">
        <div className="h-px flex-1 bg-border/60" />
        Context cleared
        <div className="h-px flex-1 bg-border/60" />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={cn('group/msg flex gap-2.5', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && <AgentAvatar agent={agent} size="sm" className="mt-1" />}

      <div className={cn('flex flex-col gap-1.5 max-w-[85%] sm:max-w-[75%]', isUser && 'items-end')}>
        {/* Reasoning (persisted thinking) */}
        {!isUser && message.thinking?.trim() && (
          <details className="group self-start max-w-full">
            <summary className="cursor-pointer list-none text-[11px] text-muted-foreground hover:text-foreground transition-colors">
              Reasoning ▸
            </summary>
            <div className="mt-1 rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
              {message.thinking}
            </div>
          </details>
        )}

        {/* Tool calls are intentionally hidden from the transcript — the raw
            tool names (spawn_subagent, execute_sql, …) are internal plumbing
            users don't need to see. The events are still captured on the
            message and fed to the answer observer. Exception: action proposals
            (Phase 2, propose-only) are lifted out of tool outputs and rendered
            as structured cards. */}
        {!isUser && proposals.length > 0 && (
          <div className="flex flex-col gap-1.5 self-start w-full">
            {proposals.map((p) => (
              <ActionProposalCard
                key={p.requestId}
                proposal={p}
                context={{ agentId: agent?.id ?? null, agentName: agent?.name ?? null, sessionId: sessionId ?? null }}
              />
            ))}
          </div>
        )}

        {/* Bubble */}
        {(message.text || streaming) && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 shadow-sm',
              isUser
                ? 'bg-gradient-to-br from-primary to-secondary text-primary-foreground rounded-br-md'
                : 'bg-card border border-border/60 rounded-bl-md',
            )}
          >
            {isUser ? (
              <div className="text-sm whitespace-pre-wrap break-words">{message.text}</div>
            ) : (
              <>
                <MarkdownBody text={assistantText} />
                {streaming && (
                  <span className="ml-0.5 inline-block h-3.5 w-0.5 translate-y-0.5 animate-pulse rounded-full bg-primary" />
                )}
              </>
            )}
          </div>
        )}

        {/* Attachments */}
        {(message.attachedFiles?.length || message.imagePath || message.imageUrl) && (
          <div className={cn('flex flex-wrap gap-1', isUser && 'justify-end')}>
            {message.imageUrl && (
              <img
                src={message.imageUrl}
                alt="attachment"
                className="max-h-40 rounded-lg border border-border/60 object-cover"
              />
            )}
            {(message.attachedFiles || (message.imagePath && !message.imageUrl ? [message.imagePath] : [])).map((f) => (
              <span
                key={f}
                className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                <Paperclip className="h-3 w-3" />
                {fileName(f)}
              </span>
            ))}
          </div>
        )}

        {/* Suggestions */}
        {!isUser && !streaming && (message.suggestions?.length ?? 0) > 0 && onSuggestion && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {message.suggestions!.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSuggestion(s)}
                className="rounded-full border border-primary/25 bg-primary/5 px-3 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Footer: timestamp + copy */}
        <span
          className={cn(
            'flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground/70',
            isUser && 'justify-end text-right',
          )}
        >
          {new Date(message.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          {!streaming && (message.text || '').trim() && (
            <CopyButton text={isUser ? message.text : assistantText} alignEnd={isUser} />
          )}
        </span>
      </div>

      {isUser && <UserAvatar avatarUrl={userAvatarUrl} name={userName} size="sm" className="mt-1" />}
    </motion.div>
  )
})
