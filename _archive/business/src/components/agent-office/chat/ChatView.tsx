import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bot, ArrowDown, MoreHorizontal, PanelLeftOpen, PanelLeftClose,
  Network, Eraser, RefreshCw, Loader2, MessageSquare, SquarePen,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/office/use-app-store'
import { useChatStore } from '@/stores/office/use-chat-store'
import { selectActiveSessionId } from '@/stores/office/slices/session-slice'
import { fetchMessagesPaginated } from '@/lib/office/chat/chats'
import { useOffice } from '../OfficeProvider'
import { AgentAvatar } from './AgentAvatar'
import { MessageBubble } from './MessageBubble'
import { ActionProposalCard } from './ActionProposalCard'
import { extractActionProposals } from '@/lib/office/actions/proposals'
import { ThinkingIndicator } from './ThinkingIndicator'
import { ChatComposer } from './ChatComposer'
import { ChatThreadList } from './ChatThreadList'

interface DeepLinkState {
  agentName?: string
}

/**
 * Agent chat — the flagship Agent Office surface. The thread sidebar lists
 * agents; the main column streams the selected agent's conversation through
 * the office chat store (SSE under the hood).
 */
export default function ChatView() {
  const navigate = useNavigate()
  const location = useLocation()
  const { agentId: routeAgentId } = useParams<{ agentId: string }>()
  const { navMode, userAvatarUrl, userName } = useOffice()

  const agents = useAppStore((s) => s.agents)
  const currentAgentId = useAppStore((s) => s.currentAgentId)
  const setCurrentAgent = useAppStore((s) => s.setCurrentAgent)
  const appSettings = useAppStore((s) => s.appSettings)
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
  const hasMoreMessages = useChatStore((s) => s.hasMoreMessages)
  const loadingMore = useChatStore((s) => s.loadingMore)
  const loadMoreMessages = useChatStore((s) => s.loadMoreMessages)
  const loadQueuedMessages = useChatStore((s) => s.loadQueuedMessages)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearContext = useChatStore((s) => s.clearContext)
  const clearChat = useChatStore((s) => s.clearChat)
  const undoClearChat = useChatStore((s) => s.undoClearChat)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [atBottom, setAtBottom] = useState(true)
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const deepLinkHandledRef = useRef(false)

  const agent = currentAgentId ? agents[currentAgentId] ?? null : null
  const agentList = useMemo(() => Object.values(agents), [agents])
  const isStreamingHere = streaming && streamingSessionId === sessionId

  // --- Deep link from other Katana modules: { agentName } in router state ---
  useEffect(() => {
    const state = (location.state ?? {}) as DeepLinkState
    if (deepLinkHandledRef.current || !state.agentName || agentList.length === 0) return
    deepLinkHandledRef.current = true
    const match = agentList.find(
      (a) => a.name.trim().toLowerCase() === state.agentName!.trim().toLowerCase(),
    )
    if (match) navigate(`/agents/chat/${match.id}`, { replace: true, state: null })
  }, [location.state, agentList, navigate])

  // --- Selection wiring: route param -> store; no param -> default agent ---
  useEffect(() => {
    if (routeAgentId) {
      if (agents[routeAgentId]) {
        if (routeAgentId !== currentAgentId || !agents[routeAgentId].threadSessionId) {
          void setCurrentAgent(routeAgentId)
        }
      }
      return
    }
    const fallback =
      (appSettings.defaultAgentId && agents[appSettings.defaultAgentId]?.id)
      || (currentAgentId && agents[currentAgentId]?.id)
      || agentList[0]?.id
    if (fallback) navigate(`/agents/chat/${fallback}`, { replace: true, state: location.state })
  }, [routeAgentId, agents, agentList, appSettings.defaultAgentId, currentAgentId, setCurrentAgent, navigate, location.state])

  // --- Load transcript when the active session changes ---
  useEffect(() => {
    if (!sessionId) {
      setMessages([], { startIndex: 0, totalMessages: 0 })
      return
    }
    // Never clobber an in-flight local stream for this session.
    const chat = useChatStore.getState()
    if (chat.streaming && chat.streamingSessionId === sessionId) return

    let cancelled = false
    setMessages([], { startIndex: 0, totalMessages: 0 })
    setMessagesLoading(true)
    fetchMessagesPaginated(sessionId, 100)
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
    void loadQueuedMessages(sessionId)
    markChatRead(sessionId)
    return () => { cancelled = true }
  }, [sessionId, setMessages, loadQueuedMessages, markChatRead])

  // --- Scroll management ---
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useEffect(() => {
    if (atBottom) scrollToBottom(isStreamingHere ? 'auto' : 'smooth')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, displayText, toolEvents.length, isStreamingHere])

  useEffect(() => {
    // New session: jump straight down once history lands.
    if (!messagesLoading) scrollToBottom('auto')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesLoading, sessionId])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [])

  const handleClearContext = useCallback(async () => {
    setClearConfirmOpen(false)
    try {
      await clearContext()
      toast.success('Context cleared')
    } catch {
      toast.error('Failed to clear context')
    }
  }, [clearContext])

  const handleNewChat = useCallback(async () => {
    if (isStreamingHere) return
    try {
      const result = await clearChat()
      const cleared = result?.cleared ?? 0
      const undoToken = result?.undoToken
      if (undoToken && cleared > 0) {
        toast.success('Started a new chat', {
          description: `Cleared ${cleared} message${cleared === 1 ? '' : 's'}.`,
          action: {
            label: 'Undo',
            onClick: () => {
              void undoClearChat(undoToken)
                .then(() => toast.success('Chat restored'))
                .catch(() => toast.error('Could not undo — the chat was already cleared'))
            },
          },
        })
      } else {
        toast.success('Started a new chat')
      }
    } catch {
      toast.error('Failed to start a new chat')
    }
  }, [clearChat, undoClearChat, isStreamingHere])

  const refreshTranscript = useCallback(() => {
    if (!sessionId) return
    setMessagesLoading(true)
    fetchMessagesPaginated(sessionId, 100)
      .then((data) => setMessages(data.messages, { startIndex: data.startIndex, totalMessages: data.total }))
      .catch(() => toast.error('Refresh failed'))
      .finally(() => setMessagesLoading(false))
  }, [sessionId, setMessages])

  // --- Empty state: no agents at all ---
  if (agentList.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-inner">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No agents yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create your first AI agent to start chatting, delegating work, and automating your team's busywork.
          </p>
        </div>
        {navMode === 'full' && (
          <Button onClick={() => navigate('/agents/roster')}>Create an agent</Button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex overflow-hidden">
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full min-h-0 shrink-0 overflow-hidden"
          >
            <ChatThreadList />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="shrink-0 flex items-center gap-3 border-b border-border/60 bg-card/80 px-3 py-2 backdrop-blur-md sm:px-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Hide conversations' : 'Show conversations'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>
          {agent ? (
            <>
              <AgentAvatar agent={agent} size="md" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-sm font-semibold">{agent.name}</h2>
                  {isStreamingHere && (
                    <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
                      working
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {agent.model}{agent.description ? ` · ${agent.description}` : ''}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => void handleNewChat()}
                  disabled={!sessionId || isStreamingHere}
                  title="New chat — clears this conversation (undoable)"
                >
                  <SquarePen className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => void handleNewChat()} disabled={!sessionId || isStreamingHere}>
                      <SquarePen className="mr-2 h-4 w-4" /> New chat
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={refreshTranscript}>
                      <RefreshCw className="mr-2 h-4 w-4" /> Refresh transcript
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate('/agents/org-chart')}>
                      <Network className="mr-2 h-4 w-4" /> View in org chart
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => setClearConfirmOpen(true)}
                    >
                      <Eraser className="mr-2 h-4 w-4" /> Clear context
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">Select an agent</span>
          )}
        </div>

        {/* Messages */}
        <div className="relative min-h-0 flex-1">
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-3 py-4 sm:px-6"
          >
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {hasMoreMessages && (
                <div className="flex justify-center">
                  <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => void loadMoreMessages()}>
                    {loadingMore && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                    Load earlier messages
                  </Button>
                </div>
              )}

              {messagesLoading && messages.length === 0 && (
                <div className="flex justify-center py-10 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}

              {!messagesLoading && messages.length === 0 && !isStreamingHere && agent && (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Say hello to {agent.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Ask a question, assign work, or let it delegate to the team.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((message, i) => (
                <MessageBubble
                  key={message.clientRenderId || `${message.time}-${i}`}
                  message={message}
                  agent={agent}
                  sessionId={sessionId}
                  onSuggestion={(text) => void sendMessage(text)}
                  userAvatarUrl={userAvatarUrl}
                  userName={userName}
                />
              ))}

              {/* Live streaming row — tool-call cards are intentionally hidden;
                  a generic working indicator shows until answer text streams.
                  Action proposals (Phase 2, propose-only) are the exception:
                  they render as cards as soon as the tool result arrives. */}
              {isStreamingHere && (
                <div className="flex flex-col gap-2">
                  {displayText ? (
                    <MessageBubble
                      message={{ role: 'assistant', text: displayText, time: Date.now(), toolEvents }}
                      agent={agent}
                      sessionId={sessionId}
                      streaming
                    />
                  ) : (
                    <div className="ml-9 flex flex-col gap-2">
                      {extractActionProposals(toolEvents).map((p) => (
                        <ActionProposalCard
                          key={p.requestId}
                          proposal={p}
                          context={{ agentId: agent?.id ?? null, agentName: agent?.name ?? null, sessionId }}
                        />
                      ))}
                      <ThinkingIndicator phase={streamPhase} thinkingText={thinkingText} />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Jump to latest */}
          <AnimatePresence>
            {!atBottom && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                type="button"
                onClick={() => scrollToBottom()}
                className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border/60 bg-card px-3 py-1.5 text-xs shadow-md hover:bg-muted transition-colors"
              >
                <ArrowDown className="h-3 w-3" />
                Jump to latest
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <ChatComposer
          disabled={!agent || !sessionId}
          placeholder={agent ? `Message ${agent.name}…` : 'Select an agent to start'}
        />
      </div>

      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear conversation context?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent will forget this conversation's context. The transcript stays visible, but the
              model starts fresh from here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleClearContext()}>Clear context</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
