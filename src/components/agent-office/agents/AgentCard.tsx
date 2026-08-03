import { motion } from 'framer-motion'
import { MessageSquare, MoreHorizontal, Pencil, Pin, Trash2, Copy } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Agent } from '@/lib/office/types'
import { AgentAvatar } from '../chat/AgentAvatar'

export function AgentCard({
  agent,
  running,
  onOpenChat,
  onEdit,
  onDuplicate,
  onDelete,
  onTogglePin,
}: {
  agent: Agent
  running: boolean
  onOpenChat: () => void
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
  onTogglePin: () => void
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="group relative flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        <div className="relative">
          <AgentAvatar agent={agent} size="lg" />
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card',
              running ? 'bg-success animate-pulse' : 'bg-muted-foreground/40',
            )}
            title={running ? 'Running' : 'Idle'}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
            {agent.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
            {agent.role === 'coordinator' && (
              <Badge variant="outline" className="h-4 shrink-0 px-1 text-[9px] uppercase tracking-wide">
                Coordinator
              </Badge>
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground min-h-[2rem]">
            {agent.description || 'No description'}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onOpenChat}>
              <MessageSquare className="mr-2 h-4 w-4" /> Open chat
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onTogglePin}>
              <Pin className="mr-2 h-4 w-4" /> {agent.pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" /> Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-auto flex items-center gap-2">
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-normal">
          {agent.provider}
        </Badge>
        <Badge variant="outline" className="h-5 max-w-[10rem] truncate px-1.5 text-[10px] font-normal">
          {agent.model}
        </Badge>
        {(agent.delegationTargetAgentIds?.length ?? 0) > 0 && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            delegates to {agent.delegationTargetAgentIds!.length}
          </span>
        )}
      </div>

      <Button variant="outline" size="sm" className="w-full" onClick={onOpenChat}>
        <MessageSquare className="mr-2 h-3.5 w-3.5" />
        Chat
      </Button>
    </motion.div>
  )
}
