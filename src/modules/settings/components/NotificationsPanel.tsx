import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { PlusPaywallSheet } from '@/components/PlusPaywall'
import {
  DEFAULT_QUIET_HOURS,
  orchestrationPushEnabled,
  parseQuietHours,
  remindersEnabled,
} from '@/lib/notifications/preferences'
import { pushConfigured, sendPushToSelf } from '@/lib/notifications/push'
import { canUsePlusFeature } from '@/lib/plus'
import { requestReminderPermission, sendTestReminderPing } from '@/lib/reminders'
import { isStandalonePwa } from '@/lib/web-notify'
import { useState } from 'react'

type Props = {
  preferences?: Record<string, unknown> | null
  cloudSignedIn: boolean
  onUpdatePreferences: (patch: Record<string, unknown>) => void
}

export function NotificationsPanel({ preferences, cloudSignedIn, onUpdatePreferences }: Props) {
  const [plusWallOpen, setPlusWallOpen] = useState(false)
  const gentle = remindersEnabled(preferences)
  const orchPush = orchestrationPushEnabled(preferences)
  const quiet = parseQuietHours(preferences)

  async function onToggleReminders(next: boolean) {
    if (next) {
      const ok = await requestReminderPermission()
      if (!ok) {
        toast.message('Reminders need permission from your device')
        onUpdatePreferences({ gentle_reminders: false })
        return
      }
      onUpdatePreferences({ gentle_reminders: true })
      toast.success('Gentle reminders on')
      return
    }
    onUpdatePreferences({ gentle_reminders: false })
    toast.message('Reminders off')
  }

  async function onToggleOrchestrationPush(next: boolean) {
    if (next && !canUsePlusFeature('orchestration_push')) {
      setPlusWallOpen(true)
      return
    }
    if (next) {
      const ok = await requestReminderPermission()
      if (!ok) {
        toast.message('Allow notifications first')
        return
      }
    }
    onUpdatePreferences({ orchestration_push: next })
    toast.message(next ? 'Proactive orchestration nudges on' : 'Orchestration nudges off')
  }

  function setQuietHour(field: 'start' | 'end', value: number) {
    onUpdatePreferences({
      quiet_hours: { ...quiet, enabled: true, [field]: value },
    })
  }

  return (
    <>
      <section className="kp-surface mb-4 space-y-4 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold">Gentle reminders</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Habits ping until you check in. Events remind before they start. On iPhone, add Katana to
              your Home Screen first — Safari tabs cannot reliably alert.
            </p>
          </div>
          <Switch checked={gentle} onCheckedChange={(v) => void onToggleReminders(v)} />
        </div>

        <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Proactive orchestration nudges</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Plus — workout windows, focus tasks, goal pace. Works locally while open; background push
              needs cloud sign-in + VAPID keys.
            </p>
          </div>
          <Switch checked={orchPush} onCheckedChange={(v) => void onToggleOrchestrationPush(v)} />
        </div>

        <div className="rounded-2xl border border-border/50 bg-secondary/20 px-4 py-3 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Quiet hours</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No pings between {quiet.start}:00 and {quiet.end}:00 (local time).
              </p>
            </div>
            <Switch
              checked={quiet.enabled}
              onCheckedChange={(v) =>
                onUpdatePreferences({ quiet_hours: { ...quiet, enabled: v } })
              }
            />
          </div>
          {quiet.enabled ? (
            <div className="flex flex-wrap gap-3">
              <div>
                <Label htmlFor="quiet-start" className="text-xs">
                  Start
                </Label>
                <select
                  id="quiet-start"
                  className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={quiet.start}
                  onChange={(e) => setQuietHour('start', Number(e.target.value))}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="quiet-end" className="text-xs">
                  End
                </Label>
                <select
                  id="quiet-end"
                  className="mt-1 block rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  value={quiet.end}
                  onChange={(e) => setQuietHour('end', Number(e.target.value))}
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h}:00
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {isStandalonePwa()
            ? 'Home Screen app detected. Leave Katana in Recents so catch-up pings can land.'
            : 'Add to Home Screen for reliable iPhone alerts (Share → Add to Home Screen).'}
          {pushConfigured()
            ? cloudSignedIn
              ? ' Server push is configured.'
              : ' Sign in to cloud for background push when the app is closed.'
            : ' Set VITE_VAPID_PUBLIC_KEY + server keys for background push.'}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              try {
                const ok = await sendTestReminderPing()
                if (ok) toast.success('Test ping sent — check the notification shade')
                else toast.message('Allow notifications, then try again from the Home Screen app')
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Couldn’t send a test ping')
              }
            }}
          >
            Send local test ping
          </Button>
          {cloudSignedIn && pushConfigured() ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                const result = await sendPushToSelf({
                  title: 'Katana',
                  body: '~80 min before your next event — good window for a workout?',
                  href: '/dashboard',
                  tag: 'katana-push-test',
                })
                if (result.ok) toast.success('Server push sent')
                else toast.error(result.error || 'Push failed')
              }}
            >
              Send server push test
            </Button>
          ) : null}
        </div>
      </section>

      <PlusPaywallSheet
        open={plusWallOpen}
        onOpenChange={setPlusWallOpen}
        feature="orchestration_push"
      />
    </>
  )
}

export { DEFAULT_QUIET_HOURS }
