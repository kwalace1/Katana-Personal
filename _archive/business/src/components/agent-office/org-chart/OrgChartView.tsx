import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Network, Plus, ZoomIn, ZoomOut, Maximize2, LocateFixed } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/stores/office/use-app-store'
import { useWs } from '@/hooks/office/use-ws'
import {
  buildOrgTree, layoutTree, computeOrgChartMove, getDescendantIds, deriveTeams,
  type OrgTreeNode,
} from '@/lib/office/org-chart'
import {
  useDelegationEdgeState, useNodeDelegationBubbles,
} from '@/hooks/office/use-delegation-edge-state'
import type { Agent } from '@/lib/office/types'
import { useOffice } from '../OfficeProvider'
import { useOrgChartPanZoom } from './use-org-chart-pan-zoom'
import { useOrgChartDrag } from './use-org-chart-drag'
import { OrgChartNode, NODE_W, NODE_H, type DelegationTone } from './OrgChartNode'
import { OrgChartEdge } from './OrgChartEdge'
import { OrgChartTeamRegion } from './OrgChartTeamRegion'
import { DelegationBubble } from './DelegationBubble'
import { OrgChartDetailPanel } from './OrgChartDetailPanel'

const LEVEL_GAP = 90
const SIBLING_GAP = 44
const UNATTACHED_GAP = 160

interface EdgePair {
  parentId: string
  childId: string
}

function collectEdges(roots: OrgTreeNode[]): EdgePair[] {
  const edges: EdgePair[] = []
  const walk = (node: OrgTreeNode) => {
    for (const child of node.children) {
      edges.push({ parentId: node.agent.id, childId: child.agent.id })
      walk(child)
    }
  }
  for (const root of roots) walk(root)
  return edges
}

/**
 * Interactive agent hierarchy: pan/zoom canvas, drag-to-reparent, team
 * regions, and live delegation animations along the reporting lines.
 */
export default function OrgChartView() {
  const navigate = useNavigate()
  const { navMode } = useOffice()
  const agents = useAppStore((s) => s.agents)
  const sessions = useAppStore((s) => s.sessions)
  const loadAgents = useAppStore((s) => s.loadAgents)
  const batchUpdateAgents = useAppStore((s) => s.batchUpdateAgents)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const didFitRef = useRef(false)

  useWs('agents', loadAgents, 60_000)

  const edgeLive = useDelegationEdgeState(agents)
  const { activeBubbles, lastBubbles } = useNodeDelegationBubbles(agents)

  const { roots, unattached } = useMemo(() => buildOrgTree(agents), [agents])

  // Tree layout + explicit position overrides + an "unassigned" row underneath.
  const positions = useMemo(() => {
    const pos = layoutTree(roots, {
      nodeWidth: NODE_W,
      nodeHeight: NODE_H,
      levelGap: LEVEL_GAP,
      siblingGap: SIBLING_GAP,
    })
    for (const agent of Object.values(agents)) {
      if (agent.orgChart?.x != null && agent.orgChart?.y != null) {
        pos.set(agent.id, { x: agent.orgChart.x, y: agent.orgChart.y })
      }
    }
    let maxY = 0
    for (const p of pos.values()) maxY = Math.max(maxY, p.y)
    unattached.forEach((agent, i) => {
      if (!pos.has(agent.id)) {
        pos.set(agent.id, {
          x: i * (NODE_W + SIBLING_GAP),
          y: maxY + (pos.size > 0 ? NODE_H + UNATTACHED_GAP : 0),
        })
      }
    })
    return pos
  }, [roots, unattached, agents])

  const edges = useMemo(() => collectEdges(roots), [roots])
  const teams = useMemo(() => deriveTeams(agents), [agents])

  const runningAgentIds = useMemo(() => {
    const ids = new Set<string>()
    for (const s of Object.values(sessions)) {
      if (s.agentId && s.active) ids.add(s.agentId)
    }
    return ids
  }, [sessions])

  // Per-node delegation glow tone (from any active edge touching the node).
  const nodeTones = useMemo(() => {
    const tones = new Map<string, DelegationTone>()
    for (const [key, state] of edgeLive) {
      if (!state.active) continue
      const [parentId, childId] = key.split('-')
      tones.set(parentId, state.color)
      tones.set(childId, state.color)
    }
    return tones
  }, [edgeLive])

  const { transform, handlers, zoomIn, zoomOut, fitToScreen, resetView } = useOrgChartPanZoom()

  const findDropTarget = useCallback(
    (canvasX: number, canvasY: number, draggedId: string): string | null => {
      for (const [id, p] of positions) {
        if (id === draggedId) continue
        if (canvasX >= p.x && canvasX <= p.x + NODE_W && canvasY >= p.y && canvasY <= p.y + NODE_H) {
          return id
        }
      }
      return null
    },
    [positions],
  )

  const canEdit = navMode === 'full'

  const handleDrop = useCallback(
    (agentId: string, newParentId: string | null, canvasX: number, canvasY: number) => {
      if (!canEdit) return
      const agent = agents[agentId]
      if (!agent) return

      if (newParentId) {
        // Reparent — guard cycles (cannot report to yourself or a descendant).
        if (newParentId === agentId) return
        const descendants = getDescendantIds(roots, agentId)
        if (descendants.has(newParentId)) {
          toast.error('Cannot move an agent under its own report')
          return
        }
        if (agent.orgChart?.parentId === newParentId) return
        const patches = computeOrgChartMove(agents, agentId, newParentId)
        // Clear any custom position so the moved node snaps into the tree layout.
        const first = patches[0]
        if (first?.patch.orgChart) {
          first.patch.orgChart = { ...first.patch.orgChart, x: null, y: null }
        }
        void batchUpdateAgents(patches).then(() => {
          const parent = agents[newParentId]
          toast.success(`${agent.name} now reports to ${parent?.name ?? 'new parent'}`)
        })
        return
      }

      // Dropped on empty canvas — persist a free position.
      void batchUpdateAgents([
        {
          id: agentId,
          patch: {
            orgChart: {
              ...agent.orgChart,
              x: Math.round(canvasX - NODE_W / 2),
              y: Math.round(canvasY - NODE_H / 2),
            },
          },
        },
      ])
    },
    [agents, roots, batchUpdateAgents, canEdit],
  )

  const { dragState, startDrag, moveDrag, endDrag } = useOrgChartDrag({
    transform,
    containerRef,
    onDrop: handleDrop,
    findDropTarget,
    onTap: setSelectedId,
  })

  // Effective positions during a drag (the dragged node follows the pointer).
  const livePositions = useMemo(() => {
    if (!dragState) return positions
    const pos = new Map(positions)
    pos.set(dragState.agentId, {
      x: dragState.currentX - NODE_W / 2,
      y: dragState.currentY - NODE_H / 2,
    })
    return pos
  }, [positions, dragState])

  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of positions.values()) {
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x + NODE_W)
      maxY = Math.max(maxY, p.y + NODE_H)
    }
    return positions.size > 0 ? { minX, minY, maxX, maxY } : null
  }, [positions])

  const fitView = useCallback(() => {
    const el = containerRef.current
    if (!el || !bounds) return
    fitToScreen(bounds, { width: el.clientWidth, height: el.clientHeight })
  }, [bounds, fitToScreen])

  useEffect(() => {
    if (!didFitRef.current && bounds) {
      didFitRef.current = true
      fitView()
    }
  }, [bounds, fitView])

  const dropInvalid = useMemo(() => {
    if (!dragState?.dropTargetId) return false
    return getDescendantIds(roots, dragState.agentId).has(dragState.dropTargetId)
      || dragState.dropTargetId === dragState.agentId
  }, [dragState, roots])

  const teamBoxes = useMemo(() =>
    teams
      .map((team) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        let count = 0
        for (const id of team.agentIds) {
          const p = livePositions.get(id)
          if (!p) continue
          count++
          minX = Math.min(minX, p.x)
          minY = Math.min(minY, p.y)
          maxX = Math.max(maxX, p.x + NODE_W)
          maxY = Math.max(maxY, p.y + NODE_H)
        }
        return count > 0 ? { ...team, minX, minY, maxX, maxY } : null
      })
      .filter((t): t is NonNullable<typeof t> => t !== null),
  [teams, livePositions])

  const agentCount = Object.keys(agents).length
  const selectedAgent: Agent | null = selectedId ? agents[selectedId] ?? null : null

  if (agentCount === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 ring-1 ring-primary/20 shadow-inner">
          <Network className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No org chart yet</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Create agents and drag them under coordinators to shape your delegation hierarchy.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate('/agents/roster')}>
            <Plus className="mr-2 h-4 w-4" /> Create an agent
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="relative h-full overflow-hidden">
      {/* Canvas */}
      <div
        ref={containerRef}
        className="h-full w-full cursor-grab active:cursor-grabbing touch-none"
        style={{
          backgroundImage: 'radial-gradient(hsl(var(--border)) 1px, transparent 1px)',
          backgroundSize: `${24 * transform.scale}px ${24 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
        }}
        onWheel={handlers.onWheel}
        onPointerDown={(e) => {
          handlers.onPointerDown(e)
          setSelectedId(null)
        }}
        onPointerMove={(e) => {
          moveDrag(e)
          handlers.onPointerMove(e)
        }}
        onPointerUp={(e) => {
          endDrag(e)
          handlers.onPointerUp(e)
        }}
      >
        <div
          className="relative origin-top-left"
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})` }}
        >
          {/* Team regions (behind everything) */}
          {teamBoxes.map((team) => (
            <OrgChartTeamRegion key={team.label} {...team} />
          ))}

          {/* Edges */}
          <svg className="absolute left-0 top-0 overflow-visible" width={1} height={1}>
            {edges.map(({ parentId, childId }) => {
              const from = livePositions.get(parentId)
              const to = livePositions.get(childId)
              if (!from || !to) return null
              return (
                <OrgChartEdge
                  key={`${parentId}-${childId}`}
                  x1={from.x + NODE_W / 2}
                  y1={from.y + NODE_H}
                  x2={to.x + NODE_W / 2}
                  y2={to.y}
                  live={edgeLive.get(`${parentId}-${childId}`) ?? null}
                />
              )
            })}
          </svg>

          {/* Unassigned row label */}
          {unattached.length > 0 && (
            <span
              className="absolute text-[10px] uppercase tracking-wide text-muted-foreground"
              style={{
                transform: `translate(0px, ${(livePositions.get(unattached[0].id)?.y ?? 0) - 20}px)`,
              }}
            >
              Unassigned — drag onto a coordinator
            </span>
          )}

          {/* Nodes */}
          {[...livePositions.entries()].map(([id, p]) => {
            const agent = agents[id]
            if (!agent) return null
            return (
              <OrgChartNode
                key={id}
                agent={agent}
                x={p.x}
                y={p.y}
                running={runningAgentIds.has(id)}
                selected={selectedId === id}
                dragging={dragState?.agentId === id}
                dropTarget={dragState?.dropTargetId === id}
                dropInvalid={dragState?.dropTargetId === id && dropInvalid}
                delegationTone={nodeTones.get(id) ?? null}
                onPointerDown={(e) => canEdit ? startDrag(e, id) : e.stopPropagation()}
                onClick={() => setSelectedId(id)}
                onDoubleClick={() => navigate(`/agents/chat/${id}`)}
              />
            )
          })}

          {/* Delegation bubbles above worker nodes */}
          {[...activeBubbles.entries()].map(([nodeId, bubble]) => {
            const p = livePositions.get(nodeId)
            if (!p) return null
            return <DelegationBubble key={`${nodeId}-${bubble.timestamp}`} bubble={bubble} x={p.x} y={p.y} />
          })}
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-xl border border-border/60 bg-card/95 p-1 shadow-md backdrop-blur-sm">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomIn} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={zoomOut} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fitView} title="Fit to screen">
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView} title="Reset view">
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      {/* Hint */}
      <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-border/60 bg-card/90 px-2.5 py-1.5 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm">
        Scroll to zoom · drag canvas to pan{canEdit ? ' · drag an agent onto another to change who it reports to' : ''}
      </div>

      <OrgChartDetailPanel
        agent={selectedAgent}
        running={selectedAgent ? runningAgentIds.has(selectedAgent.id) : false}
        lastDelegation={selectedAgent ? lastBubbles.get(selectedAgent.id) ?? null : null}
        onOpenChange={(open) => { if (!open) setSelectedId(null) }}
      />
    </div>
  )
}
