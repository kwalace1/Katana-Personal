import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Client } from '@/lib/customer-success-api'
import { getClientTimelineEvents } from '@/lib/kyc-api'
import { KycAccountTimeline } from '@/components/customers/KycAccountTimeline'
import { Activity, Headphones, Mail, MessageSquare } from 'lucide-react'
import { getInteractionsByClientId } from '@/lib/customer-success-api'
import { formatDateOnly } from '@/lib/due-date-utils'

interface KycAccountActivityPanelProps {
  client: Client
}

export function KycAccountActivityPanel({ client }: KycAccountActivityPanelProps) {
  const [portalLogins, setPortalLogins] = useState(client.portal_logins ?? 0)
  const [supportTickets, setSupportTickets] = useState(client.support_tickets ?? 0)
  const [recentNotes, setRecentNotes] = useState<{ subject: string; date: string; type: string }[]>([])
  const [recentMeetings, setRecentMeetings] = useState<{ subject: string; date: string }[]>([])

  const loadActivityMeta = useCallback(async () => {
    const interactions = await getInteractionsByClientId(client.id)
    const notes = interactions
      .filter((i) => i.type === 'note' || i.type === 'email')
      .slice(0, 5)
      .map((i) => ({ subject: i.subject || i.type, date: i.interaction_date, type: i.type }))
    const meetings = interactions
      .filter((i) => i.type === 'meeting' || i.type === 'call')
      .slice(0, 5)
      .map((i) => ({ subject: i.subject || i.type, date: i.interaction_date }))
    setRecentNotes(notes)
    setRecentMeetings(meetings)
    setPortalLogins(client.portal_logins ?? 0)
    setSupportTickets(client.support_tickets ?? 0)
    void getClientTimelineEvents(client)
  }, [client])

  useEffect(() => {
    void loadActivityMeta()
  }, [loadActivityMeta])

  const usageSummary = useMemo(
    () => ({
      portalLogins,
      featureUsage: client.feature_usage ?? 'unknown',
      supportTickets,
    }),
    [portalLogins, client.feature_usage, supportTickets],
  )

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Portal usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{usageSummary.portalLogins}</p>
            <p className="text-xs text-muted-foreground mt-1">Total logins on record</p>
            <p className="text-xs text-muted-foreground mt-2">Feature usage: {usageSummary.featureUsage}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" />
              Support
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{usageSummary.supportTickets}</p>
            <p className="text-xs text-muted-foreground mt-1">Tickets on account record</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Recent touchpoints
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>{recentMeetings.length} meetings/calls · {recentNotes.length} notes/emails shown below</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Meetings & calls</CardTitle>
            <CardDescription>Recent customer conversations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentMeetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meetings logged yet.</p>
            ) : (
              recentMeetings.map((item) => (
                <div key={`${item.date}-${item.subject}`} className="text-sm border rounded-md p-2">
                  <p className="font-medium">{item.subject}</p>
                  <p className="text-xs text-muted-foreground">{formatDateOnly(item.date)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Notes & emails
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No notes or emails logged yet.</p>
            ) : (
              recentNotes.map((item) => (
                <div key={`${item.date}-${item.subject}`} className="text-sm border rounded-md p-2">
                  <p className="font-medium">{item.subject}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {item.type} · {formatDateOnly(item.date)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <KycAccountTimeline client={client} />
    </div>
  )
}
