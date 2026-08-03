import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDown, Bot, Loader2, Maximize2, MessageSquare, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/office/use-app-store'
import { useChatStore } from '@/stores/office/use-chat-store'
import { selectActiveSessionId } from '@/stores/office/slices/session-slice'
import { fetchMessagesPaginated } from '@/lib/office/chat/chats'
import { AgentAvatar } from '../chat/AgentAvatar'
import { MessageBubble } from '../chat/MessageBubble'
import { ThinkingIndicator } from '../chat/ThinkingIndicator'
import { ChatComposer } from '../chat/ChatComposer'
import { useOffice } from '../OfficeProvider'

interface CompactChatProps {
  /** Agent to talk to, by display name (from the page context). */
  agentName: string
  moduleLabel?: string
  /** Open the same agent in the full Agent Office. */
  onOpenFull: (agentId: string | null) => void
  onClose: () => void
}

/**
 * A trimmed-down chat surface for the floating popup: no thread sidebar, one
 * agent resolved from the current page's context, streaming answers reusing the
 * shared office chat store. Renders inside a compact `OfficeProvider`.
 */
export function CompactChat({ agentName, moduleLabel, onOpenFull, onClose }: CompactChatProps) {
  const agents = useAppStore((s) => s.agents)
  const currentAgentId = useAppStore((s) => s.currentAgentId)
  const setCurrentAgent = useAppStore((s) => s.setCurrentAgent)
  const sessionId = useAppStore(selectActiveSessionId)
  const markChatRead = useAppStore((s) => s.markChatRead)

  const messages = useChatStore((s) => s.messages)
  const setMessages = useChatStore((s) => s.setMessages)
  const streaming = useChatStore((s) => s.streaming)
  const streamingSessionId = useChatStore((s) => s.streamingSessionId)
  const streamPhase = useChatStore((s) => s.streamPhase)
  const displayText = useChatStore((s) => s.displayText)
  const thinkingText = useChatStore((s) => s.thinkingText)
  const toolEvents = useChatStore((s) => s.toolEvents)
  const sendMessage = useChatStore((s) => s.sendMessage)

  const { userAvatarUrl, userName } = useOffice()

  const [messagesLoading, setMessagesLoading] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const agentList = useMemo(() => Object.values(agents), [agents])

  // Resolve the page's agent by name; fall back to the Hub (router) then any agent.
  const target = useMemo(() => {
    const wanted = agentName.trim().toLowerCase()
    return (
      agentList.find((a) => a.name.trim().toLowerCase() === wanted)
      || agentList.find((a) => /hub/i.test(a.name))
      || agentList[0]
      || null
    )
  }, [agentList, agentName])

  const agent = currentAgentId ? agents[currentAgentId] ?? null : null
  const isStreamingHere = streaming && streamingSessionId === sessionId

  // Select the resolved agent (creates/attaches its thread session).
  useEffect(() => {
    if (!target) return
    if (target.id !== currentAgentId || !target.threadSessionId) {
      void setCurrentAgent(target.id)
    }
  }, [target, currentAgentId, setCurrentAgent])

  // Load the transcript when the active session changes.
  useEffect(() => {
    if (!sessionId) {
      setMessages([], { startIndex: 0, totalMessages: 0 })
      return
    }
    const chat = useChatStore.getState()
    if (chat.streaming && chat.streamingSessionId === sessionId) return

    let cancelled = false
    setMessages([], { startIndex: 0, totalMessages: 0 })
    setMessagesLoading(true)
    fetchMessagesPaginated(sessionId, 50)
      .then((data) => {
        if (cancelled) return
        setMessages(data.messages, { startIndex: data.startIndex, totalMessages: data.total })
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load conversation history')
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })
    markChatRead(sessionId)
    return () => { cancelled = true }
  }, [sessionId, setMessages, markChatRead])

  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (atBottom) scrollToBottom(isStreamingHere ? 'auto' : 'smooth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, displayText, toolEvents.length, isStreamingHere])

  useEffect(() => {
    if (!messagesLoading) scrollToBottom('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLoading, sessionId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60)
  }, [])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/60 bg-card/80 px-3 py-2 backdrop-blur-md">
        {agent ? (
          <AgentAvatar agent={agent} size="sm" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="truncate text-sm font-semibold">{agent?.name ?? agentName}</h2>
            {isStreamingHere && (
              <Badge variant="secondary" className="h-4 gap-1 px-1 text-[9px]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                working
              </Badge>
            )}
          </div>
          {moduleLabel && (
            <p className="truncate text-[10px] text-muted-foreground">{moduleLabel}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => onOpenFull(agent?.id ?? target?.id ?? null)}
          title="Open in Agent Office"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onClose}
          title="Close"
          aria-label="Close chat"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-3 py-3"
        >
          <div className="flex flex-col gap-3">
            {messagesLoading && messages.length === 0 && (
              <div className="flex justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!messagesLoading && messages.length === 0 && !isStreamingHere && agent && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <p className="text-xs font-medium">Ask {agent.name} anything</p>
                <p className="max-w-[15rem] text-[11px] text-muted-foreground">
                  It can answer questions about this module using your live data.
                </p>
              </div>
            )}

            {messages.map((message, i) => (
              <MessageBubble
                key={message.clientRenderId || `${message.time}-${i}`}
                message={message}
                agent={agent}
                onSuggestion={(text) => void sendMessage(text)}
                userAvatarUrl={userAvatarUrl}
                userName={userName}
              />
            ))}

            {/* Tool-call cards intentionally hidden; generic working indicator only. */}
            {isStreamingHere && (
              <div className="flex flex-col gap-2">
                {displayText ? (
                  <MessageBubble
                    message={{ role: 'assistant', text: displayText, time: Date.now() }}
                    agent={agent}
                    streaming
                  />
                ) : (
                  <div className="ml-8">
                    <ThinkingIndicator phase={streamPhase} thinkingText={thinkingText} />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <AnimatePresence>
          {!atBottom && (
            <motion.button
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              type="button"
              onClick={() => scrollToBottom()}
              className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/60 bg-card px-2.5 py-1 text-[11px] shadow-md transition-colors hover:bg-muted"
            >
              <ArrowDown className="h-3 w-3" />
              Latest
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <ChatComposer
        disabled={!agent || !sessionId}
        placeholder={agent ? `Message ${agent.name}…` : 'Connecting…'}
      />
    </div>
  )
}
