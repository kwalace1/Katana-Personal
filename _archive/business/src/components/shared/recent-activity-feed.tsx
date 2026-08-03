import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react'

export type FeedActivity = {
  type: 'success' | 'warning' | 'info'
  module: string
  message: string
  time: string
  sortAt: number
  href?: string
}

export type ActivityPeriod = 'today' | 'week' | 'month'
export type ActivityModuleFilter = 'all' | string

const COLLAPSED_COUNT = 3

const PERIOD_OPTIONS: ActivityPeriod[] = ['today', 'week', 'month']

const PERIOD_LABELS: Record<ActivityPeriod, string> = {
  today: 'Today',
  week: 'This week',
  month: 'This month',
}

function startOfTodayMs(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfWeekMs(): number {
  const d = new Date()
  const day = d.getDay()
  const daysFromMonday = day === 0 ? 6 : day - 1
  d.setDate(d.getDate() - daysFromMonday)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfMonthMs(): number {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function filterByPeriod(activities: FeedActivity[], period: ActivityPeriod): FeedActivity[] {
  const start =
    period === 'today' ? startOfTodayMs() : period === 'week' ? startOfWeekMs() : startOfMonthMs()
  return activities.filter((a) => a.sortAt >= start)
}

export function filterByModule(
  activities: FeedActivity[],
  moduleFilter: ActivityModuleFilter,
): FeedActivity[] {
  if (moduleFilter === 'all') return activities
  return activities.filter((a) => a.module === moduleFilter)
}

export function getActivityModules(activities: FeedActivity[]): string[] {
  return Array.from(new Set(activities.map((a) => a.module))).sort((a, b) => a.localeCompare(b))
}

function ActivityRow({ activity }: { activity: FeedActivity }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div
        className={cn(
          'p-2 rounded-lg shrink-0',
          activity.type === 'success' && 'bg-green-500/10 text-green-500',
          activity.type === 'warning' && 'bg-yellow-500/10 text-yellow-500',
          activity.type === 'info' && 'bg-blue-500/10 text-blue-500',
        )}
      >
        {activity.type === 'success' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : activity.type === 'warning' ? (
          <AlertCircle className="h-4 w-4" />
        ) : (
          <Activity className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge variant="outline" className="text-xs">
            {activity.module}
          </Badge>
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3 shrink-0" />
            {activity.time}
          </span>
        </div>
        <p className="text-sm text-foreground">
          {activity.href ? (
            <Link to={activity.href} className="hover:underline">
              {activity.message}
            </Link>
          ) : (
            activity.message
          )}
        </p>
      </div>
    </div>
  )
}

export type RecentActivityFeedProps = {
  activities: FeedActivity[]
  isLoading?: boolean
  emptyMessage?: string
  title?: string
  enableModuleFilter?: boolean
}

export function RecentActivityFeed({
  activities,
  isLoading = false,
  emptyMessage = 'No recent activity.',
  title = 'Recent Activity',
  enableModuleFilter = true,
}: RecentActivityFeedProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [period, setPeriod] = useState<ActivityPeriod>('week')
  const [moduleFilter, setModuleFilter] = useState<ActivityModuleFilter>('all')

  const collapsedActivities = useMemo(
    () => activities.slice(0, COLLAPSED_COUNT),
    [activities],
  )

  const periodActivities = useMemo(
    () => filterByPeriod(activities, period),
    [activities, period],
  )

  const modulesInPeriod = useMemo(
    () => getActivityModules(periodActivities),
    [periodActivities],
  )

  const moduleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const activity of periodActivities) {
      counts.set(activity.module, (counts.get(activity.module) ?? 0) + 1)
    }
    return counts
  }, [periodActivities])

  const filteredExpanded = useMemo(
    () => filterByModule(periodActivities, moduleFilter),
    [periodActivities, moduleFilter],
  )

  const periodCounts = useMemo(
    () => ({
      today: filterByPeriod(activities, 'today').length,
      week: filterByPeriod(activities, 'week').length,
      month: filterByPeriod(activities, 'month').length,
    }),
    [activities],
  )

  useEffect(() => {
    if (moduleFilter !== 'all' && !modulesInPeriod.includes(moduleFilter)) {
      setModuleFilter('all')
    }
  }, [moduleFilter, modulesInPeriod])

  const showModuleFilter = enableModuleFilter && modulesInPeriod.length > 1

  const expandedSummary = useMemo(() => {
    const periodLabel = PERIOD_LABELS[period].toLowerCase()
    if (moduleFilter === 'all') {
      return `Showing ${periodLabel} (${filteredExpanded.length})`
    }
    return `Showing ${periodLabel} · ${moduleFilter} (${filteredExpanded.length})`
  }, [period, moduleFilter, filteredExpanded.length])

  const emptyExpandedMessage = useMemo(() => {
    const periodLabel = PERIOD_LABELS[period].toLowerCase()
    if (periodActivities.length === 0) {
      return `No activity for ${periodLabel}.`
    }
    if (moduleFilter !== 'all') {
      return `No ${moduleFilter} activity for ${periodLabel}.`
    }
    return `No activity for ${periodLabel}.`
  }, [period, moduleFilter, periodActivities.length])

  const expandWithPeriod = (next: ActivityPeriod) => {
    setPeriod(next)
    setIsExpanded(true)
  }

  const collapse = () => setIsExpanded(false)

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-5 w-5 shrink-0 text-primary" />
              <span className="truncate">{title}</span>
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {isLoading
                ? 'Loading activity…'
                : isExpanded
                  ? expandedSummary
                  : `${Math.min(COLLAPSED_COUNT, activities.length)} most recent · expand to see more`}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <Badge variant="secondary" className="whitespace-nowrap text-xs font-normal">
              {activities.length} total
            </Badge>
            {!isLoading &&
              (isExpanded ? (
                <Button type="button" variant="outline" size="sm" className="h-8 shrink-0" onClick={collapse}>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Collapse
                </Button>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8 shrink-0">
                      Expand
                      <ChevronDown className="h-4 w-4 ml-1" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {PERIOD_OPTIONS.map((key) => (
                      <DropdownMenuItem
                        key={key}
                        className="cursor-pointer"
                        onSelect={() => expandWithPeriod(key)}
                      >
                        {PERIOD_LABELS[key]}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {periodCounts[key]}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ))}
          </div>
        </div>

        {isExpanded && !isLoading && (
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex flex-wrap gap-2">
              {PERIOD_OPTIONS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant={period === key ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setPeriod(key)}
                >
                  {PERIOD_LABELS[key]}
                  <span className="ml-1.5 text-xs opacity-80">({periodCounts[key]})</span>
                </Button>
              ))}
            </div>

            {showModuleFilter && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant={moduleFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  className="h-8"
                  onClick={() => setModuleFilter('all')}
                >
                  All modules
                  <span className="ml-1.5 text-xs opacity-80">({periodActivities.length})</span>
                </Button>
                {modulesInPeriod.map((moduleName) => (
                  <Button
                    key={moduleName}
                    type="button"
                    variant={moduleFilter === moduleName ? 'default' : 'outline'}
                    size="sm"
                    className="h-8"
                    onClick={() => setModuleFilter(moduleName)}
                  >
                    {moduleName}
                    <span className="ml-1.5 text-xs opacity-80">
                      ({moduleCounts.get(moduleName) ?? 0})
                    </span>
                  </Button>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      {!isExpanded && (
        <CardContent className="pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading activity…</p>
          ) : collapsedActivities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{emptyMessage}</p>
          ) : (
            <div className="space-y-3">
              {collapsedActivities.map((activity, index) => (
                <ActivityRow
                  key={`${activity.sortAt}-${activity.module}-${index}`}
                  activity={activity}
                />
              ))}
            </div>
          )}
        </CardContent>
      )}

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {isLoading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading activity…</p>
            ) : filteredExpanded.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">{emptyExpandedMessage}</p>
            ) : (
              <div className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
                {filteredExpanded.map((activity, index) => (
                  <ActivityRow
                    key={`${activity.sortAt}-${activity.module}-${index}`}
                    activity={activity}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  )
}
