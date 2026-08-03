import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Plus, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/stores/office/use-app-store'
import { useWs } from '@/hooks/office/use-ws'
import { api } from '@/lib/office/app/api-client'
import type { Agent } from '@/lib/office/types'
import { AgentCard } from './AgentCard'
import { AgentSheet } from './AgentSheet'

/** Agent roster: manage the team — create, configure, duplicate, retire. */
export default function AgentsView() {
  const navigate = useNavigate()
  const agents = useAppStore((s) => s.agents)
  const sessions = useAppStore((s) => s.sessions)
  const loadAgents = useAppStore((s) => s.loadAgents)
  const togglePinAgent = useAppStore((s) => s.togglePinAgent)

  const [query, setQuery] = useState('')
  const [providerFilter, setProviderFilter] = useState<string>('all')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null)

  useWs('agents', loadAgents, 60_000)

  const runningAgentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of Object.values(sessions)) {
      if (s.agentId && s.active) ids.add(s.agentId)
    }
    return ids
  }, [sessions])

  const providerOptions = useMemo(
    () => Array.from(new Set(Object.values(agents).map((a) => a.provider as string))).sort(),
    [agents],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.values(agents)
      .filter((a) =>
        (providerFilter === 'all' || a.provider === providerFilter)
        && (!q || a.name.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q)))
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1
        return a.name.localeCompare(b.name)
      })
  }, [agents, query, providerFilter])

  const openCreate = () => { setEditingAgent(null); setSheetOpen(true) }
  const openEdit = (agent: Agent) => { setEditingAgent(agent); setSheetOpen(true) }

  const handleDuplicate = async (agent: Agent) => {
    try {
      await api<Agent>('POST', '/agents', {
        name: `${agent.name} (copy)`,
        description: agent.description,
        provider: agent.provider,
        model: agent.model,
        systemPrompt: agent.systemPrompt,
        tools: agent.tools,
        role: agent.role,
        delegationEnabled: agent.delegationEnabled,
        delegationTargetAgentIds: agent.delegationTargetAgentIds,
      })
      await loadAgents()
      toast.success(`Duplicated "${agent.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Duplicate failed')
    }
  }

  const handleDelete = async () => {
    const target = deleteTarget
    setDeleteTarget(null)
    if (!target) return
    try {
      await api('DELETE', `/agents/${target.id}`)
      await loadAgents()
      toast.success(`Deleted "${target.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  const total = Object.keys(agents).length

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">Agents</h2>
            <p className="text-xs text-muted-foreground">
              {total} agent{total === 1 ? '' : 's'} · {runningAgentIds.size} active
            </p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search agents…"
                className="h-9 w-52 pl-8"
              />
            </div>
            {providerOptions.length > 1 && (
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="h-9 w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All providers</SelectItem>
                  {providerOptions.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              New Agent
            </Button>
          </div>
        </div>

        {/* Grid */}
        {total === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-inner">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold">Build your agent team</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                Agents chat, run tools, and delegate to each other. Create your first one to get started.
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create your first agent
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No agents match your filters.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                running={runningAgentIds.has(agent.id)}
                onOpenChat={() => navigate(`/agents/chat/${agent.id}`)}
                onEdit={() => openEdit(agent)}
                onDuplicate={() => void handleDuplicate(agent)}
                onDelete={() => setDeleteTarget(agent)}
                onTogglePin={() => void togglePinAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>

      <AgentSheet
        open={sheetOpen}
        agent={editingAgent}
        onOpenChange={setSheetOpen}
      />

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent moves to the office trash and stops receiving work. Its conversation history is kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
