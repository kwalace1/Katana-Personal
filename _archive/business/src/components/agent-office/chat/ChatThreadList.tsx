import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Pin, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/stores/office/use-app-store'
import { useChatStore } from '@/stores/office/use-chat-store'
import { timeAgoShort } from '@/lib/office/time-format'
import { toPreviewText } from '@/lib/office/chat/preview-text'
import type { Agent, Session } from '@/lib/office/types'
import { AgentAvatar } from './AgentAvatar'
import { useOffice } from '../OfficeProvider'

interface ThreadRow {
  agent: Agent
  session: Session | null
  lastActive: number
}

/** Sidebar list of agent threads: pinned first, then most recently active. */
export function ChatThreadList() {
  const navigate = useNavigate()
  const { navMode } = useOffice()
  const [query, setQuery] = useState('')

  const agents = useAppStore((s) => s.agents)
  const sessions = useAppStore((s) => s.sessions)
  const currentAgentId = useAppStore((s) => s.currentAgentId)
  const togglePinAgent = useAppStore((s) => s.togglePinAgent)
  const streaming = useChatStore((s) => s.streaming)
  const streamingSessionId = useChatStore((s) => s.streamingSessionId)

  const rows = useMemo<ThreadRow[]>(() => {
    const list = Object.values(agents).map((agent) => {
      const session = agent.threadSessionId ? sessions[agent.threadSessionId] ?? null : null
      return {
        agent,
        session,
        lastActive: session?.lastActiveAt ?? session?.createdAt ?? 0,
      }
    })
    const q = query.trim().toLowerCase()
    const filtered = q
      ? list.filter(({ agent }) =>
          agent.name.toLowerCase().includes(q) || (agent.description || '').toLowerCase().includes(q))
      : list
    return filtered.sort((a, b) => {
      if (Boolean(a.agent.pinned) !== Boolean(b.agent.pinned)) return a.agent.pinned ? -1 : 1
      return b.lastActive - a.lastActive
    })
  }, [agents, sessions, query])

  const isThreadStreaming = (row: ThreadRow) =>
    (streaming && streamingSessionId && row.agent.threadSessionId === streamingSessionId) || Boolean(row.session?.active)

  return (
    <div className="flex h-full w-72 flex-col border-r border-border/60 bg-card/90 backdrop-blur-md">
      <div className="shrink-0 space-y-2 p-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold px-1">Conversations</h3>
          {navMode === 'full' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="New agent"
              onClick={() => navigate('/agents/roster')}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents…"
            className="h-8 pl-8 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
        {rows.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">
            {query ? 'No agents match your search.' : 'No agents yet.'}
          </p>
        )}
        {rows.map((row) => {
          const active = row.agent.id === currentAgentId
          const preview = toPreviewText(row.session?.lastMessageSummary?.text)
          return (
            <div
              key={row.agent.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/agents/chat/${row.agent.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/agents/chat/${row.agent.id}`)
                }
              }}
              className={cn(
                'group relative w-full cursor-pointer rounded-lg px-2.5 py-2 text-left',
                'transition-colors duration-150 ease-out',
                active ? 'bg-primary/10' : 'hover:bg-muted/60',
              )}
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <AgentAvatar agent={row.agent} size="md" />
                  {isThreadStreaming(row) && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card animate-pulse" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('truncate text-sm font-medium', active && 'text-primary')}>
                      {row.agent.name}
                    </span>
                    {row.agent.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                    {row.lastActive > 0 && (
                      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground transition-opacity duration-150 group-hover:opacity-0">
                        {timeAgoShort(row.lastActive)}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {preview || row.agent.description || row.agent.model}
                  </p>
                </div>
              </div>
              {/* Pin toggle fades in over the timestamp — no layout shift on hover */}
              <button
                type="button"
                title={row.agent.pinned ? 'Unpin agent' : 'Pin agent'}
                aria-label={row.agent.pinned ? 'Unpin agent' : 'Pin agent'}
                onClick={(e) => {
                  e.stopPropagation()
                  void togglePinAgent(row.agent.id)
                }}
                className={cn(
                  'absolute right-2 top-2 rounded-md p-1 opacity-0 transition-all duration-150',
                  'text-muted-foreground hover:text-foreground hover:bg-muted',
                  'group-hover:opacity-100 focus-visible:opacity-100',
                )}
              >
                <Pin className={cn('h-3.5 w-3.5', row.agent.pinned && 'fill-current')} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
