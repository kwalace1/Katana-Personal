import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Calendar,
  CheckSquare,
  FileText,
  Flag,
  HeartPulse,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Receipt,
  RefreshCw,
  ScrollText,
  TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Client } from '@/lib/customer-success-api'
import { getClientTimelineEvents, type KycTimelineEvent } from '@/lib/kyc-api'
import {
  filterTimelineEvents,
  type KycTimelineFilter,
} from '@/lib/kyc-timeline'
import { formatDateOnly } from '@/lib/due-date-utils'
import { KycEmptyState } from '@/components/customers/KycUi'
import { cn } from '@/lib/utils'

const FILTERS: { id: KycTimelineFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'meetings', label: 'Meetings' },
  { id: 'notes', label: 'Notes' },
  { id: 'portal', label: 'Portal' },
  { id: 'support', label: 'Support' },
  { id: 'renewals', label: 'Renewals' },
]

const EVENT_ICONS: Record<string, LucideIcon> = {
  meeting: Calendar,
  call: Phone,
  email: Mail,
  note: MessageSquare,
  'task-created': CheckSquare,
  'task-completed': CheckSquare,
  'task-due': CheckSquare,
  'milestone-upcoming': Flag,
  'milestone-in-progress': Flag,
  'milestone-completed': Flag,
  'contract-created': ScrollText,
  'contract-start': ScrollText,
  'contract-end': ScrollText,
  'deal-created': TrendingUp,
  'deal-expected-close': TrendingUp,
  'invoice-created': Receipt,
  'invoice-due': Receipt,
  'invoice-paid': Receipt,
  'health-snapshot': HeartPulse,
  'renewal-date': Calendar,
  'last-contact': Phone,
  'account-created': Activity,
}

function iconForEvent(event: KycTimelineEvent): LucideIcon {
  if (EVENT_ICONS[event.type]) return EVENT_ICONS[event.type]!
  if (event.category === 'milestone') return Flag
  if (event.category === 'deal') return TrendingUp
  if (event.category === 'contract') return ScrollText
  if (event.category === 'invoice') return Receipt
  if (event.category === 'task') return CheckSquare
  if (event.category === 'interaction') return MessageSquare
  return FileText
}

function categoryLabel(category: KycTimelineEvent['category']): string {
  switch (category) {
    case 'interaction':
      return 'Interaction'
    case 'task':
      return 'Task'
    case 'milestone':
      return 'Milestone'
    case 'renewal':
      return 'Renewal'
    case 'contract':
      return 'Contract'
    case 'deal':
      return 'Deal'
    case 'invoice':
      return 'Invoice'
    case 'health':
      return 'Health'
    case 'account':
      return 'Account'
    default:
      return 'Activity'
  }
}

interface KycAccountTimelineProps {
  client: Client
}

export function KycAccountTimeline({ client }: KycAccountTimelineProps) {
  const [events, setEvents] = useState<KycTimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<KycTimelineFilter>('all')

  const loadTimeline = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getClientTimelineEvents(client)
      setEvents(result)
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  const filtered = useMemo(() => filterTimelineEvents(events, filter), [events, filter])

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Activity timeline
            </CardTitle>
            <CardDescription>
              Meetings, notes, tasks, milestones, renewals, and commerce events in one feed
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadTimeline()} disabled={loading}>
            <RefreshCw className={cn('h-3.5 w-3.5 mr-1.5', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? 'default' : 'outline'}
              className="h-7 text-xs"
              onClick={() => setFilter(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading activity…
          </div>
        ) : filtered.length === 0 ? (
          <KycEmptyState
            icon={Activity}
            title="No activity yet"
            description={
              filter === 'all'
                ? 'Log interactions, tasks, or milestones to build this account timeline.'
                : `No ${filter} events found for this account.`
            }
          />
        ) : (
          <div className="space-y-0">
            {filtered.map((event) => {
              const Icon = iconForEvent(event)
              return (
                <div key={event.id} className="timeline-item">
                  <div className="rounded-lg border bg-card/60 p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{event.title}</p>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {categoryLabel(event.category)}
                          </Badge>
                        </div>
                        {event.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                        )}
                        <p className="text-[11px] text-muted-foreground mt-2">
                          {formatDateOnly(event.occurred_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
