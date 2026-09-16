import { FormEvent, useMemo, useState } from 'react'
import { Activity, Calendar, HeartPulse, Link2, RefreshCw, Unplug } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { broadcastLocalRefresh } from '@/hooks/useLocalRefresh'
import { PlusPaywallSheet } from '@/components/PlusPaywall'
import { canUsePlusFeature } from '@/lib/plus'
import { importedEventCount, removeImportedBySource } from '@/lib/integrations/calendar-merge'
import {
  connectAndSyncGoogleCalendar,
  googleCalendarConfigured,
  syncGoogleCalendar,
} from '@/lib/integrations/google-calendar'
import { connectAndSyncIcsCalendar, syncIcsCalendar } from '@/lib/integrations/ics-calendar'
import {
  connectAndSyncFitbit,
  connectAndSyncStrava,
  fitbitConfigured,
  stravaConfigured,
  syncFitbit,
  syncStrava,
} from '@/lib/integrations/health-providers'
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
  const [plusWallOpen, setPlusWallOpen] = useState(false)
  const googleReady = googleCalendarConfigured()
  const fitbitReady = fitbitConfigured()
  const stravaReady = stravaConfigured()

  const connections = useMemo(() => listConnections(userId), [userId, tick, busy])

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
    if (!canUsePlusFeature('integrations')) {
      setPlusWallOpen(true)
      return
    }
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

  async function onConnectFitbit() {
    if (!canUsePlusFeature('integrations')) {
      setPlusWallOpen(true)
      return
    }
    await run('fitbit-connect', () => connectAndSyncFitbit(userId), 'records')
  }

  async function onConnectStrava() {
    if (!canUsePlusFeature('integrations')) {
      setPlusWallOpen(true)
      return
    }
    await run('strava-connect', () => connectAndSyncStrava(userId), 'records')
  }

  function onDisconnect(conn: IntegrationConnection) {
    if (conn.provider === 'google_calendar') {
      removeImportedBySource(userId, 'google')
      disconnectProvider(userId, 'google_calendar')
    } else if (conn.provider === 'fitbit' || conn.provider === 'strava') {
      disconnectProvider(userId, conn.provider)
    } else {
      removeImportedBySource(userId, 'ics')
      removeConnection(userId, conn.id)
    }
    broadcastLocalRefresh()
    toast.message('Disconnected')
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border/60 bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
        <p>
          Events sync into this device only. Katana reads your external calendar to improve Today and Ask — nothing
          is uploaded unless you enable cloud backup.
        </p>
      </div>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Calendar className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Google Calendar</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Read meetings and plans from Google so Today and Ask see your real schedule. Plus feature.
            </p>
            {!googleReady ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Google Calendar isn’t available in this build yet.
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

      <form onSubmit={(e) => void onConnectIcs(e)} className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Subscribe via URL</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Apple Calendar, Google secret address, or any public .ics feed — read-only.
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ics-url">Calendar URL (.ics)</Label>
          <Input
            id="ics-url"
            value={icsUrl}
            onChange={(e) => setIcsUrl(e.target.value)}
            placeholder="https://…/calendar.ics"
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
          <HeartPulse className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Fitbit</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Read sleep and activity into Health — powers recovery-aware Today and Ask. Plus feature.
            </p>
            {!fitbitReady ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Fitbit isn’t available in this build yet. You can still import a sleep file in Health.
              </p>
            ) : null}
          </div>
        </div>

        {connections
          .filter((c) => c.provider === 'fitbit')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail="Sleep + activity on device"
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncFitbit(userId))}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}

        {!connections.some((c) => c.provider === 'fitbit') ? (
          <Button type="button" disabled={!fitbitReady || busy != null} onClick={() => void onConnectFitbit()}>
            {busy === 'fitbit-connect' ? 'Connecting…' : 'Connect Fitbit'}
          </Button>
        ) : null}
      </div>

      <div className="kp-surface space-y-3 p-4">
        <div className="flex items-start gap-3">
          <Activity className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg tracking-tight">Strava</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Import recent runs and rides into workouts — read-only. Plus feature.
            </p>
            {!stravaReady ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Strava isn’t available in this build yet. You can still log cardio in Health.
              </p>
            ) : null}
          </div>
        </div>

        {connections
          .filter((c) => c.provider === 'strava')
          .map((conn) => (
            <ConnectionRow
              key={conn.id}
              conn={conn}
              detail="Activities on device"
              busy={busy}
              onSync={() => run(`sync-${conn.id}`, () => syncStrava(userId))}
              onDisconnect={() => onDisconnect(conn)}
            />
          ))}

        {!connections.some((c) => c.provider === 'strava') ? (
          <Button type="button" disabled={!stravaReady || busy != null} onClick={() => void onConnectStrava()}>
            {busy === 'strava-connect' ? 'Connecting…' : 'Connect Strava'}
          </Button>
        ) : null}
      </div>

      <PlusPaywallSheet open={plusWallOpen} onOpenChange={setPlusWallOpen} feature="integrations" />
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
            {conn.lastError ? (
              <span className="text-destructive"> · {conn.lastError}</span>
            ) : null}
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
