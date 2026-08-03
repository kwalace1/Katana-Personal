import { create } from 'zustand'
import type { Message, DevServerStatus, SSEEvent, ChatTraceBlock } from '@/lib/office/types'
import { streamChat } from '@/lib/office/chat/chat'
import {
  clearMessages,
  clearSessionQueue,
  enqueueSessionQueueMessage,
  fetchMessagesPaginated,
  fetchSessionQueue,
  removeQueuedSessionMessage,
  undoClearMessages,
  type ClearChatResult,
} from '@/lib/office/chat/chats'
import { mergeCompletedAssistantMessage, reconcileClientMessageMetadata } from '@/lib/office/chat/chat-streaming-state'
import { stripLeakedFenceArtifacts } from '@/lib/office/chat/assistant-text-sanitize'
import { createAssistantRenderId } from '@/lib/office/chat/assistant-render-id'
import { stripAllInternalMetadata } from '@/lib/office/strip-internal-metadata'
import {
  clearQueuedMessagesForSession,
  createOptimisticQueuedMessage,
  removeQueuedMessageById,
  replaceQueuedMessagesForSession,
  snapshotToQueuedMessages,
  type QueueMessageDraft,
  type QueuedSessionMessage,
} from '@/lib/office/chat/queued-message-queue'
import { speak } from '@/lib/office/tts'
import { extractToolSignals } from '@/lib/office/observer/detect-flags'
import { observeAnswer } from '@/lib/office/observer/observe-answer'
import { getStoredAccessKey } from '@/lib/office/app/api-client'
import { useAppStore } from '@/stores/office/use-app-store'
import { selectActiveSessionId } from '@/stores/office/slices/session-slice'
import { getSoundEnabled, setSoundEnabled, playStreamStart, playStreamEnd, playToolComplete, playError } from '@/lib/office/notifications/notification-sounds'

export interface PendingFile {
  file: File
  path: string
  url: string
}

export interface ToolEvent {
  id: string
  name: string
  input: string
  output?: string
  status: 'running' | 'done' | 'error'
}

/** Once answer text is visible, tool work for this turn is over — stop "running" UI. */
function finalizeRunningToolEvents(events: ToolEvent[]): ToolEvent[] {
  if (!events.some((event) => event.status === 'running')) return events
  return events.map((event) => (
    event.status === 'running' ? { ...event, status: 'done' as const } : event
  ))
}

export interface UsageInfo {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  estimatedCost: number
}

interface ChatState {
  streaming: boolean
  streamingSessionId: string | null
  streamSource: 'local' | 'server' | null
  streamText: string
  assistantRenderId: string | null

  // Task 1: Rich status indicator
  streamPhase: 'queued' | 'thinking' | 'tool' | 'responding' | 'connecting'
  streamToolName: string

  // Task 2: Typing cadence simulation
  displayText: string

  // Task 4: Live agent status bar
  agentStatus: { goal?: string; status?: string; summary?: string; nextAction?: string } | null

  messages: Message[]
  messageStartIndex: number
  setMessages: (msgs: Message[], options?: { startIndex?: number; totalMessages?: number }) => void

  toolEvents: ToolEvent[]
  clearToolEvents: () => void

  lastUsage: UsageInfo | null

  ttsEnabled: boolean
  toggleTts: () => void

  soundEnabled: boolean
  toggleSound: () => void

  // Multi-file attachment support
  pendingFiles: PendingFile[]
  addPendingFile: (f: PendingFile) => void
  removePendingFile: (index: number) => void
  clearPendingFiles: () => void

  // Legacy single-image compat (reads first pendingFile)
  pendingImage: PendingFile | null
  setPendingImage: (img: PendingFile | null) => void

  // Reply-to
  replyingTo: { message: Message; index: number } | null
  setReplyingTo: (reply: { message: Message; index: number } | null) => void

  devServer: DevServerStatus | null
  setDevServer: (ds: DevServerStatus | null) => void

  previewContent: { type: 'browser' | 'image' | 'code' | 'html'; url?: string; content?: string; title?: string } | null
  setPreviewContent: (content: { type: 'browser' | 'image' | 'code' | 'html'; url?: string; content?: string; title?: string } | null) => void

  debugOpen: boolean
  setDebugOpen: (open: boolean) => void

  sendMessage: (text: string, options?: { sessionId?: string }) => Promise<void>
  editAndResend: (messageIndex: number, newText: string) => Promise<void>
  retryLastMessage: () => Promise<void>
  sendHeartbeat: (sessionId: string) => Promise<void>
  stopStreaming: () => void

  // Thinking/reasoning text during streaming
  thinkingText: string
  thinkingStartTime: number

  // Rich trace blocks during streaming (F13)
  streamTraces: ChatTraceBlock[]

  // Voice conversation
  voiceConversationActive: boolean
  onStreamEvent: ((event: { t: string; text?: string }) => void) | null

  // Message queue (send while streaming)
  queuedMessages: QueuedSessionMessage[]
  loadQueuedMessages: (sessionId: string) => Promise<void>
  queueMessage: (sessionId: string, draft: QueueMessageDraft) => Promise<void>
  removeQueuedMessage: (sessionId: string, runId: string) => Promise<void>
  clearQueuedMessagesForSession: (sessionId: string) => Promise<void>

  // Context clearing
  clearContext: () => Promise<void>

  // Full transcript reset ("New chat") — wipes messages with an undo token.
  clearChat: () => Promise<ClearChatResult | null>
  undoClearChat: (undoToken: string) => Promise<void>

  // Pagination
  hasMoreMessages: boolean
  loadingMore: boolean
  totalMessages: number
  loadMoreMessages: () => Promise<void>
}

/** Safety-net timeout for "sending" queue items. Normally cleaned up by
 * matchesPersistedQueuedMessage well before this — only fires if matching fails. */
const SENDING_ITEM_TIMEOUT_MS = 60_000

const CONTROL_TOKEN_PREFIX_RE = /^\s*(?:NO_MESSAGE|HEARTBEAT_OK)(?:(?=[\s.,:;!?()[\]{}"'`-]|$)|(?=[A-Z]))\s*/i
const CONTROL_TOKEN_LINE_RE = /(^|\n)\s*(?:NO_MESSAGE|HEARTBEAT_OK)\s*(\n|$)/gi

function stripHiddenControlTokens(text: string): string {
  let cleaned = String(text || '')
  let previous = ''

  while (cleaned !== previous) {
    previous = cleaned
    cleaned = cleaned.replace(CONTROL_TOKEN_PREFIX_RE, '')
  }

  cleaned = cleaned.replace(CONTROL_TOKEN_LINE_RE, '$1')
  cleaned = stripAllInternalMetadata(cleaned)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim()
  return stripLeakedFenceArtifacts(cleaned)
}

function reconcileMessagesForState(
  nextMessages: Message[],
  currentMessages: Message[],
  assistantRenderId: string | null,
): { messages: Message[]; assistantRenderId: string | null } {
  const messages = reconcileClientMessageMetadata(nextMessages, currentMessages)
  const nextAssistantRenderId = assistantRenderId && messages.some((message) => message.clientRenderId === assistantRenderId)
    ? assistantRenderId
    : null
  return { messages, assistantRenderId: nextAssistantRenderId }
}

function attachedFilesEqual(left: string[] | undefined, right: string[] | undefined): boolean {
  if (!left?.length && !right?.length) return true
  if ((left?.length || 0) !== (right?.length || 0)) return false
  for (let index = 0; index < (left?.length || 0); index += 1) {
    if (left?.[index] !== right?.[index]) return false
  }
  return true
}

function matchesPersistedQueuedMessage(message: Message, queued: QueuedSessionMessage): boolean {
  if (message.role !== 'user') return false
  const messageRunId = typeof message.runId === 'string' && message.runId.trim() ? message.runId : null
  const queuedRunId = typeof queued.runId === 'string' && queued.runId.trim() ? queued.runId : null
  if (messageRunId && queuedRunId) return messageRunId === queuedRunId
  return (
    message.text === queued.text
    && message.replyToId === queued.replyToId
    && message.imagePath === queued.imagePath
    && message.imageUrl === queued.imageUrl
    && attachedFilesEqual(message.attachedFiles, queued.attachedFiles)
  )
}

function syncSessionQueueState(sessionId: string, params: {
  queuedCount: number
  currentRunId?: string | null
  active?: boolean
}): void {
  const appState = useAppStore.getState()
  const session = appState.sessions[sessionId]
  if (!session) return
  appState.updateSessionInStore({
    ...session,
    queuedCount: params.queuedCount,
    currentRunId: params.currentRunId ?? null,
    active: params.active ?? session.active,
  })
}

function markSessionRunIdle(sessionId: string): void {
  const appState = useAppStore.getState()
  const session = appState.sessions[sessionId]
  if (!session) return
  appState.updateSessionInStore({
    ...session,
    active: false,
    currentRunId: null,
  })
}

export const useChatStore = create<ChatState>((set, get) => ({
  streaming: false,
  streamingSessionId: null,
  streamSource: null,
  streamText: '',
  assistantRenderId: null,
  streamPhase: 'thinking',
  streamToolName: '',
  displayText: '',
  agentStatus: null,
  messages: [],
  messageStartIndex: 0,
  setMessages: (msgs, options) => set((s) => {
    const next = reconcileMessagesForState(msgs, s.messages, s.assistantRenderId)
    // Clear "sending" queue items whose text now appears in the message list
    const queuedMessages = s.queuedMessages.filter((item) => {
      if (!item.sending) return true
      if (next.messages.some((message) => matchesPersistedQueuedMessage(message, item))) return false
      if (Date.now() - item.queuedAt > SENDING_ITEM_TIMEOUT_MS) return false
      return true
    })
    const patch: Partial<ChatState> = {
      messages: next.messages,
      assistantRenderId: next.assistantRenderId,
      queuedMessages,
    }
    if (typeof options?.startIndex === 'number' && Number.isFinite(options.startIndex)) {
      patch.messageStartIndex = Math.max(0, Math.trunc(options.startIndex))
    } else if (next.messages.length === 0) {
      patch.messageStartIndex = 0
    }
    if (s.toolEvents.length > 0) patch.toolEvents = []
    if (next.messages.length === 0) {
      patch.hasMoreMessages = false
    } else if (
      typeof options?.startIndex === 'number'
      && Number.isFinite(options.startIndex)
      && Math.trunc(options.startIndex) === 0
      && typeof options?.totalMessages === 'number'
      && Number.isFinite(options.totalMessages)
      && Math.max(0, Math.trunc(options.totalMessages)) === next.messages.length
    ) {
      patch.hasMoreMessages = false
    }
    if (typeof options?.totalMessages === 'number' && Number.isFinite(options.totalMessages)) {
      patch.totalMessages = Math.max(0, Math.trunc(options.totalMessages))
    } else if (next.messages.length === 0 && s.totalMessages !== 0) {
      patch.totalMessages = 0
    }
    return patch
  }),
  toolEvents: [],
  clearToolEvents: () => set({ toolEvents: [] }),
  lastUsage: null,
  ttsEnabled: false,
  toggleTts: () => set((s) => ({ ttsEnabled: !s.ttsEnabled })),
  soundEnabled: getSoundEnabled(),
  toggleSound: () => {
    const next = !get().soundEnabled
    setSoundEnabled(next)
    set({ soundEnabled: next })
  },
  thinkingText: '',
  thinkingStartTime: 0,
  streamTraces: [],
  voiceConversationActive: false,
  onStreamEvent: null,
  queuedMessages: [],
  loadQueuedMessages: async (sessionId) => {
    if (!sessionId) return
    const snapshot = await fetchSessionQueue(sessionId)
    set((s) => {
      const next = replaceQueuedMessagesForSession(
        s.queuedMessages,
        sessionId,
        snapshotToQueuedMessages(snapshot),
        { activeRunId: snapshot.activeRunId },
      )
      // Clear "sending" items whose text has already appeared in chat messages
      const messages = s.messages
      const cleaned = next.filter((item) => {
        if (!item.sending || item.sessionId !== sessionId) return true
        if (messages.some((message) => matchesPersistedQueuedMessage(message, item))) return false
        if (Date.now() - item.queuedAt > SENDING_ITEM_TIMEOUT_MS) return false
        return true
      })
      return { queuedMessages: cleaned }
    })
    syncSessionQueueState(sessionId, {
      queuedCount: snapshot.queueLength,
      currentRunId: snapshot.activeRunId,
      active: snapshot.activeRunId ? true : useAppStore.getState().sessions[sessionId]?.active,
    })
  },
  queueMessage: async (sessionId, draft) => {
    if (!sessionId) return
    const existingForSession = get().queuedMessages.filter((item) => item.sessionId === sessionId).length
    const optimistic = createOptimisticQueuedMessage(sessionId, draft, existingForSession + 1)
    set((s) => ({
      queuedMessages: [...s.queuedMessages, optimistic],
    }))
    syncSessionQueueState(sessionId, {
      queuedCount: Math.max(
        useAppStore.getState().sessions[sessionId]?.queuedCount ?? 0,
        existingForSession + 1,
      ),
      currentRunId: useAppStore.getState().sessions[sessionId]?.currentRunId ?? null,
      active: true,
    })

    try {
      const response = await enqueueSessionQueueMessage(sessionId, {
        message: draft.text,
        imagePath: draft.imagePath,
        imageUrl: draft.imageUrl,
        attachedFiles: draft.attachedFiles,
        replyToId: draft.replyToId,
      })
      set((s) => ({
        queuedMessages: replaceQueuedMessagesForSession(
          removeQueuedMessageById(s.queuedMessages, optimistic.runId),
          sessionId,
          snapshotToQueuedMessages(response.snapshot),
          { activeRunId: response.snapshot.activeRunId },
        ),
      }))
      syncSessionQueueState(sessionId, {
        queuedCount: response.snapshot.queueLength,
        currentRunId: response.snapshot.activeRunId,
        active: true,
      })
    } catch (error) {
      set((s) => ({
        queuedMessages: removeQueuedMessageById(s.queuedMessages, optimistic.runId),
      }))
      const session = useAppStore.getState().sessions[sessionId]
      syncSessionQueueState(sessionId, {
        queuedCount: Math.max(0, (session?.queuedCount ?? 1) - 1),
        currentRunId: session?.currentRunId ?? null,
        active: session?.active,
      })
      throw error
    }
  },
  removeQueuedMessage: async (sessionId, runId) => {
    if (!sessionId || !runId) return
    set((s) => ({ queuedMessages: removeQueuedMessageById(s.queuedMessages, runId) }))
    const response = await removeQueuedSessionMessage(sessionId, runId)
    set((s) => ({
      queuedMessages: replaceQueuedMessagesForSession(
        s.queuedMessages,
        sessionId,
        snapshotToQueuedMessages(response.snapshot),
        { activeRunId: response.snapshot.activeRunId },
      ),
    }))
    syncSessionQueueState(sessionId, {
      queuedCount: response.snapshot.queueLength,
      currentRunId: response.snapshot.activeRunId,
      active: useAppStore.getState().sessions[sessionId]?.active,
    })
  },
  clearQueuedMessagesForSession: async (sessionId) => {
    if (!sessionId) return
    set((s) => ({ queuedMessages: clearQueuedMessagesForSession(s.queuedMessages, sessionId) }))
    const response = await clearSessionQueue(sessionId)
    set((s) => ({
      queuedMessages: replaceQueuedMessagesForSession(
        s.queuedMessages,
        sessionId,
        snapshotToQueuedMessages(response.snapshot),
        { activeRunId: response.snapshot.activeRunId },
      ),
    }))
    syncSessionQueueState(sessionId, {
      queuedCount: response.snapshot.queueLength,
      currentRunId: response.snapshot.activeRunId,
      active: useAppStore.getState().sessions[sessionId]?.active,
    })
  },

  pendingFiles: [],
  addPendingFile: (f) => set((s) => ({ pendingFiles: [...s.pendingFiles, f] })),
  removePendingFile: (index) => set((s) => ({ pendingFiles: s.pendingFiles.filter((_, i) => i !== index) })),
  clearPendingFiles: () => set({ pendingFiles: [] }),

  // Legacy compat: pendingImage reads/writes the first pending file
  get pendingImage() { const files = get().pendingFiles; return files.length ? files[0] : null },
  setPendingImage: (img) => set({ pendingFiles: img ? [img] : [] }),

  // Reply-to
  replyingTo: null,
  setReplyingTo: (reply) => set({ replyingTo: reply }),

  previewContent: null,
  setPreviewContent: (content) => set({ previewContent: content }),

  devServer: null,
  setDevServer: (ds) => set({ devServer: ds }),
  debugOpen: false,
  setDebugOpen: (open) => set({ debugOpen: open }),

  sendMessage: async (text: string, options) => {
    const targetSessionId = options?.sessionId || selectActiveSessionId(useAppStore.getState())
    const { pendingFiles, replyingTo } = get()
    const filesForSend = pendingFiles
    const replyForSend = replyingTo
    if ((!text.trim() && !filesForSend.length) || get().streaming) return
    const sessionId = targetSessionId
    if (!sessionId) return

    // Primary image (backward compat)
    const imagePath = filesForSend[0]?.path
    const imageUrl = filesForSend[0]?.url
    // All attached file paths
    const attachedFiles = filesForSend.length > 1
      ? filesForSend.map((f) => f.path)
      : undefined
    const replyToId = replyForSend?.message?.replyToId ? undefined : replyForSend?.message ? `msg-${replyForSend.index}` : undefined

    const userMsg: Message = {
      role: 'user',
      text,
      time: Date.now(),
      imagePath,
      imageUrl,
      attachedFiles,
      ...(replyToId ? { replyToId } : {}),
    }
    const assistantRenderId = createAssistantRenderId()
    set((s) => ({
      streaming: true,
      streamingSessionId: sessionId,
      streamSource: 'local' as const,
      streamText: '',
      assistantRenderId,
      streamPhase: 'queued' as const,
      streamToolName: '',
      displayText: '',
      agentStatus: null,
      thinkingText: '',
      thinkingStartTime: Date.now(),
      messages: [...s.messages, userMsg],
      pendingFiles: [],
      replyingTo: null,
      toolEvents: [],
      lastUsage: null,
    }))

    // Force scroll to bottom when user sends a message
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('swarmclaw:scroll-bottom'))
    }

    const sendStartedAt = Date.now()
    let fullText = ''
    let suggestions: string[] | null = null
    let toolCallCounter = 0
    let soundFiredStart = false
    const shouldIgnoreTransientError = (msg: string) =>
      /cancelled by steer mode|stopped by user|stream timed out/i.test(msg || '')

    try { await streamChat(sessionId, text, imagePath, imageUrl, (event: SSEEvent) => {
      // Forward events to voice conversation handler if active
      get().onStreamEvent?.(event)
      if (event.t === 'd') {
        fullText += event.text || ''
        const visibleText = stripHiddenControlTokens(fullText)

        // Sound: stream start
        if (!soundFiredStart && get().soundEnabled) {
          soundFiredStart = true
          playStreamStart()
        }

        // Build a single patch for all state changes this event
        const patch: Partial<ChatState> = { streamText: visibleText, displayText: visibleText }

        // Answer text is streaming — end tool/thinking animations for this turn.
        if (visibleText.trim()) {
          patch.streamPhase = 'responding'
          patch.streamToolName = ''
          const currentEvents = get().toolEvents
          if (currentEvents.some((event) => event.status === 'running')) {
            patch.toolEvents = finalizeRunningToolEvents(currentEvents)
          }
        } else if (get().streamPhase !== 'responding') {
          patch.streamPhase = 'responding'
        }

        set(patch)
      } else if (event.t === 'md') {
        // Parse metadata events (usage/run/queue/thinking). Ignore unknown keys.
        try {
          const meta = JSON.parse(event.text || '{}')
          const mdPatch: Partial<ChatState> = {}
          if (meta.usage) {
            mdPatch.lastUsage = meta.usage
          }
          if (meta.suggestions) {
            suggestions = meta.suggestions
          }
          if (meta.thinking && typeof meta.thinking === 'string') {
            mdPatch.thinkingText = meta.thinking
          }
          if (meta.run?.status === 'queued') {
            mdPatch.streamPhase = 'queued'
          } else if (meta.run?.status === 'running') {
            const current = get().streamPhase
            if (current === 'queued' || current === 'connecting') {
              mdPatch.streamPhase = 'thinking'
            }
          }
          if (Object.keys(mdPatch).length > 0) {
            set(mdPatch)
          }
        } catch {
          // Ignore non-JSON metadata payloads.
        }
      } else if (event.t === 'r') {
        fullText = event.text || ''
        const visibleText = stripHiddenControlTokens(fullText)
        set({
          streamText: visibleText,
          displayText: visibleText,
          streamPhase: 'responding',
          streamToolName: '',
          toolEvents: finalizeRunningToolEvents(get().toolEvents),
        })
      } else if (event.t === 'tool_call') {
        // Dedup: skip if the last tool event matches name+input and is still running
        const currentEvents = get().toolEvents
        const lastEvent = currentEvents[currentEvents.length - 1]
        if (
          lastEvent
          && lastEvent.name === (event.toolName || 'unknown')
          && lastEvent.input === (event.toolInput || '')
          && lastEvent.status === 'running'
        ) {
          // Duplicate — skip without triggering subscribers
        } else {
          const id = `tc-${++toolCallCounter}`
          set({
            streamPhase: 'tool' as const,
            streamToolName: event.toolName || 'unknown',
            toolEvents: [...currentEvents, {
              id,
              name: event.toolName || 'unknown',
              input: event.toolInput || '',
              status: 'running',
            }],
          })
        }
      } else if (event.t === 'tool_result') {
        const soundOn = get().soundEnabled
        const currentEvents = get().toolEvents
        const idx = currentEvents.findLastIndex(
          (e) => e.name === event.toolName && e.status === 'running',
        )
        if (idx === -1) {
          // No running event found — check if last event already matches (dedup)
          const last = currentEvents[currentEvents.length - 1]
          const output = event.toolOutput || ''
          const isError = /^(Error:|error:|ECONNREFUSED|ETIMEDOUT|timeout|failed)/i.test(output.trim())
            || output.includes('ECONNREFUSED')
            || output.includes('ETIMEDOUT')
            || output.includes('Error:')
          if (
            last
            && last.name === event.toolName
            && last.output === output
            && last.status === (isError ? 'error' : 'done')
          ) {
            // Already matches — skip without triggering subscribers
          }
        } else {
          const events = [...currentEvents]
          const output = event.toolOutput || ''
          const isError = /^(Error:|error:|ECONNREFUSED|ETIMEDOUT|timeout|failed)/i.test(output.trim())
            || output.includes('ECONNREFUSED')
            || output.includes('ETIMEDOUT')
            || output.includes('Error:')
          events[idx] = { ...events[idx], status: isError ? 'error' : 'done', output }
          if (soundOn) {
            if (isError) playError()
            else playToolComplete()
          }
          set({ toolEvents: events })
        }
      } else if (event.t === 'reset') {
        // Server rolled back state after a transient error — clear accumulated
        // text and tool events so the retry starts with a clean slate.
        fullText = event.text || ''
        const visibleText = stripHiddenControlTokens(fullText)
        toolCallCounter = 0
        soundFiredStart = false
        set({ streamText: visibleText, displayText: visibleText, toolEvents: [], streamPhase: 'connecting' })
      } else if (event.t === 'err') {
        const errText = event.text || 'Unknown'
        if (!shouldIgnoreTransientError(errText)) {
          fullText += '\n[Error: ' + errText + ']'
          const visibleText = stripHiddenControlTokens(fullText)
          set({ streamText: visibleText, displayText: visibleText })
          if (get().soundEnabled) playError()
        }
      } else if (event.t === 'thinking') {
        set((s) => ({ thinkingText: s.thinkingText + (event.text || '') }))
      } else if (event.t === 'status') {
        try {
          const parsed = JSON.parse(event.text || '{}')
          if (
            parsed
            && typeof parsed === 'object'
            && ['goal', 'status', 'summary', 'nextAction'].some((key) => key in parsed)
          ) {
            set({ agentStatus: parsed })
          }
        } catch {
          // ignore malformed status
        }
      } else if (event.t === 'done') {
        set({
          toolEvents: finalizeRunningToolEvents(get().toolEvents),
          streamPhase: 'responding',
          streamToolName: '',
          thinkingText: '',
          thinkingStartTime: 0,
        })
      }
    }, attachedFiles, { replyToId })

    if (get().soundEnabled && soundFiredStart) playStreamEnd()
    const visibleFinalText = stripHiddenControlTokens(fullText)
    if (visibleFinalText.trim()) {
      const currentToolEvents = finalizeRunningToolEvents(get().toolEvents)
      const thinkingSnapshot = get().thinkingText || undefined
      const activeAssistantRenderId = get().assistantRenderId || undefined
      const assistantMsg: Message = {
        role: 'assistant',
        text: visibleFinalText.trim(),
        time: Date.now(),
        clientRenderId: activeAssistantRenderId,
        kind: 'chat',
        thinking: thinkingSnapshot,
        toolEvents: currentToolEvents.length ? currentToolEvents.map(e => ({
          name: e.name,
          input: e.input,
          output: e.output,
          error: e.status === 'error' || undefined,
        })) : undefined,
        suggestions: suggestions || undefined,
      }
      set((s) => ({
        messages: mergeCompletedAssistantMessage(s.messages, assistantMsg),
        streaming: false,
        streamingSessionId: null,
        streamSource: null,
        streamText: '',
        displayText: '',
        streamPhase: 'thinking' as const,
        streamToolName: '',
        thinkingText: '',
        thinkingStartTime: 0,
      }))
      markSessionRunIdle(sessionId)
      if (get().ttsEnabled && !get().voiceConversationActive) speak(visibleFinalText)
      // Fire the async answer observer (best-effort; never affects the chat).
      try {
        const app = useAppStore.getState()
        const agentId = app.sessions[sessionId]?.agentId
        const { used_sql, delegated_to } = extractToolSignals(
          currentToolEvents,
          (id) => app.agents[id]?.name,
        )
        observeAnswer({
          agent_id: agentId || '',
          agent_name: agentId ? app.agents[agentId]?.name : undefined,
          session_id: sessionId,
          question: text,
          answer: visibleFinalText.trim(),
          used_sql,
          delegated_to,
          latency_ms: Date.now() - sendStartedAt,
        })
      } catch { /* observer must never disrupt chat */ }
    } else {
      set({
        streaming: false,
        streamingSessionId: null,
        streamSource: null,
        streamText: '',
        assistantRenderId: null,
        displayText: '',
        streamPhase: 'thinking' as const,
        streamToolName: '',
        thinkingText: '',
        thinkingStartTime: 0,
      })
      markSessionRunIdle(sessionId)
    }

    void useAppStore.getState().refreshSession(sessionId)

    } finally {
      if (get().streaming) {
        set({
          streaming: false,
          streamingSessionId: null,
          streamSource: null,
          streamText: '',
          assistantRenderId: null,
          displayText: '',
          streamPhase: 'thinking' as const,
          streamToolName: '',
          thinkingText: '',
          thinkingStartTime: 0,
        })
        markSessionRunIdle(sessionId)
      }
    }
  },

  editAndResend: async (messageIndex: number, newText: string) => {
    if (get().streaming) return
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId) return
    try {
      const key = getStoredAccessKey()
      const res = await fetch(`/api/office/chats/${sessionId}/edit-resend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { 'X-Access-Key': key } : {}),
        },
        body: JSON.stringify({ messageIndex, newText }),
      })
      if (!res.ok) return
      // Reload messages from server (truncated)
      const msgsRes = await fetch(`/api/office/chats/${sessionId}/messages`, {
        headers: key ? { 'X-Access-Key': key } : undefined,
      })
      if (msgsRes.ok) {
        const msgs = await msgsRes.json()
        get().setMessages(msgs, { startIndex: 0, totalMessages: msgs.length })
      }
      // Re-send with the new text
      await get().sendMessage(newText)
    } catch {
      // ignore
    }
  },

  retryLastMessage: async () => {
    if (get().streaming) return
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId) return
    try {
      const key = getStoredAccessKey()
      const res = await fetch(`/api/office/chats/${sessionId}/retry`, {
        method: 'POST',
        headers: key ? { 'X-Access-Key': key } : undefined,
      })
      if (!res.ok) return
      const { message, imagePath } = await res.json()
      if (!message) return
      // Reload messages from server (without the popped ones)
      const msgsRes = await fetch(`/api/office/chats/${sessionId}/messages`, {
        headers: key ? { 'X-Access-Key': key } : undefined,
      })
      if (msgsRes.ok) {
        const msgs = await msgsRes.json()
        get().setMessages(msgs, { startIndex: 0, totalMessages: msgs.length })
      }
      // Re-send the last user message through the normal SSE flow
      if (imagePath) {
        set({ pendingFiles: [{ file: new File([], ''), path: imagePath, url: '' }] })
      }
      await get().sendMessage(message)
    } catch {
      // ignore
    }
  },

  sendHeartbeat: async (sessionId: string) => {
    if (!sessionId || get().streaming) return

    const settings = useAppStore.getState().appSettings
    const heartbeatPrompt = (settings.heartbeatPrompt || '').trim() || 'SWARM_HEARTBEAT_CHECK'

    let fullText = ''
    let sawError = false
    let toolCallCounter = 0
    const heartbeatToolEvents: ToolEvent[] = []

    await streamChat(
      sessionId,
      heartbeatPrompt,
      undefined,
      undefined,
      (event: SSEEvent) => {
        if (event.t === 'd') {
          fullText += event.text || ''
        } else if (event.t === 'r') {
          // 'r' is a full-snapshot REPLACE (same semantics as the sendMessage
          // handler) — appending it doubles the answer when the engine sends a
          // post-retry snapshot.
          fullText = event.text || ''
        } else if (event.t === 'reset') {
          fullText = event.text || ''
          heartbeatToolEvents.length = 0
          toolCallCounter = 0
        } else if (event.t === 'md') {
          // metadata only
        } else if (event.t === 'tool_call') {
          heartbeatToolEvents.push({
            id: `hb-tc-${++toolCallCounter}`,
            name: event.toolName || 'unknown',
            input: event.toolInput || '',
            status: 'running',
          })
        } else if (event.t === 'tool_result') {
          const idx = heartbeatToolEvents.findLastIndex(
            (e) => e.name === event.toolName && e.status === 'running',
          )
          if (idx !== -1) {
            const output = event.toolOutput || ''
            const isError = /^(Error:|error:|ECONNREFUSED|ETIMEDOUT|timeout|failed)/i.test(output.trim())
              || output.includes('ECONNREFUSED')
              || output.includes('ETIMEDOUT')
              || output.includes('Error:')
            heartbeatToolEvents[idx] = {
              ...heartbeatToolEvents[idx],
              status: isError ? 'error' : 'done',
              output,
            }
          }
        } else if (event.t === 'err') {
          sawError = true
        }
      },
      { internal: true },
    )

    const trimmed = fullText
      .split('\n')
      .filter((line) => !line.includes('[MAIN_LOOP_META]'))
      .join('\n')
      .trim()
    if (!trimmed || trimmed === 'HEARTBEAT_OK' || trimmed === 'NO_MESSAGE' || sawError) return

    const assistantMsg: Message = {
      role: 'assistant',
      text: trimmed,
      time: Date.now(),
      kind: 'heartbeat',
      toolEvents: heartbeatToolEvents.length
        ? heartbeatToolEvents.map((e) => ({
            name: e.name,
            input: e.input,
            output: e.output,
            error: e.status === 'error' || undefined,
          }))
        : undefined,
    }

    set((s) => ({ messages: [...s.messages, assistantMsg] }))
    void useAppStore.getState().refreshSession(sessionId)
  },

  clearContext: async () => {
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId || get().streaming) return
    const marker: Message = { role: 'user', text: '', kind: 'context-clear', time: Date.now() }
    set((s) => ({ messages: [...s.messages, marker] }))
    try {
      const key = getStoredAccessKey()
      await fetch(`/api/office/chats/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { 'X-Access-Key': key } : {}) },
        body: JSON.stringify({ kind: 'context-clear' }),
      })
    } catch {
      // Ignore — marker is already in local state
    }
  },

  clearChat: async () => {
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId || get().streaming) return null
    // Wipe the transcript on the server (returns an undo token) then locally.
    const result = await clearMessages(sessionId)
    get().setMessages([], { startIndex: 0, totalMessages: 0 })
    set({ assistantRenderId: null })
    // Optimistically clear this session's roster preview (lastMessageSummary /
    // messageCount) so the sidebar drops the old conversation's last message
    // immediately, without waiting for the refresh round-trip.
    const app = useAppStore.getState()
    const existing = app.sessions[sessionId]
    if (existing) {
      app.updateSessionInStore({ ...existing, messages: [], messageCount: 0, lastMessageSummary: null })
    }
    void app.refreshSession(sessionId)
    return result
  },

  undoClearChat: async (undoToken) => {
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId || !undoToken) return
    await undoClearMessages(sessionId, undoToken)
    // Reload the restored transcript from the server.
    const data = await fetchMessagesPaginated(sessionId, 100)
    get().setMessages(data.messages, { startIndex: data.startIndex, totalMessages: data.total })
    void useAppStore.getState().refreshSession(sessionId)
  },

  hasMoreMessages: false,
  loadingMore: false,
  totalMessages: 0,
  loadMoreMessages: async () => {
    const { loadingMore, hasMoreMessages, messageStartIndex } = get()
    if (loadingMore || !hasMoreMessages) return
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (!sessionId) return
    set({ loadingMore: true })
    try {
      const key = getStoredAccessKey()
      const currentStartIndex = messageStartIndex
      const res = await fetch(`/api/office/chats/${sessionId}/messages?limit=100&before=${currentStartIndex}`, {
        headers: key ? { 'X-Access-Key': key } : undefined,
      })
      if (res.ok) {
        const data = await res.json() as { messages: Message[]; total: number; hasMore: boolean; startIndex: number }
        set((s) => {
          const next = reconcileMessagesForState(
            [...data.messages, ...s.messages],
            s.messages,
            s.assistantRenderId,
          )
          return {
            messages: next.messages,
            assistantRenderId: next.assistantRenderId,
            messageStartIndex: data.startIndex,
            hasMoreMessages: data.hasMore,
            totalMessages: data.total,
            loadingMore: false,
          }
        })
      } else {
        set({ loadingMore: false })
      }
    } catch {
      set({ loadingMore: false })
    }
  },

  stopStreaming: async () => {
    const sessionId = selectActiveSessionId(useAppStore.getState())
    if (sessionId) {
      try {
        const key = getStoredAccessKey()
        await fetch(`/api/office/chats/${sessionId}/stop`, {
          method: 'POST',
          headers: key ? { 'X-Access-Key': key } : undefined,
        })
      } catch {
        // ignore
      }
    }
    set({
      streaming: false,
      streamingSessionId: null,
      streamSource: null,
      streamText: '',
      assistantRenderId: null,
      displayText: '',
      streamPhase: 'thinking' as const,
      streamToolName: '',
      thinkingText: '',
      thinkingStartTime: 0,
      toolEvents: [],
      agentStatus: null,
    })
    if (sessionId) markSessionRunIdle(sessionId)
  },
}))
