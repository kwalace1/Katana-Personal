import { FormEvent, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { InviteFriendButton } from '@/components/InviteFriendButton'
import { useAuth } from '@/contexts/AuthContext'
import { parseCapture, commitCapture } from '@/lib/capture'
import { burstConfetti } from '@/lib/celebrate'
import { springSoft } from '@/lib/motion-ui'
import { tasksApi } from '@/modules/tasks/api'
import { habitsApi } from '@/modules/habits/api'
import { formatShortDate } from '@/lib/dates'
import { toast } from 'sonner'

const STEP_KEY = 'katana-personal:ritual-step'
const EXAMPLE = 'Call Mom Friday 3pm'

type Step = 'welcome' | 'capture' | 'next' | 'invite'

function readStep(): Step {
  const raw = localStorage.getItem(STEP_KEY)
  if (raw === 'capture' || raw === 'next' || raw === 'invite' || raw === 'welcome') return raw
  return 'welcome'
}

function writeStep(step: Step) {
  localStorage.setItem(STEP_KEY, step)
}

/** First-open guided ritual — welcome → capture → Do this next → optional invite. */
export function FirstRitual({
  onFinished,
  onRefresh,
  tick = 0,
}: {
  onFinished: () => void
  onRefresh: () => void
  tick?: number
}) {
  const { user, profile } = useAuth()
  const userId = user!.id
  const [step, setStep] = useState<Step>(readStep)
  const [capture, setCapture] = useState('')
  const draft = useMemo(() => parseCapture(capture), [capture])

  const nextItem = useMemo(() => {
    const overdue = tasksApi.overdue(userId)
    const priority = tasksApi.priorityTasks(userId, 1)
    const habits = habitsApi.dueToday(userId).filter((h) => !habitsApi.isDoneToday(userId, h.id))
    if (overdue[0]) return { type: 'task' as const, item: overdue[0] }
    if (priority[0]) return { type: 'task' as const, item: priority[0] }
    if (habits[0]) return { type: 'habit' as const, item: habits[0] }
    return null
  }, [userId, step, tick])

  function go(next: Step) {
    writeStep(next)
    setStep(next)
  }

  function finish() {
    localStorage.removeItem(STEP_KEY)
    onFinished()
  }

  function onCapture(e: FormEvent) {
    e.preventDefault()
    if (!draft) return
    const firstCapture = !localStorage.getItem('katana-personal:captured-once')
    const result = commitCapture(userId, draft)
    localStorage.setItem('katana-personal:captured-once', '1')
    setCapture('')
    if (firstCapture) burstConfetti()
    toast.success(result.summary)
    onRefresh()
    go('next')
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className="relative mb-6 overflow-hidden kp-surface border border-primary/15 p-6 sm:p-8"
    >
      <div className="pointer-events-none absolute -right-10 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <p className="kp-section-label">First minute</p>
        <Button type="button" size="sm" variant="ghost" className="text-xs" onClick={finish}>
          Skip
        </Button>
      </div>

      {step === 'welcome' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            One next step. Capture what matters. Close the day when you’re done — private on this
            device.
          </p>
          <Button className="mt-6 min-h-12 gap-2" size="lg" onClick={() => go('capture')}>
            Start with Today
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 'capture' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Capture something</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Type naturally — we’ll turn it into a task or event.
          </p>
          <form onSubmit={onCapture} className="mt-5 space-y-3">
            <Input
              autoFocus
              className="min-h-12"
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              placeholder={EXAMPLE}
              aria-label="Quick capture"
            />
            {draft && capture.trim() ? (
              <p className="text-sm text-muted-foreground">
                Will create: <span className="font-medium text-foreground">{draft.summary}</span>
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-11" disabled={!draft}>
                Capture
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setCapture(EXAMPLE)}
              >
                Try “{EXAMPLE}”
              </Button>
            </div>
          </form>
        </div>
      )}

      {step === 'next' && (
        <div className="relative">
          <p className="kp-section-label">Do this next</p>
          {nextItem ? (
            <>
              <h2 className="mt-2 font-display text-2xl tracking-tight sm:text-3xl">
                {nextItem.item.title}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {nextItem.type === 'task' && (
                  <>
                    Task
                    {nextItem.item.due_at ? ` · ${formatShortDate(nextItem.item.due_at)}` : ''}
                  </>
                )}
                {nextItem.type === 'habit' && <>Habit · check in today</>}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {nextItem.type === 'task' ? (
                  <Button
                    className="min-h-12 gap-2"
                    size="lg"
                    onClick={() => {
                      tasksApi.completeTask(userId, nextItem.item.id)
                      toast.success('Done — that’s the loop')
                      onRefresh()
                      go('invite')
                    }}
                  >
                    Mark done
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="min-h-12 gap-2"
                    size="lg"
                    onClick={() => {
                      habitsApi.toggleToday(userId, nextItem.item.id)
                      toast.success('Checked in')
                      onRefresh()
                      go('invite')
                    }}
                  >
                    Check in
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="outline" className="min-h-12" onClick={() => go('invite')}>
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-2xl tracking-tight">You’re set</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">Nothing urgent — protect the calm.</p>
              <Button className="mt-5 min-h-12" onClick={() => go('invite')}>
                Continue
              </Button>
            </>
          )}
        </div>
      )}

      {step === 'invite' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Invite someone?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Optional — friends and Circles are opt-in. Private life stays on this device.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <InviteFriendButton size="lg" />
            <Button variant="ghost" className="min-h-12" onClick={finish}>
              Skip for now
            </Button>
          </div>
        </div>
      )}
    </motion.section>
  )
}
