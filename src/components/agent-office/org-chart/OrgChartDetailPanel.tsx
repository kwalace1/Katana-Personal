import { useNavigate } from 'react-router-dom'
import { MessageSquare, Pencil, Crown, ArrowRight } from 'lucide-react'
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/stores/office/use-app-store'
import type { Agent } from '@/lib/office/types'
import type { NodeBubbleState } from '@/hooks/office/use-delegation-edge-state'
import { AgentAvatar } from '../chat/AgentAvatar'
import { useOffice } from '../OfficeProvider'

/** Slide-over details for a selected org chart node. */
export function OrgChartDetailPanel({
  agent,
  running,
  lastDelegation,
  onOpenChange,
}: {
  agent: Agent | null
  running: boolean
  lastDelegation: NodeBubbleState | null
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const { navMode } = useOffice()
  const agents = useAppStore((s) => s.agents)
  const targets = (agent?.delegationTargetAgentIds ?? [])
    .map((id) => agents[id])
    .filter(Boolean)

  return (
    <Sheet open={Boolean(agent)} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {agent && (
          <>
            <SheetHeader className="border-b border-border/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <AgentAvatar agent={agent} size="lg" />
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-1.5 text-base">
                    <span className="truncate">{agent.name}</span>
                    {agent.role === 'coordinator' && <Crown className="h-4 w-4 shrink-0 text-warning" />}
                  </SheetTitle>
                  <SheetDescription className="text-xs">
                    {running ? 'Working right now' : 'Idle'}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {agent.description && (
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{agent.provider}</Badge>
                <Badge variant="outline">{agent.model}</Badge>
                {agent.orgChart?.teamLabel && (
                  <Badge variant="outline">{agent.orgChart.teamLabel}</Badge>
                )}
              </div>

              {targets.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Delegates to
                    </h4>
                    <div className="space-y-1.5">
                      {targets.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => navigate(`/agents/chat/${t.id}`)}
                          className="flex w-full items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5 text-left hover:bg-muted/50 transition-colors"
                        >
                          <AgentAvatar agent={t} size="sm" />
                          <span className="truncate text-xs font-medium">{t.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {lastDelegation && (
                <>
                  <Separator />
                  <div>
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Latest delegation
                    </h4>
                    <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                        <span className="truncate">{lastDelegation.senderAgent.name}</span>
                        <ArrowRight className="h-3 w-3 shrink-0" />
                        <span className="truncate">{lastDelegation.receiverAgent.name}</span>
                      </div>
                      {lastDelegation.task && (
                        <p className="mt-1.5 text-xs leading-snug">{lastDelegation.task}</p>
                      )}
                      {lastDelegation.result && (
                        <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                          {lastDelegation.result}
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2 border-t border-border/60 px-6 py-3">
              <Button className="flex-1" onClick={() => navigate(`/agents/chat/${agent.id}`)}>
                <MessageSquare className="mr-2 h-4 w-4" /> Open chat
              </Button>
              {navMode === 'full' && (
                <Button variant="outline" onClick={() => navigate('/agents/roster')}>
                  <Pencil className="mr-2 h-4 w-4" /> Edit
                </Button>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
