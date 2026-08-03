import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  loadAutomationSettings,
  saveAutomationSettings,
  type AutomationSettings,
} from '@/lib/automation-api'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { AutomationTabLayoutProps } from '@/lib/automation/automation-widget-layout'

interface SettingsPanelProps {
  layout: AutomationTabLayoutProps
}

export function SettingsPanel({ layout }: SettingsPanelProps) {
  const [settings, setSettings] = useState<AutomationSettings>(() => loadAutomationSettings())

  const handleSave = () => {
    const timeoutMs = Number(settings.timeoutMs)
    if (!Number.isFinite(timeoutMs) || timeoutMs < 3000) {
      toast.error('Timeout must be at least 3000 ms')
      return
    }
    saveAutomationSettings({
      viewport: settings.viewport.trim() || '1920x1080',
      timeoutMs: Math.min(timeoutMs, 60_000),
    })
    toast.success('Settings saved')
  }

  return (
    <div data-tour="automation-settings-panel">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'agent_support') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Agent Office support</CardTitle>
                  <CardDescription>
                    Automation does not host chat or model routing. It prepares knowledge and tools
                    for Automation Agent.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <p>
                    Document uploads are text-indexed in this workspace so agents can search them.
                    Web tools run HTTP fetch/screenshot/extract jobs from this module.
                  </p>
                  <p>
                    Conversations and provider/model selection live in{' '}
                    <Link to="/agents" className="font-medium text-foreground underline-offset-2 hover:underline">
                      Agent Office
                    </Link>
                    .
                  </p>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'browser_settings') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Browser Settings</CardTitle>
                  <CardDescription>
                    Configure Automation browser tools (stored in this browser)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <Label htmlFor="viewport">Viewport Size</Label>
                    <Input
                      id="viewport"
                      placeholder="1920x1080"
                      value={settings.viewport}
                      onChange={(e) => setSettings((s) => ({ ...s, viewport: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Used for screenshot width×crop height (e.g. 1280x900). Logged on each tool
                      run.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="timeout">Default Timeout (ms)</Label>
                    <Input
                      id="timeout"
                      type="number"
                      min={3000}
                      max={60000}
                      placeholder="30000"
                      value={settings.timeoutMs}
                      onChange={(e) =>
                        setSettings((s) => ({
                          ...s,
                          timeoutMs: Number(e.target.value) || s.timeoutMs,
                        }))
                      }
                    />
                  </div>
                  <Button className="w-full" onClick={handleSave}>
                    Save Settings
                  </Button>
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </div>
  )
}
