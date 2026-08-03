import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  MessageSquare,
  Play,
  Star,
  Target,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { MessageContent } from '@/components/comms/MessageContent'
import { FeedItemIcon } from '@/components/employee/FeedItemIcon'
import type {
  EmployeeFeedQuickView,
  EmployeeFeedStatusTone,
  EmployeePortalFeedItem,
} from '@/lib/employee-portal-feed'
import { resolveFeedQuickViewLayout } from '@/lib/employee-portal-feed'
import { useEffect, useRef } from 'react'
import { useEmployeePortalComms } from '@/contexts/EmployeePortalCommsContext'
import { useNotifications } from '@/contexts/NotificationContext'
import { engageFeedItem } from '@/lib/employee-portal-feed-engagement'

interface EmployeePortalFeedQuickViewProps {
  item: EmployeePortalFeedItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDismissSynthetic?: (feedItemId: string) => void
  onMarkSeen?: (feedItemId: string) => void
}

function goalStatusClass(status?: string): string {
  const lower = (status || '').toLowerCase()
  if (lower.includes('complete')) return 'border-blue-500 text-blue-600 bg-blue-500/20'
  if (lower.includes('behind')) return 'border-red-500 text-red-600 bg-red-500/20'
  if (lower.includes('on track')) return 'border-green-500 text-green-600 bg-green-500/20'
  return 'border-yellow-500 text-yellow-600 bg-yellow-500/20'
}

function categoryBadgeClass(category?: string): string {
  const lower = (category || '').toLowerCase()
  if (lower === 'team') return 'border-blue-500 text-blue-600 bg-blue-500/10'
  if (lower === 'company') return 'border-green-500 text-green-600 bg-green-500/10'
  return 'border-purple-500 text-purple-600 bg-purple-500/10'
}

function statusBadgeClass(tone?: EmployeeFeedStatusTone): string {
  switch (tone) {
    case 'success':
      return 'border-green-500 text-green-600 bg-green-500/20'
    case 'warning':
      return 'border-yellow-500 text-yellow-600 bg-yellow-500/20'
    case 'danger':
      return 'border-red-500 text-red-600 bg-red-500/20'
    case 'info':
      return 'border-blue-500 text-blue-600 bg-blue-500/20'
    default:
      return ''
  }
}

function taskStatusClass(status?: string): string {
  const lower = (status || '').toLowerCase()
  if (lower.includes('done') || lower.includes('complete')) {
    return 'border-green-500 text-green-600 bg-green-500/10'
  }
  if (lower.includes('progress') || lower.includes('doing')) {
    return 'border-blue-500 text-blue-600 bg-blue-500/10'
  }
  if (lower.includes('block')) {
    return 'border-red-500 text-red-600 bg-red-500/10'
  }
  return ''
}

function initials(name?: string): string {
  return (name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function ModulePreviewShell({
  item,
  children,
}: {
  item: EmployeePortalFeedItem
  children: ReactNode
}) {
  return (
    <div className="employee-portal-muted-panel rounded-xl border p-0 overflow-hidden">
      <div className="flex items-center gap-3 border-b border-border/60 bg-background/60 px-4 py-3">
        <FeedItemIcon kind={item.iconKind} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {item.meta ?? 'Preview'}
          </p>
          <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        </div>
        {item.urgencyLabel && (
          <Badge variant="secondary" className="text-xs shrink-0">
            {item.urgencyLabel}
          </Badge>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function GoalPreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  const title = qv.summary ?? item.subtitle ?? item.title
  return (
    <Card className="border shadow-sm hover:border-primary/40 transition-all">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <CardTitle className="text-base">{title}</CardTitle>
          {qv.categoryLabel && (
            <Badge variant="outline" className={categoryBadgeClass(qv.categoryLabel)}>
              {qv.categoryLabel}
            </Badge>
          )}
          {qv.statusLabel && (
            <Badge variant="outline" className={goalStatusClass(qv.statusLabel)}>
              {qv.statusLabel}
            </Badge>
          )}
        </div>
        {qv.body && <CardDescription>{qv.body}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {qv.progress != null && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Progress</span>
              <span className="text-sm font-bold">{qv.progress}%</span>
            </div>
            <Progress value={qv.progress} className="h-2" />
          </div>
        )}
        {qv.progress != null && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Progress</span>
                <span className="text-xs font-medium">{qv.progress}/100 %</span>
              </div>
              <Progress value={qv.progress} className="h-1" />
            </div>
          </div>
        )}
        {(qv.dueDate || qv.lastUpdated) && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
            <div className="flex items-center gap-4 flex-wrap">
              {qv.dueDate && qv.dueDate !== '—' && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  Due {qv.dueDate}
                </span>
              )}
              {qv.lastUpdated && <span>Last updated {qv.lastUpdated}</span>}
            </div>
            <Button variant="ghost" size="sm" className="h-7 pointer-events-none" tabIndex={-1}>
              View Details
              <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrainingPreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  const completed = qv.statusLabel?.toLowerCase().includes('completed')
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {qv.summary ?? item.title}
              {qv.statusLabel && (
                <Badge variant={completed ? 'default' : 'outline'}>{qv.statusLabel}</Badge>
              )}
              {qv.priorityLabel && <Badge variant="destructive">{qv.priorityLabel}</Badge>}
            </CardTitle>
            {qv.contextLabel && <CardDescription>{qv.contextLabel}</CardDescription>}
            {qv.body && (
              <p className="text-sm text-muted-foreground mt-2 italic border-l-2 pl-3">{qv.body}</p>
            )}
          </div>
          {!completed && (
            <Button size="sm" variant="secondary" className="shrink-0 pointer-events-none" tabIndex={-1}>
              Continue
              <Play className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!completed && qv.progress != null && (
          <>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <span className="text-sm font-bold">{qv.progress}%</span>
            </div>
            <Progress value={qv.progress} className="h-2 mb-2" />
          </>
        )}
        {completed ? (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            Completed{qv.completedDate ? ` on ${qv.completedDate}` : ''}
          </div>
        ) : (
          qv.dueDate &&
          qv.dueDate !== '—' && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              Due {qv.dueDate}
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}

function ProjectPreview({ qv }: { qv: EmployeeFeedQuickView }) {
  const tasks = qv.tasks ?? []
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          {qv.summary ?? 'Project tasks'}
        </CardTitle>
        <CardDescription>Open tasks assigned to you</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks.</p>
        ) : (
          tasks.map((task, i) => (
            <div
              key={`${task.title}-${i}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-border/70 bg-background/80 px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                {task.deadline && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {task.deadline}
                  </p>
                )}
              </div>
              {task.status && (
                <Badge variant="outline" className={`text-xs shrink-0 ${taskStatusClass(task.status)}`}>
                  {task.status}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}

function MessagePreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  const senderName = qv.fromName ?? 'Someone'
  const timeLabel =
    qv.timestamp ??
    item.quickView.details.find((d) => d.label === 'When')?.value ??
    item.time

  return (
    <div className="rounded-xl border border-border/70 bg-gradient-to-b from-muted/30 to-background overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 text-xs text-muted-foreground bg-background/50">
        <MessageSquare className="w-3.5 h-3.5" />
        <span>{qv.contextLabel ?? 'Direct message'}</span>
      </div>
      <div className="px-2 py-3">
        <div className="flex gap-3 py-1.5 px-3 comms-message-hover rounded-xl">
          <Avatar className="w-9 h-9 shrink-0 mt-0.5 ring-2 ring-background shadow-sm">
            <AvatarFallback className="text-xs bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-medium">
              {initials(senderName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 mb-0.5">
              <span className="text-sm font-semibold text-foreground">{senderName}</span>
              {timeLabel && <span className="text-xs text-muted-foreground">{timeLabel}</span>}
            </div>
            {qv.body ? (
              <MessageContent content={qv.body} />
            ) : (
              <p className="text-sm text-muted-foreground italic">No message content</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function RecognitionPreview({ qv }: { qv: EmployeeFeedQuickView }) {
  return (
    <div className="p-4 rounded-lg border border-border/40 bg-muted/20">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
          {initials(qv.fromName)}
        </div>
        <div>
          <p className="font-medium text-sm">{qv.fromName ?? 'Someone'}</p>
          {qv.timestamp && <p className="text-xs text-muted-foreground">{qv.timestamp}</p>}
        </div>
        {qv.statusLabel && (
          <Badge variant="outline" className="text-xs ml-auto shrink-0">
            {qv.statusLabel}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {qv.body ?? qv.summary}
      </p>
    </div>
  )
}

function PerformancePreview({ qv }: { qv: EmployeeFeedQuickView }) {
  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-base">Performance Review</CardTitle>
          <Badge variant="outline" className={statusBadgeClass(qv.statusTone)}>
            {qv.statusLabel ?? 'Scheduled'}
          </Badge>
        </div>
        {qv.dueDate && qv.dueDate !== '—' && (
          <CardDescription className="flex items-center gap-2 mt-2">
            <Calendar className="w-4 h-4" />
            {qv.dueDate}
          </CardDescription>
        )}
      </CardHeader>
      {qv.summary && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{qv.summary}</p>
        </CardContent>
      )}
    </Card>
  )
}

function NoticePreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  const high = qv.statusTone === 'danger'
  return (
    <div
      className={`rounded-lg border p-4 ${
        high ? 'border-destructive/40 bg-destructive/5' : 'employee-portal-muted-panel'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-sm text-foreground">{item.title}</p>
        {qv.statusLabel && (
          <Badge variant={high ? 'destructive' : 'outline'} className="text-xs shrink-0">
            {qv.statusLabel}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{qv.body ?? qv.summary}</p>
      {item.time && <p className="text-xs text-muted-foreground mt-3">{item.time}</p>}
    </div>
  )
}

function TimeOffPreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  const variant =
    qv.statusLabel === 'Approved'
      ? 'default'
      : qv.statusLabel === 'Denied'
        ? 'destructive'
        : 'secondary'
  return (
    <div className="employee-portal-muted-panel rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-medium text-sm text-foreground">{item.title}</p>
        {qv.statusLabel && (
          <Badge variant={variant} className="text-xs shrink-0">
            {qv.statusLabel}
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground whitespace-pre-wrap">{qv.body ?? qv.summary}</p>
      {qv.dueDate && (
        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
          <Calendar className="w-3 h-3" />
          {qv.dueDate}
        </p>
      )}
    </div>
  )
}

function ActivityPreview({ qv }: { qv: EmployeeFeedQuickView }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/80 p-4 space-y-2">
      <p className="text-sm text-foreground leading-relaxed">{qv.body ?? qv.summary}</p>
      <div className="flex flex-wrap gap-2 pt-1">
        {qv.fromName && (
          <Badge variant="outline" className="text-xs">
            By {qv.fromName}
          </Badge>
        )}
        {qv.statusLabel && (
          <Badge variant="secondary" className="text-xs">
            {qv.statusLabel}
          </Badge>
        )}
      </div>
    </div>
  )
}

function AchievementPreview({ item, qv }: { item: EmployeePortalFeedItem; qv: EmployeeFeedQuickView }) {
  return (
    <Card className="border shadow-sm border-yellow-500/20 bg-yellow-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          {item.title}
        </CardTitle>
        {item.subtitle && <CardDescription>{item.subtitle}</CardDescription>}
      </CardHeader>
      {qv.summary && (
        <CardContent>
          <p className="text-sm text-muted-foreground">{qv.summary}</p>
        </CardContent>
      )}
    </Card>
  )
}

function GenericPreview({ qv }: { qv: EmployeeFeedQuickView }) {
  return (
    <div className="space-y-3">
      {qv.summary && (
        <p className="text-sm text-foreground whitespace-pre-wrap">{qv.summary}</p>
      )}
      {qv.details.length > 0 && (
        <dl className="rounded-lg border border-border/60 bg-muted/30 divide-y divide-border/60">
          {qv.details.map((row) => (
            <div key={`${row.label}-${row.value}`} className="flex gap-3 px-3 py-2 text-sm">
              <dt className="shrink-0 w-28 text-muted-foreground">{row.label}</dt>
              <dd className="flex-1 text-foreground break-words">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function QuickViewBody({ item }: { item: EmployeePortalFeedItem }) {
  const qv = item.quickView
  const layout = resolveFeedQuickViewLayout(item)

  const preview = (() => {
    switch (layout) {
      case 'goal':
        return <GoalPreview item={item} qv={qv} />
      case 'training':
        return <TrainingPreview item={item} qv={qv} />
      case 'project':
        return <ProjectPreview qv={qv} />
      case 'message':
        return <MessagePreview item={item} qv={qv} />
      case 'recognition':
        return <RecognitionPreview qv={qv} />
      case 'performance':
        return <PerformancePreview qv={qv} />
      case 'notice':
        return <NoticePreview item={item} qv={qv} />
      case 'timeoff':
        return <TimeOffPreview item={item} qv={qv} />
      case 'activity':
        return <ActivityPreview qv={qv} />
      case 'achievement':
        return <AchievementPreview item={item} qv={qv} />
      default:
        return <GenericPreview qv={qv} />
    }
  })()

  if (layout === 'generic') {
    return preview
  }

  return <ModulePreviewShell item={item}>{preview}</ModulePreviewShell>
}

export function EmployeePortalFeedQuickView({
  item,
  open,
  onOpenChange,
  onDismissSynthetic,
  onMarkSeen,
}: EmployeePortalFeedQuickViewProps) {
  const { markCommsSeen } = useEmployeePortalComms()
  const { markRead } = useNotifications()
  const engagedItemIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!open || !item) return
    if (engagedItemIdRef.current === item.id) return
    engagedItemIdRef.current = item.id
    engageFeedItem(item, {
      markRead,
      markCommsSeen,
      dismissSynthetic: onDismissSynthetic,
      markSeen: onMarkSeen,
    })
  }, [open, item, markRead, markCommsSeen, onDismissSynthetic, onMarkSeen])

  useEffect(() => {
    if (!open) engagedItemIdRef.current = null
  }, [open])

  if (!item) return null

  const { quickView: qv } = item
  const layout = resolveFeedQuickViewLayout(item)
  const dialogWidth =
    layout === 'project' || layout === 'message' ? 'sm:max-w-xl' : 'sm:max-w-lg'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dialogWidth}>
        <DialogHeader>
          <DialogTitle className="pr-8">{item.title}</DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {item.meta && <Badge variant="outline">{item.meta}</Badge>}
            <Badge variant={item.scope === 'for_you' ? 'secondary' : 'outline'}>
              {item.scope === 'for_you' ? 'For you' : 'Company'}
            </Badge>
            {item.time && <span className="text-xs text-muted-foreground">{item.time}</span>}
          </div>
        </DialogHeader>

        <div className="py-1">
          <QuickViewBody item={item} />
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {item.link && (
            <Button type="button" asChild>
              <Link
                to={item.link}
                onClick={() => {
                  engageFeedItem(item, {
                    markRead,
                    markCommsSeen,
                    dismissSynthetic: onDismissSynthetic,
                    markSeen: onMarkSeen,
                  })
                  onOpenChange(false)
                }}
              >
                {qv.moduleLabel ?? 'Open module'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
