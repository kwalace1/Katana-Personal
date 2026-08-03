import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MotionPage } from '@/components/motion-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Bot,
  PanelLeftOpen,
  PanelLeftClose,
  ArrowRight,
  Upload,
  Play,
} from 'lucide-react'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { AutomationSidebar } from '@/components/automation/AutomationSidebar'
import { DashboardPanel } from '@/components/automation/DashboardPanel'
import { DocumentsPanel } from '@/components/automation/DocumentsPanel'
import { BrowserToolsPanel } from '@/components/automation/BrowserToolsPanel'
import { AnalyticsPanel } from '@/components/automation/AnalyticsPanel'
import { SettingsPanel } from '@/components/automation/SettingsPanel'
import type { AutomationTab } from '@/components/automation/types'
import {
  getAutomationDashboardStats,
  type AutomationDashboardStats,
} from '@/lib/automation-api'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  AUTOMATION_MODULE_ID,
  AUTOMATION_TAB_SURFACE_REGISTRY,
  getAutomationTabSurfaceConfig,
  type AutomationTabLayoutProps,
} from '@/lib/automation/automation-widget-layout'

const TAB_TITLES: Record<AutomationTab, string> = {
  dashboard: 'Dashboard',
  agent: 'Ask Agent',
  documents: 'Documents',
  automation: 'Web tools',
  analytics: 'Analytics',
  settings: 'Settings',
}

const AUTOMATION_AGENT_STATE = {
  agentName: 'Automation Agent',
  moduleLabel: 'Automation',
}

export default function AutomationPage() {
  useModuleTour('automation')
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<AutomationTab>('documents')
  const [showSidebar, setShowSidebar] = useState(true)
  const [stats, setStats] = useState<AutomationDashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  const canCustomize = activeTab !== 'agent'
  const surfaceConfig =
    getAutomationTabSurfaceConfig(activeTab) ?? AUTOMATION_TAB_SURFACE_REGISTRY.documents

  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: AUTOMATION_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })

  const tabLayout: AutomationTabLayoutProps = useMemo(
    () => ({
      widgets: layout.widgets,
      catalog: surfaceConfig.catalog,
      customizeMode: canCustomize && isCustomizeMode,
      onLayoutChange,
      onRemoveWidget: removeWidget,
    }),
    [
      layout.widgets,
      surfaceConfig.catalog,
      canCustomize,
      isCustomizeMode,
      onLayoutChange,
      removeWidget,
    ]
  )

  const refreshStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const next = await getAutomationDashboardStats()
      setStats(next)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshStats()
  }, [refreshStats])

  useEffect(() => {
    if (activeTab === 'dashboard' || activeTab === 'analytics') {
      void refreshStats()
    }
  }, [activeTab, refreshStats])

  const openAutomationAgent = () => {
    navigate('/agents/chat', {
      state: {
        ...AUTOMATION_AGENT_STATE,
        fromPath: '/automation',
      },
    })
  }

  const customizeChrome =
    canCustomize && isCustomizeMode ? (
      <div className="mb-4 space-y-3">
        <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
        <div className="flex flex-wrap items-center gap-2">
          <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
          <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
            Reset layout
          </Button>
        </div>
      </div>
    ) : null

  return (
    <MotionPage
      subtle
      className="flex h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)] overflow-hidden"
    >
      <AnimatePresence initial={false}>
        {showSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'auto', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="h-full shrink-0 overflow-hidden"
          >
            <AutomationSidebar activeTab={activeTab} onSelectTab={setActiveTab} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className="flex shrink-0 items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-sm"
          data-tour="automation-header"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => setShowSidebar((s) => !s)}
              aria-label={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-semibold">{TAB_TITLES[activeTab]}</h1>
                <ModuleHelpButton moduleId="automation" />
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Knowledge and tools that power Agent Office
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-2">
            {canCustomize && (
              <ModuleCustomizeControls
                customizeMode={isCustomizeMode}
                onEnterCustomize={enterCustomize}
                onDone={() => void saveAndExit()}
                dataTourCustomize="automation-customize"
              />
            )}
            <Button variant="outline" size="sm" onClick={() => setActiveTab('documents')}>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => setActiveTab('automation')}>
              <Play className="mr-2 h-4 w-4" />
              Run Task
            </Button>
            <Button size="sm" onClick={openAutomationAgent}>
              <Bot className="mr-2 h-4 w-4" />
              Ask Agent
            </Button>
          </div>
        </header>

        {/* h-0 + flex-1 forces a bounded height so overflow-y-auto can scroll */}
        <div className="h-0 min-h-0 flex-1 basis-0 overflow-y-auto overflow-x-hidden">
          <div className="w-full p-6 pb-16">
            {customizeChrome}

            {activeTab === 'agent' && (
              <div className="mx-auto max-w-4xl">
                <Card data-tour="automation-ask-agent-panel">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      Talk to Automation Agent
                    </CardTitle>
                    <CardDescription>
                      Conversation lives in Agent Office. Use this workspace to load documents and
                      configure tools the Automation Agent can use.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Ask about workflows, document knowledge, and browser automation. Agents are
                      the only AI chat in Katana — this module supports them.
                    </p>
                    <Button onClick={openAutomationAgent} data-tour="automation-open-agent">
                      Open Automation Agent
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <DashboardPanel
                stats={stats}
                loading={statsLoading}
                onSelectTab={setActiveTab}
                onOpenAgent={openAutomationAgent}
                layout={tabLayout}
              />
            )}

            {activeTab === 'documents' && (
              <DocumentsPanel
                onChanged={refreshStats}
                onOpenAgent={openAutomationAgent}
                layout={tabLayout}
              />
            )}

            {activeTab === 'automation' && (
              <BrowserToolsPanel
                onChanged={refreshStats}
                onOpenAgent={openAutomationAgent}
                layout={tabLayout}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsPanel stats={stats} loading={statsLoading} layout={tabLayout} />
            )}

            {activeTab === 'settings' && <SettingsPanel layout={tabLayout} />}
          </div>
        </div>
      </div>
    </MotionPage>
  )
}
