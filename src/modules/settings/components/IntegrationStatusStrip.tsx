import { Link } from 'react-router-dom'
import { Check, Link2, X } from 'lucide-react'
import { readIntegrationStatus } from '@/lib/integrations/status'
import { cn } from '@/lib/utils'

type Props = {
  userId: string
  tick?: number
}

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs',
        ok ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground',
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3 opacity-60" />}
      {label}
    </span>
  )
}

/** Calendar footer — shows whether calendar + health integrations are live on this device. */
export function IntegrationStatusStrip({ userId, tick = 0 }: Props) {
  void tick
  const status = readIntegrationStatus(userId)

  return (
    <div className="mt-6 rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link2 className="h-4 w-4 shrink-0" />
          <span>Integrations on this device</span>
        </div>
        <Link to="/settings/connections" className="text-xs font-medium text-primary hover:underline">
          Manage
        </Link>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        <StatusPill ok={status.calendarConnected} label="Calendar" />
        <StatusPill ok={status.healthConnected} label="Health import" />
        {status.googleCalendar ? <StatusPill ok label="Google" /> : null}
        {status.icsCalendar ? <StatusPill ok label=".ics" /> : null}
        {status.appleHealthImport ? <StatusPill ok label="Apple / Fitbit file" /> : null}
      </div>
      {!status.calendarConnected || !status.healthConnected ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {!status.calendarConnected && !status.healthConnected
            ? 'Add a .ics feed or Google Calendar, and import Health/Fitbit files, so Today and Ask read what matters.'
            : !status.healthConnected
              ? 'Import Apple Health export.xml or a Fitbit sleep CSV in Health.'
              : 'Add a calendar feed or Google Calendar for richer workout windows.'}
        </p>
      ) : null}
    </div>
  )
}
