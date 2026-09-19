import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  connectAndSyncGoogleCalendar,
  googleCalendarConfigured,
  syncGoogleCalendar,
} from '@/lib/integrations/google-calendar'
import {
  connectAndSyncGoogleTasks,
  googleTasksConfigured,
  syncGoogleTasks,
} from '@/lib/integrations/google-tasks'
import { connectAndSyncIcsCalendar, syncIcsCalendar } from '@/lib/integrations/ics-calendar'
import { consumeOAuthHashReturn, consumeOAuthPendingReturn } from '@/lib/integrations/oauth-popup'
import {
  connectAndSyncOutlookCalendar,
  outlookCalendarConfigured,
  syncOutlookCalendar,
} from '@/lib/integrations/outlook-calendar'
import {
  connectGoogleCalendar,
  connectOAuthProvider,
  disconnectProvider,
  listConnections,
  markConnectionSync,
  removeConnection,
} from '@/lib/integrations/store'
import { importedTaskCount, removeImportedTasksBySource } from '@/lib/integrations/task-merge'
import { connectAndSyncTodoist, syncTodoist, todoistConfigured } from '@/lib/integrations/todoist'
import type { IntegrationConnection, OAuthTokens } from '@/lib/integrations/types'

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
  const oauthReturnHandled = useRef(false)
  const googleReady = googleCalendarConfigured()
  const outlookReady = outlookCalendarConfigured()
  const googleTasksReady = googleTasksConfigured()
  const todoistReady = todoistConfigured()

  const connections = useMemo(() => listConnections(userId), [userId, tick, busy])
  const legacyHealth = connections.filter((c) => c.provider === 'fitbit' || c.provider === 'strava')

  async function run(label: string, fn: () => Promise<number | 'redirected'>, unit = 'events') {
    setBusy(label)
    try {
      const count = await fn()
      if (count === 'redirected') return
      broadcastLocalRefresh()
      toast.success(count > 0 ? `Synced ${count} ${unit}` : 'Up to date')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sync failed')
    } finally {
      setBusy(null)
    }
  }

  useEffect(() => {
    function applyOAuthPayload(payload: {
      type: string
      tokens?: OAuthTokens | null
      error?: string | null
    }) {
      if (oauthReturnHandled.current) return
      oauthReturnHandled.current = true

      if (payload.error) {
        toast.error(payload.error)
        return
      }

      const tokens = payload.tokens as OAuthTokens | null | undefined
      if (!tokens?.access_token) {
        toast.error('No OAuth tokens returned.')
        return
      }

      void (async () => {
        setBusy('oauth-return')
        try {
          let count = 0
          let unit = 'events'
          switch (payload.type) {
            case 'katana-google-calendar-oauth': {
              if (!tokens.refresh_token) {
                throw new Error('Google did not return a refresh token. Try again and approve calendar access.')
              }
              const connection = connectGoogleCalendar(userId, tokens)
              count = await syncGoogleCalendar(userId).catch((err) => {
                markConnectionSync(userId, connection.id, {
                  lastError: err instanceof Error ? err.message : 'Sync failed',
                  status: 'error',
                })
                throw err
              })
              break
            }
            case 'katana-outlook-oauth': {
              if (!tokens.refresh_token) {
                throw new Error('Microsoft did not return a refresh token. Try again.')
              }
              const connection = connectOAuthProvider(userId, 'outlook_calendar', tokens, 'Outlook Calendar')
              count = await syncOutlookCalendar(userId).catch((err) => {
                markConnectionSync(userId, connection.id, {
                  lastError: err instanceof Error ? err.message : 'Sync failed',
                  status: 'error',
                })
                throw err
              })
              break
            }
            case 'katana-google-tasks-oauth': {
              if (!tokens.refresh_token) {
                throw new Error('Google did not return a refresh token. Try again and approve Tasks access.')
              }
              const connection = connectOAuthProvider(userId, 'google_tasks', tokens, 'Google Tasks')
              count = await syncGoogleTasks(userId).catch((err) => {
                markConnectionSync(userId, connection.id, {
                  lastError: err instanceof Error ? err.message : 'Sync failed',
                  status: 'error',
                })
                throw err
              })
              unit = 'tasks'
              break
            }
            case 'katana-todoist-oauth': {
              const connection = connectOAuthProvider(userId, 'todoist', tokens, 'Todoist')
              count = await syncTodoist(userId).catch((err) => {
                markConnectionSync(userId, connection.id, {
                  lastError: err instanceof Error ? err.message : 'Sync failed',
                  status: 'error',
                })
                throw err
              })
              unit = 'tasks'
              break
            }
            default:
              toast.message('Connected')
              return
          }
          broadcastLocalRefresh()
          toast.success(count > 0 ? `Synced ${count} ${unit}` : 'Connected')
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Connection failed')
        } finally {
          setBusy(null)
        }
      })()
    }

    function tryConsume() {
      const payload = consumeOAuthHashReturn() || consumeOAuthPendingReturn()
      if (payload) applyOAuthPayload(payload)
    }

    tryConsume()
    const onPending = () => {
      oauthReturnHandled.current = false
      tryConsume()
    }
    window.addEventListener('katana-oauth-pending', onPending)
    return () => window.removeEventListener('katana-oauth-pending', onPending)
  }, [userId])

  async function onConnectGoogle() {
    await run('google-connect', () => connectAndSyncGoogleCalendar(userId))
  }

  async function onConnectOutlook() {
    await run('outlook-connect', () => connectAndSyncOutlookCalendar(userId))
  }

  async function onConnectGoogleTasks() {
    await run('google-tasks-connect', () => connectAndSyncGoogleTasks(userId), 'tasks')
  }

  async function onConnectTodoist() {
    await run('todoist-connect', () => connectAndSyncTodoist(userId), 'tasks')
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
    } else if (conn.provider === 'outlook_calendar') {
      removeImportedBySource(userId, 'outlook')
      disconnectProvider(userId, 'outlook_calendar')
    } else if (conn.provider === 'google_tasks') {
      removeImportedTasksBySource(userId, 'google_tasks')
      disconnectProvider(userId, 'google_tasks')
    } else if (conn.provider === 'todoist') {
      removeImportedTasksBySource(userId, 'todoist')
      disconnectProvider(userId, 'todoist')
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

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Outlook / Microsoft Calendar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Read Outlook and Microsoft 365 calendars so Today and Ask see work meetings.
            </p>
            {!outlookReady ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Waiting on Microsoft env (`VITE_MS_CLIENT_ID` + `MS_CLIENT_SECRET`).
              </p>
            ) : null}
          </div>
        </div>
        {connections
          .filter((c) => c.provider === 'outlook_calendar')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail={`${importedEventCount(userId, 'outlook')} events on device`}
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncOutlookCalendar(userId))}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}
        {!connections.some((c) => c.provider === 'outlook_calendar') ? (
          <Button
            type="button"
            disabled={!outlookReady || busy != null}
            onClick={() => void onConnectOutlook()}
          >
            {busy === 'outlook-connect' ? 'Connecting…' : 'Connect Outlook Calendar'}
          </Button>
        ) : null}
      </div>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <CheckSquare className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Google Tasks</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Pull open Google Tasks into Katana so Do this next and Ask see what’s already on your plate.
            </p>
            {!googleTasksReady ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Waiting on Google env (`VITE_GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`). Enable Google
                Tasks API in Cloud Console.
              </p>
            ) : null}
          </div>
        </div>
        {connections
          .filter((c) => c.provider === 'google_tasks')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail={`${importedTaskCount(userId, 'google_tasks')} tasks on device`}
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncGoogleTasks(userId), 'tasks')}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}
        {!connections.some((c) => c.provider === 'google_tasks') ? (
          <Button
            type="button"
            disabled={!googleTasksReady || busy != null}
            onClick={() => void onConnectGoogleTasks()}
          >
            {busy === 'google-tasks-connect' ? 'Connecting…' : 'Connect Google Tasks'}
          </Button>
        ) : null}
      </div>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <ListTodo className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Todoist</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Import active Todoist tasks — read-only sync onto this device.
            </p>
            {!todoistReady ? (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Waiting on Todoist env (`VITE_TODOIST_CLIENT_ID` + `TODOIST_CLIENT_SECRET`).
              </p>
            ) : null}
          </div>
        </div>
        {connections
          .filter((c) => c.provider === 'todoist')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail={`${importedTaskCount(userId, 'todoist')} tasks on device`}
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncTodoist(userId), 'tasks')}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}
        {!connections.some((c) => c.provider === 'todoist') ? (
          <Button type="button" disabled={!todoistReady || busy != null} onClick={() => void onConnectTodoist()}>
            {busy === 'todoist-connect' ? 'Connecting…' : 'Connect Todoist'}
          </Button>
        ) : null}
      </div>

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
