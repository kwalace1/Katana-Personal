import type { Message } from '@/lib/office/types'

function formatClock(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatConnectorTimestamp(ts: number): string {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return formatClock(ts)
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function formatRelativeTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return formatClock(ts)
  if (diff < 604_800_000) return d.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatMessageTimestamp(message: Pick<Message, 'time' | 'source'>): string {
  if (!message.time) return ''
  if (message.source?.connectorId) return formatConnectorTimestamp(message.time)
  return formatRelativeTimestamp(message.time)
}

function buildDisplayDedupKey(message: Message): string | null {
  const source = message.source
  if (source?.connectorId && source.messageId) {
    return [
      message.role,
      source.connectorId,
      source.messageId,
      message.historyExcluded === true ? 'history-excluded' : 'normal',
    ].join('|')
  }
  return null
}

function normalizeAssistantDisplayText(text: string | undefined): string {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function shouldDropDuplicateAssistantMessage(previous: Message, next: Message): boolean {
  if (previous.role !== 'assistant' || next.role !== 'assistant') return false
  if (previous.kind === 'heartbeat' || next.kind === 'heartbeat') return false
  if (previous.kind === 'system' || next.kind === 'system') return false

  const prevRunId = typeof previous.runId === 'string' && previous.runId.trim() ? previous.runId.trim() : null
  const nextRunId = typeof next.runId === 'string' && next.runId.trim() ? next.runId.trim() : null
  if (prevRunId && nextRunId && prevRunId === nextRunId) return true
  if (previous.streaming === true && next.streaming !== true) return true

  const prevText = normalizeAssistantDisplayText(previous.text)
  const nextText = normalizeAssistantDisplayText(next.text)
  if (!prevText || !nextText) return false
  return prevText === nextText
}

function preferAssistantMessage(current: Message, candidate: Message): Message {
  const currentTools = Array.isArray(current.toolEvents) ? current.toolEvents.length : 0
  const candidateTools = Array.isArray(candidate.toolEvents) ? candidate.toolEvents.length : 0
  if (candidateTools !== currentTools) return candidateTools > currentTools ? candidate : current
  const currentTime = typeof current.time === 'number' ? current.time : 0
  const candidateTime = typeof candidate.time === 'number' ? candidate.time : 0
  return candidateTime >= currentTime ? candidate : current
}

export function dedupeMessagesForDisplay(messages: Message[]): Message[] {
  const seen = new Set<string>()
  const deduped: Message[] = []
  for (const message of messages) {
    const key = buildDisplayDedupKey(message)
    if (key) {
      if (seen.has(key)) continue
      seen.add(key)
    }
    const previous = deduped[deduped.length - 1]
    if (previous && shouldDropDuplicateAssistantMessage(previous, message)) {
      deduped[deduped.length - 1] = preferAssistantMessage(previous, message)
      continue
    }
    deduped.push(message)
  }
  return deduped
}
