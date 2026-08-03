import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { formatDateOnly } from '@/lib/due-date-utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LoadingState } from '@/components/ui/loading-state'
import {
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  Pause,
  Play,
  Square,
} from 'lucide-react'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import { getWfmStatusColor } from '@/lib/wfm-job-utils'
import {
  getMyWorkItems,
  getWorkerHoursThisWeek,
  getWorkerSession,
  isWorkItemDueToday,
  isWorkItemOverdue,
  resolveTechnicianForEmployee,
  workerClockIn,
  workerClockOut,
  workerCompleteJob,
  workerHoldJob,
  workerStartJob,
  type WfmMyWorkItem,
  type WfmWorkerSession,
} from '@/lib/wfm-worker'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { WfmStatCard } from '@/components/workforce/WfmStatCard'
import type { Technician } from '@/lib/wfm-api'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { EmployeeTabLayoutProps } from '@/lib/employee/employee-widget-layout'

interface WfmMyWorkPanelProps {
  terms: WfmTerminology
  employeeId: string
  employeeEmail?: string | null
  employeeName?: string | null
  showManagerLink?: boolean
  /** When the parent already resolved the roster entry, skip re-resolution. */
  initialTechnician?: Technician | null
  layout?: EmployeeTabLayoutProps
  headerActions?: ReactNode
}

function displayStatus(status: WfmMyWorkItem['status']): string {
  if (status === 'in-progress') return 'In Progress'
  if (status === 'on-hold') return 'On Hold'
  if (status === 'assigned') return 'Assigned'
  return status
}

export function WfmMyWorkPanel({
  terms,
  employeeId,
  employeeEmail,
  employeeName,
  showManagerLink = true,
  initialTechnician,
  layout,
  headerActions,
}: WfmMyWorkPanelProps) {
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const highlightJobId = searchParams.get('job')

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<WfmWorkerSession | null>(null)
  const [items, setItems] = useState<WfmMyWorkItem[]>([])
  const [hoursWeek, setHoursWeek] = useState(0)
  const [acting, setActing] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      let tech = initialTechnician ?? null
      if (!tech && employeeId) {
        tech = await resolveTechnicianForEmployee({
          employeeId,
          email: employeeEmail,
          name: employeeName,
        })
      }
      if (!tech && !employeeId) {
        tech = await resolveTechnicianForEmployee({
          employeeId: '',
          email: employeeEmail,
          name: employeeName,
        })
      }
      if (!tech) {
        setSession(null)
        setItems([])
        setHoursWeek(0)
        return
      }
      const [workItems, workerSession, weekHours] = await Promise.all([
        getMyWorkItems(tech.id),
        getWorkerSession(tech.id),
        getWorkerHoursThisWeek(tech.id),
      ])
      setSession(workerSession)
      setItems(workItems)
      setHoursWeek(weekHours)
    } catch (e) {
      console.error('WfmMyWorkPanel load failed:', e)
    } finally {
      setLoading(false)
    }
  }, [employeeId, employeeEmail, employeeName, initialTechnician])

  useEffect(() => {
    void reload()
  }, [reload])

  const dueToday = useMemo(() => items.filter((i) => isWorkItemDueToday(i)), [items])
  const overdue = useMemo(() => items.filter((i) => isWorkItemOverdue(i)), [items])
  const activeJobId = session?.activeJobId ?? null
  const isClockedIn = Boolean(session?.openTimesheet)

  const runAction = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setActing(key)
    try {
      const result = await fn()
      if (result.ok) {
        await reload()
        if (result.error) {
          toast({ title: 'Done with note', description: result.error })
        }
      } else {
        toast({ title: 'Action failed', description: result.error ?? 'Try again', variant: 'destructive' })
      }
    } finally {
      setActing(null)
    }
  }

  if (loading) {
    return <LoadingState message={`Loading ${terms.workItemPlural.toLowerCase()}…`} />
  }

  if (!session) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My work</CardTitle>
          <CardDescription>
            Your account is not linked to the workforce roster yet. Ask a manager to sync Team from HR
            in Workforce, or match your email on a roster entry.
          </CardDescription>
        </CardHeader>
        {showManagerLink && (
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/workforce?tab=team">Open Workforce team →</Link>
            </Button>
          </CardContent>
        )}
      </Card>
    )
  }

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My work</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {terms.workItemPlural} assigned to {session.technician.name}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {headerActions}
        {showManagerLink && (
          <Button variant="ghost" size="sm" asChild>
            <Link to="/workforce?tab=today">
              <ExternalLink className="h-4 w-4 mr-2" />
              Manager view
            </Link>
          </Button>
        )}
      </div>
    </div>
  )

  const workStats = (
    <div className="h-full grid grid-cols-2 sm:grid-cols-4 gap-3">
      <WfmStatCard label="Due today" value={dueToday.length} icon={Briefcase} accent="primary" />
      <WfmStatCard
        label="Overdue"
        value={overdue.length}
        icon={AlertCircle}
        accent={overdue.length > 0 ? 'danger' : 'default'}
      />
      <WfmStatCard label="Open" value={items.length} icon={Briefcase} accent="blue" />
      <WfmStatCard label="Hours this week" value={hoursWeek.toFixed(1)} icon={Clock} />
    </div>
  )

  const workQueue =
    items.length === 0 ? (
      <Card className="h-full overflow-hidden">
        <CardContent className="py-10 text-center text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p>No open {terms.workItemPlural.toLowerCase()} right now.</p>
          {overdue.length > 0 && (
            <p className="text-xs mt-3 flex items-center justify-center gap-1">
              <AlertCircle className="h-3 w-3" />
              {overdue.length} overdue {terms.workItemPlural.toLowerCase()} — complete or ask your
              manager to reschedule.
            </p>
          )}
        </CardContent>
      </Card>
    ) : (
      <div className="h-full space-y-3">
        {items.map((item) => {
          const highlighted = highlightJobId === item.id
          const isActive = activeJobId === item.id
          const overdueItem = isWorkItemOverdue(item)
          return (
            <Card
              key={item.id}
              className={cn(
                'overflow-hidden',
                highlighted && 'ring-2 ring-primary',
                isActive && 'border-primary/40 bg-primary/5',
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-snug">{item.title}</CardTitle>
                    <CardDescription className="text-xs mt-1">
                      {item.jobNumber}
                      {item.startDate ? ` · ${formatDateOnly(item.startDate)}` : ''}
                      {item.endDate ? ` – ${formatDateOnly(item.endDate)}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={getWfmStatusColor(displayStatus(item.status))}>
                      {displayStatus(item.status)}
                    </Badge>
                    {overdueItem && (
                      <Badge variant="destructive" className="text-xs">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.customerName && (
                  <p className="text-sm text-muted-foreground">{item.customerName}</p>
                )}
                {terms.emphasizeLocation && item.locationAddress && (
                  <p className="text-sm flex items-start gap-2">
                    <MapPin className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    {item.locationAddress}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {item.status !== 'in-progress' && item.status !== 'completed' && (
                    <Button
                      size="lg"
                      className="flex-1 min-w-[120px] h-11"
                      disabled={acting !== null}
                      onClick={() =>
                        void runAction(`start-${item.id}`, () =>
                          workerStartJob(session.technician.id, item.id),
                        )
                      }
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {acting === `start-${item.id}` ? 'Starting…' : 'Start'}
                    </Button>
                  )}
                  {item.status === 'in-progress' && (
                    <Button
                      size="lg"
                      className="flex-1 min-w-[120px] h-11"
                      disabled={acting !== null}
                      onClick={() =>
                        void runAction(`complete-${item.id}`, () =>
                          workerCompleteJob(session.technician.id, item.id),
                        )
                      }
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      {acting === `complete-${item.id}` ? 'Saving…' : 'Complete'}
                    </Button>
                  )}
                  {item.status === 'in-progress' && (
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-11"
                      disabled={acting !== null}
                      onClick={() =>
                        void runAction(`hold-${item.id}`, () => workerHoldJob(item.id))
                      }
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      Hold
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
        {overdue.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <AlertCircle className="h-3 w-3" />
            {overdue.length} overdue {terms.workItemPlural.toLowerCase()} — complete or ask your
            manager to reschedule.
          </p>
        )}
      </div>
    )

  const clockBar = (
    <Card className="h-full overflow-hidden">
      <CardContent className="h-full py-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className={cn(
              'rounded-full p-2',
              isClockedIn ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground',
            )}
          >
            <Clock className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">{isClockedIn ? 'Clocked in' : 'Not clocked in'}</p>
            <p className="text-xs text-muted-foreground truncate">
              {isClockedIn && session.openTimesheet
                ? `Since ${new Date(session.openTimesheet.clock_in).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
                : 'Tap to log time'}
            </p>
          </div>
        </div>
        {isClockedIn ? (
          <Button
            size="lg"
            variant="outline"
            className="h-12 shrink-0"
            disabled={acting !== null}
            onClick={() =>
              void runAction('clock-out', () => workerClockOut(session.technician.id))
            }
          >
            <Square className="h-4 w-4 mr-2" />
            Clock out
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-12 shrink-0"
            disabled={acting !== null}
            onClick={() =>
              void runAction('clock-in', () => workerClockIn(session.technician.id))
            }
          >
            <Clock className="h-4 w-4 mr-2" />
            Clock in
          </Button>
        )}
      </CardContent>
    </Card>
  )

  if (layout) {
    return (
      <div className="space-y-4" data-tour="launchpad-my-work">
        {header}
        <ModuleWidgetCanvas
          widgets={layout.widgets}
          catalog={layout.catalog}
          customizeMode={layout.customizeMode}
          onLayoutChange={layout.onLayoutChange}
          onRemoveWidget={layout.onRemoveWidget}
          rowHeight={36}
          renderWidget={(widgetId) => {
            if (widgetId === 'work_stats') return workStats
            if (widgetId === 'work_queue') return workQueue
            if (widgetId === 'clock_bar') return clockBar
            return null
          }}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-6" data-tour="launchpad-my-work">
      {header}
      {workStats}
      {workQueue}
      {clockBar}
    </div>
  )
}
