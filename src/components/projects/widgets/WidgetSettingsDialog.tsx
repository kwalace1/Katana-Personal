import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { WidgetLayoutItem } from "@/hooks/useWidgetLayout"
import { RotateCcw, Eye, EyeOff } from "lucide-react"

interface WidgetSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  layout: WidgetLayoutItem[]
  onToggleWidget: (id: string) => void
  onReset: () => void
}

export function WidgetSettingsDialog({
  open,
  onOpenChange,
  layout,
  onToggleWidget,
  onReset,
}: WidgetSettingsDialogProps) {
  const getWidgetLabel = (type: string) => {
    // Custom labels for special sections
    const customLabels: Record<string, string> = {
      'MetricsSection': 'Dashboard Metrics (Total Projects, Deadlines, Team)',
      'ProjectsTabs': 'Projects Grid/List View',
      'RecentActivityWidget': 'Recent Activity Feed',
      // Analytics widgets
      'KeyMetricsOverview': 'Key Metrics Overview',
      'ClientHealthDistribution': 'Client Health Distribution',
      'RevenueAnalytics': 'Revenue Analytics',
      'InteractionActivity': 'Interaction Activity',
      'TaskPerformance': 'Task Performance',
      'HealthScoreTrends': 'Client Health Score Trends',
      'ARRGrowthTrend': 'ARR Growth Trend',
      'TopClientsARR': 'Top Clients by ARR',
      'CSMPerformance': 'CSM Performance',
      'UpcomingMilestones': 'Milestone Progress',
      // Z-MO Analytics widgets
      'AnalyticsKPIs': 'Analytics KPIs',
      'ProductionEfficiencyTrends': 'Production Efficiency Trends',
      'MachinePerformanceBreakdown': 'Machine Performance Breakdown',
      'KeyPerformanceIndicators': 'Key Performance Indicators',
      'DataExportOptions': 'Data Export Options',
    }
    
    if (customLabels[type]) {
      return customLabels[type]
    }
    
    return type
      .replace(/Widget$/, '')
      .replace(/([A-Z])/g, ' $1')
      .trim()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Widget Settings</DialogTitle>
          <DialogDescription>
            Customize which widgets are displayed on your dashboard. Drag widgets to rearrange them in edit mode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-3">
            {layout.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {item.visible ? (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Label htmlFor={item.id} className="cursor-pointer">
                    {getWidgetLabel(item.type)}
                  </Label>
                </div>
                <Switch
                  id={item.id}
                  checked={item.visible}
                  onCheckedChange={() => onToggleWidget(item.id)}
                />
              </div>
            ))}
          </div>

          <div className="pt-4 border-t">
            <Button
              variant="outline"
              className="w-full"
              onClick={onReset}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default Layout
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

