import { FormEvent, useMemo, useState, type ReactNode } from 'react'
import {
  Calendar,
  CheckSquare,
  CloudSun,
  FileDown,
  Link2,
  ListTodo,
  Mail,
  RefreshCw,
  Unplug,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'
import { importedEventCount, removeImportedBySource } from '@/lib/integrations/calendar-merge'
import {
  googleTasksConfigured,
  outlookCalendarConfigured,
  todoistConfigured,
} from '@/lib/integrations/coming-soon'
import {
  connectAndSyncGoogleCalendar,
  googleCalendarConfigured,
  syncGoogleCalendar,
} from '@/lib/integrations/google-calendar'
import { connectAndSyncIcsCalendar, syncIcsCalendar } from '@/lib/integrations/ics-calendar'
import {
  disconnectProvider,
  listConnections,
  removeConnection,
} from '@/lib/integrations/store'
import type { IntegrationConnection } from '@/lib/integrations/types'

type Props = {
  userId: string
  tick?: number
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return iso
  }
}

export function ConnectionsPanel({ userId, tick = 0 }: Props) {
  void tick
  const [busy, setBusy] = useState<string | null>(null)
  const [icsUrl, setIcsUrl] = useState('')
  const [icsHelpOpen, setIcsHelpOpen] = useState(false)
  const googleReady = googleCalendarConfigured()
  const outlookReady = outlookCalendarConfigured()
  const googleTasksReady = googleTasksConfigured()
  const todoistReady = todoistConfigured()

  const connections = useMemo(() => listConnections(userId), [userId, tick, busy])
  const legacyHealth = connections.filter((c) => c.provider === 'fitbit' || c.provider === 'strava')

  async function run(label: string, fn: () => Promise<number>, unit = 'events') {
    setBusy(label)
    try {
      const count = await fn()
      broadcastLocalRefresh()
      toast.success(count > 0 ? `Synced ${count} ${unit}` : 'Up to date')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(null)
    }
  }

  async function onConnectGoogle() {
    await run('google-connect', () => connectAndSyncGoogleCalendar(userId))
  }

  async function onConnectIcs(e: FormEvent) {
    e.preventDefault()
    const url = icsUrl.trim()
    if (!url) {
      toast.error('Paste a calendar subscribe URL')
      return
    }
    await run('ics-connect', () => connectAndSyncIcsCalendar(userId, url))
    setIcsUrl('')
  }

  function onDisconnect(conn: IntegrationConnection) {
    if (conn.provider === 'google_calendar') {
      removeImportedBySource(userId, 'google')
      disconnectProvider(userId, 'google_calendar')
    } else if (conn.provider === 'fitbit' || conn.provider === 'strava') {
      disconnectProvider(userId, conn.provider)
    } else if (conn.provider === 'ics_calendar') {
      removeImportedBySource(userId, 'ics')
      removeConnection(userId, conn.id)
    } else {
      disconnectProvider(userId, conn.provider)
    }
    broadcastLocalRefresh()
    toast.message('Disconnected')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Events and tasks sync onto this device. Katana uses them for Today and Ask — nothing is uploaded
          unless you enable cloud backup. Weather on Today and cardio uses free Open-Meteo with your
          location (no key).
        </p>
      </div>

      <form onSubmit={(e) => void onConnectIcs(e)} className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Calendar subscribe (.ics)</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Easiest free path — Apple, Google secret address, Outlook web, or any public .ics feed.
              Read-only.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="text-left text-xs font-medium text-primary hover:underline"
          onClick={() => setIcsHelpOpen((v) => !v)}
        >
          {icsHelpOpen ? 'Hide how-to' : 'How to get a subscribe URL'}
        </button>
        {icsHelpOpen ? (
          <ol className="list-decimal space-y-2 rounded-xl border border-border/50 bg-background/50 px-4 py-3 text-xs text-muted-foreground pl-8">
            <li>
              <span className="font-medium text-foreground">Apple Calendar (Mac/iOS):</span> Calendar →
              File → Export → or share a public calendar and copy the webcal/https link ending in{' '}
              <code className="text-[10px]">.ics</code>.
            </li>
            <li>
              <span className="font-medium text-foreground">Google Calendar:</span> Settings → select
              calendar → Integrate calendar → Secret address in iCal format → copy.
            </li>
            <li>
              <span className="font-medium text-foreground">Outlook on the web:</span> Calendar → settings
              → Shared calendars → Publish a calendar → copy the ICS link.
            </li>
            <li>Paste the https URL below (webcal:// also works — we’ll fetch it as https).</li>
          </ol>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="ics-url">Calendar URL (.ics)</Label>
          <Input
            id="ics-url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://…/basic.ics"
            inputMode="url"
          />
        </div>
        <Button type="submit" disabled={busy != null || !icsUrl.trim()}>
          {busy === 'ics-connect' ? 'Subscribing…' : 'Add calendar feed'}
        </Button>

        {connections
          .filter((c) => c.provider === 'ics_calendar')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail={conn.config.icsUrl || ''}
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncIcsCalendar(userId, conn.id))}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}
      </form>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Google Calendar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Live OAuth sync so Today and Ask see meetings without a secret .ics link.
            </p>
            {!googleReady ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Waiting on Google OAuth env (`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`). We’ll
                wire this in production next.
              </p>
            ) : null}
          </div>
        </div>

        {connections
          .filter((c) => c.provider === 'google_calendar')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail={`${importedEventCount(userId, 'google')} events on device`}
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncGoogleCalendar(userId))}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}

        {!connections.some((c) => c.provider === 'google_calendar') ? (
          <Button
            type="button"
            disabled={!googleReady || busy != null}
            onClick={() => void onConnectGoogle()}
          >
            {busy === 'google-connect' ? 'Connecting…' : 'Connect Google Calendar'}
          </Button>
        ) : null}
      </div>

      <UpcomingIntegration
        icon={<Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        title="Outlook / Microsoft Calendar"
        body="Read Outlook and Microsoft 365 calendars the same way as Google — for work schedules."
        ready={outlookReady}
        readyHint="Microsoft app registration env is set — connect flow ships next."
        waitingHint="Add `VITE_MS_CLIENT_ID` (+ server secret) when you’re ready to set this up."
      />

      <UpcomingIntegration
        icon={<CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        title="Google Tasks"
        body="Pull open tasks into Katana so Do this next and Ask see what’s already on your plate."
        ready={googleTasksReady}
        readyHint="Google client id present — Tasks scopes + connect UI come next."
        waitingHint="Can reuse Google Calendar OAuth client, or set `VITE_GOOGLE_TASKS_CLIENT_ID`."
      />

      <UpcomingIntegration
        icon={<ListTodo className="mt-0.5 h-5 w-5 shrink-0 text-primary" />}
        title="Todoist"
        body="Import active Todoist tasks (free Todoist API / OAuth — no paid plan required for basic sync)."
        ready={todoistReady}
        readyHint="Todoist client id is set — connect flow ships next."
        waitingHint="Add `VITE_TODOIST_CLIENT_ID` (+ secret) when you’re ready."
      />

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <FileDown className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Apple Health & Fitbit files</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Free, no live OAuth. Import Apple Health <code className="text-[10px]">export.xml</code> or
              a Fitbit sleep CSV in Health — sleep and workouts stay on this device.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link to="/health?tab=sleep">Open Health import</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <CloudSun className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Weather</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Free Open-Meteo forecast on Today and when you track runs/walks in Health. Uses device
              location — no API key, no Plus.
            </p>
          </div>
        </div>
      </div>

      {legacyHealth.length > 0 ? (
        <div className="kp-surface space-y-3 border border-destructive/20 p-4">
          <p className="text-sm font-medium">Legacy live Fitbit / Strava</p>
          <p className="text-xs text-muted-foreground">
            Live OAuth for Fitbit and Strava was removed. Disconnect any leftover connections — use file
            import for health data instead.
          </p>
          {legacyHealth.map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail="No longer supported"
              busy={busy}
              onSync={() => toast.message('Live sync retired — use Health file import')}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function UpcomingIntegration({
  icon,
  title,
  body,
  ready,
  readyHint,
  waitingHint,
}: {
  icon: ReactNode
  title: string
  body: string
  ready: boolean
  readyHint: string
  waitingHint: string
}) {
  return (
    <div className="kp-surface space-y-3 p-4">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-lg tracking-tight">{title}</h3>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {ready ? 'Env ready' : 'Setup next'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          <p className="mt-2 text-xs text-muted-foreground">{ready ? readyHint : waitingHint}</p>
        </div>
      </div>
      <Button type="button" disabled>
        Connect (coming with credentials)
      </Button>
    </div>
  )
}

function ConnectionRow({
  conn,
  detail,
  busy,
  onSync,
  onDisconnect,
}: {
  conn: IntegrationConnection
  detail: string
  busy: string | null
  onSync: () => void
  onDisconnect: () => void
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/60 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{conn.label}</p>
          <p className="truncate text-xs text-muted-foreground">{detail}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last sync: {formatWhen(conn.lastSyncAt)}
            {conn.lastError ? <span className="text-destructive"> · {conn.lastError}</span> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={busy != null}
            onClick={onSync}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Sync now
          </Button>
          <Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={onDisconnect}>
            <Unplug className="h-3.5 w-3.5" />
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  )
}
