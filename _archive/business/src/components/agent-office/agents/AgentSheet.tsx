import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/stores/office/use-app-store'
import { api } from '@/lib/office/app/api-client'
import { ALL_TOOLS } from '@/lib/office/tool-definitions'
import { getDefaultAgentToolIds } from '@/lib/office/agent-default-tools'
import type { Agent } from '@/lib/office/types'
import { AgentAvatar } from '../chat/AgentAvatar'

interface AgentForm {
  name: string
  description: string
  provider: string
  model: string
  systemPrompt: string
  tools: string[]
  delegationEnabled: boolean
  delegationTargetAgentIds: string[]
  role: 'worker' | 'coordinator'
}

function formFromAgent(agent: Agent | null): AgentForm {
  return {
    name: agent?.name ?? '',
    description: agent?.description ?? '',
    provider: (agent?.provider as string) ?? '',
    model: agent?.model ?? '',
    systemPrompt: agent?.systemPrompt ?? '',
    tools: agent?.tools ?? getDefaultAgentToolIds(),
    delegationEnabled: agent?.delegationEnabled ?? false,
    delegationTargetAgentIds: agent?.delegationTargetAgentIds ?? [],
    role: agent?.role ?? 'worker',
  }
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <h4 className="text-sm font-semibold">{title}</h4>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Create/edit an agent. Field names and endpoints mirror the office API
 * (POST /agents, PUT /agents/:id) exactly.
 */
export function AgentSheet({
  open,
  agent,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  /** null = create mode */
  agent: Agent | null
  onOpenChange: (open: boolean) => void
  onSaved?: (agent: Agent) => void
}) {
  const agents = useAppStore((s) => s.agents)
  const providers = useAppStore((s) => s.providers)
  const loadProviders = useAppStore((s) => s.loadProviders)
  const loadAgents = useAppStore((s) => s.loadAgents)
  const updateAgentInStore = useAppStore((s) => s.updateAgentInStore)

  const [form, setForm] = useState<AgentForm>(() => formFromAgent(agent))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setForm(formFromAgent(agent))
      if (providers.length === 0) void loadProviders()
    }
  }, [open, agent, providers.length, loadProviders])

  const patch = (p: Partial<AgentForm>) => setForm((f) => ({ ...f, ...p }))

  const selectedProvider = useMemo(
    () => providers.find((p) => p.id === form.provider) ?? null,
    [providers, form.provider],
  )
  const modelOptions = useMemo(() => {
    const models = selectedProvider?.models?.length ? selectedProvider.models : selectedProvider?.defaultModels ?? []
    // Keep the current model visible even if it is custom.
    return form.model && !models.includes(form.model) ? [form.model, ...models] : models
  }, [selectedProvider, form.model])

  const otherAgents = useMemo(
    () => Object.values(agents).filter((a) => a.id !== agent?.id),
    [agents, agent?.id],
  )

  const toggleListValue = (key: 'tools' | 'delegationTargetAgentIds', value: string) => {
    setForm((f) => {
      const list = f[key]
      return { ...f, [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value] }
    })
  }

  const canSave = form.name.trim().length > 0 && form.provider && form.model && !saving

  const handleSave = async () => {
    if (!canSave) return
    setSaving(true)
    const body = {
      name: form.name.trim(),
      description: form.description.trim(),
      provider: form.provider,
      model: form.model,
      systemPrompt: form.systemPrompt,
      tools: form.tools,
      role: form.role,
      delegationEnabled: form.delegationEnabled,
      delegationTargetAgentIds: form.delegationTargetAgentIds,
      delegationTargetMode: form.delegationTargetAgentIds.length > 0 ? 'selected' : 'all',
    }
    try {
      const saved = agent
        ? await api<Agent>('PUT', `/agents/${agent.id}`, body)
        : await api<Agent & { pendingApproval?: boolean }>('POST', '/agents', body)
      if ((saved as { pendingApproval?: boolean }).pendingApproval) {
        toast.info('Agent creation submitted for approval')
      } else {
        if (saved?.id) updateAgentInStore(saved)
        toast.success(agent ? 'Agent updated' : `Agent "${form.name}" created`)
        onSaved?.(saved)
      }
      await loadAgents()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save agent')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <AgentAvatar agent={{ id: agent?.id ?? form.name, name: form.name || 'New Agent' }} size="md" />
            <div>
              <SheetTitle className="text-base">{agent ? `Edit ${agent.name}` : 'New agent'}</SheetTitle>
              <SheetDescription className="text-xs">
                {agent ? 'Update configuration — changes apply to future turns.' : 'Configure identity, model, and capabilities.'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {/* Identity */}
          <div className="space-y-3">
            <SectionHeader title="Identity" />
            <div className="space-y-1.5">
              <Label htmlFor="agent-name">Name *</Label>
              <Input
                id="agent-name"
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Research Analyst"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="agent-desc">Description</Label>
              <Input
                id="agent-desc"
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="What is this agent responsible for?"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => patch({ role: v as AgentForm['role'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="worker">Worker — executes tasks directly</SelectItem>
                  <SelectItem value="coordinator">Coordinator — plans and delegates to the team</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          {/* Model */}
          <div className="space-y-3">
            <SectionHeader title="Model" hint="Which LLM powers this agent." />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Provider *</Label>
                <Select value={form.provider} onValueChange={(v) => patch({ provider: v, model: '' })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                {modelOptions.length > 0 ? (
                  <Select value={form.model} onValueChange={(v) => patch({ model: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.model}
                    onChange={(e) => patch({ model: e.target.value })}
                    placeholder="model id"
                  />
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Instructions */}
          <div className="space-y-3">
            <SectionHeader title="Instructions" hint="The system prompt shaping this agent's behavior." />
            <Textarea
              value={form.systemPrompt}
              onChange={(e) => patch({ systemPrompt: e.target.value })}
              placeholder="You are a helpful specialist for…"
              className="min-h-36 font-mono text-xs leading-relaxed"
            />
          </div>

          <Separator />

          {/* Capabilities */}
          <div className="space-y-3">
            <SectionHeader title="Capabilities" hint="Tools the agent may use during a conversation." />
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {ALL_TOOLS.map((tool) => {
                const checked = form.tools.includes(tool.id)
                return (
                  <label
                    key={tool.id}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-border/50 px-2.5 py-2 hover:bg-muted/40 transition-colors"
                    title={tool.description}
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => toggleListValue('tools', tool.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium">{tool.label}</span>
                      <span className="block truncate text-[10px] text-muted-foreground">{tool.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <Separator />

          {/* Delegation */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader title="Delegation" hint="Let this agent hand work to teammates." />
              <Switch
                checked={form.delegationEnabled}
                onCheckedChange={(v) => patch({ delegationEnabled: v })}
              />
            </div>
            {form.delegationEnabled && (
              otherAgents.length > 0 ? (
                <div className="space-y-1.5">
                  {otherAgents.map((a) => (
                    <label
                      key={a.id}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/50 px-2.5 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={form.delegationTargetAgentIds.includes(a.id)}
                        onCheckedChange={() => toggleListValue('delegationTargetAgentIds', a.id)}
                      />
                      <AgentAvatar agent={a} size="sm" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-medium">{a.name}</span>
                        <span className="block truncate text-[10px] text-muted-foreground">
                          {a.description || a.model}
                        </span>
                      </span>
                    </label>
                  ))}
                  <p className="text-[10px] text-muted-foreground">
                    None selected = may delegate to any agent.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No other agents to delegate to yet.</p>
              )
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={!canSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {agent ? 'Save changes' : 'Create agent'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
