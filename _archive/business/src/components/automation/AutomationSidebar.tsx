import {
  BarChart3,
  Bot,
  FolderOpen,
  MessageSquare,
  Settings,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AutomationTab } from './types'

interface AutomationSidebarProps {
  activeTab: AutomationTab
  onSelectTab: (tab: AutomationTab) => void
}

const MODULE_NAV: { tab: AutomationTab; label: string; icon: typeof Bot; tour?: string }[] = [
  { tab: 'dashboard', label: 'Dashboard', icon: BarChart3 },
  { tab: 'agent', label: 'Ask Agent', icon: MessageSquare, tour: 'automation-ask-agent' },
  { tab: 'documents', label: 'Documents', icon: FolderOpen, tour: 'automation-documents' },
  { tab: 'automation', label: 'Web tools', icon: Zap, tour: 'automation-tools' },
  { tab: 'analytics', label: 'Analytics', icon: BarChart3 },
  { tab: 'settings', label: 'Settings', icon: Settings },
]

export function AutomationSidebar({ activeTab, onSelectTab }: AutomationSidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col overflow-hidden border-r border-border bg-card/50">
      <div className="flex shrink-0 items-center gap-2 px-4 py-4" data-tour="automation-sidebar-header">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Automation</p>
          <p className="truncate text-xs text-muted-foreground">Knowledge and tools for agents</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col space-y-0.5 p-3" aria-label="Automation sections">
        <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Workspace
        </p>
        {MODULE_NAV.map(({ tab, label, icon: Icon, tour }) => (
          <Button
            key={tab}
            variant={activeTab === tab ? 'secondary' : 'ghost'}
            size="sm"
            className={cn('h-9 w-full justify-start gap-2 text-sm font-normal')}
            data-tour={tour}
            onClick={() => onSelectTab(tab)}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        ))}
      </nav>
    </aside>
  )
}
