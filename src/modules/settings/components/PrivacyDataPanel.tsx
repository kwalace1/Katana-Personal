import { WORKSPACE_COLLECTIONS } from '@/lib/local-db'
import { listConnections } from '@/lib/integrations/store'
import { DEFAULT_SHARE_PREFS, type SharePrefs } from '@/lib/social/types'
import { computeWeights, recentEvents } from '@/lib/orchestration/feedback'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'

const COLLECTION_LABELS: Record<string, string> = {
  tasks: 'Tasks & lists',
  task_lists: 'Task lists',
  events: 'Calendar events',
  notes: 'Notes',
  note_folders: 'Note folders',
  goals: 'Goals',
  habits: 'Habits & check-ins',
  habit_logs: 'Habit history',
  journal_entries: 'Journal',
  workouts: 'Workouts',
  water_logs: 'Water',
  nutrition_logs: 'Nutrition',
  diet_plans: 'Diet plans',
  sleep_logs: 'Sleep',
  lift_sessions: 'Lift sessions',
  lift_sets: 'Lift sets',
  lift_exercises: 'Lift exercises',
  training_splits: 'Training splits',
  body_weight_logs: 'Body weight',
  weight_goals: 'Weight goals',
  supplement_items: 'Supplements',
  supplement_logs: 'Supplement logs',
  documents: 'Files (metadata on device)',
  ask_messages: 'Ask chat history',
  deletions: 'Deletion markers (sync safety)',
}

type Props = {
  userId: string
  cloudEnabled: boolean
  cloudSignedIn: boolean
  sharePrefs: SharePrefs
  onExport?: () => void
}

export function PrivacyDataPanel({
  userId,
  cloudEnabled,
  cloudSignedIn,
  sharePrefs,
  onExport,
}: Props) {
  const connections = listConnections(userId)
  const feedbackCount = recentEvents(userId, 14).length
  const weights = computeWeights(userId)

  const enabledShare = Object.entries({ ...DEFAULT_SHARE_PREFS, ...sharePrefs }).filter(
    ([, on]) => on,
  )

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold">On this device</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal workspace lives in IndexedDB in this browser. No account required.
        </p>
        <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
          {WORKSPACE_COLLECTIONS.filter((c) => c !== 'deletions').map((c) => (
            <li key={c}>· {COLLECTION_LABELS[c] || c}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold">Leaves this device (only if you opt in)</h3>
        {!cloudEnabled ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Cloud isn’t available in this build — everything stays on this device.
          </p>
        ) : !cloudSignedIn ? (
          <p className="mt-1 text-sm text-muted-foreground">
            You’re local-only right now. Sign in under Together to sync or share with friends.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Cloud workspace sync</span> — most life
              collections (not Ask chat or file blobs).
            </li>
            <li>
              <span className="font-medium text-foreground">Together share prefs</span> —{' '}
              {enabledShare.length > 0
                ? enabledShare.map(([k]) => k).join(', ')
                : 'nothing enabled yet'}
            </li>
            <li>
              <span className="font-medium text-foreground">Deeper Ask (LLM)</span> — your question
              and life snapshot go to the model provider when you use Gemini-powered replies.
            </li>
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold">Integrations</h3>
        {connections.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            No calendars connected. External events are read into this device only — not uploaded.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 text-sm">
            {connections.map((c) => (
              <li key={c.id} className="text-muted-foreground">
                <span className="font-medium text-foreground">{c.label}</span> — reads calendar
                events, stores locally, never sent to Katana servers except during sync fetch.
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Manage connections in{' '}
          <Link to="/settings/connections" className="text-primary underline-offset-2 hover:underline">
            Settings → Connections
          </Link>
          .
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold">Orchestration learning (local only)</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Katana adjusts which next-step types you see based on what you complete — stored only here
          ({feedbackCount} signals in the last 14 days).
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Current lean: tasks {Math.round(weights.task * 100)}% · workouts {Math.round(weights.workout * 100)}%
          · habits {Math.round(weights.habit * 100)}%
        </p>
      </section>

      <section className="rounded-2xl border border-border/60 bg-secondary/20 p-4">
        <h3 className="text-sm font-semibold">Export</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Save a <code className="text-xs">.katana</code> copy anytime — includes preferences and
          orchestration signals.
        </p>
        {onExport ? (
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onExport}>
            Go to Save a copy
          </Button>
        ) : (
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/settings/backup">Save a copy</Link>
          </Button>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        <Link to="/privacy" className="text-primary underline-offset-2 hover:underline">
          Privacy Policy
        </Link>
        {' · '}
        <Link to="/terms" className="text-primary underline-offset-2 hover:underline">
          Terms
        </Link>
      </p>
    </div>
  )
}
