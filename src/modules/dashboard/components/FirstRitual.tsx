import { FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles } from 'lucide-react'
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
const ASK_FOCUS = '/ask?q=What%20should%20I%20work%20on%20today'

type Step = 'welcome' | 'capture' | 'next' | 'ask' | 'invite'

function readStep(): Step {
  const raw = localStorage.getItem(STEP_KEY)
  if (
    raw === 'capture' ||
    raw === 'next' ||
    raw === 'ask' ||
    raw === 'invite' ||
    raw === 'welcome'
  ) {
    return raw
  }
  return 'welcome'
}

function writeStep(step: Step) {
  localStorage.setItem(STEP_KEY, step)
}

/** First-open guided ritual — forces the ~90s killer path. */
export function FirstRitual({
  onFinished,
  onRefresh,
  tick = 0,
}: {
  onFinished: () => void
  onRefresh: () => void
  tick?: number
}) {
  const { user, profile, updateDisplayName } = useAuth()
  const userId = user!.id
  const [step, setStep] = useState<Step>(readStep)
  const [capture, setCapture] = useState('')
  const [didNext, setDidNext] = useState(false)
  const [nameDraft, setNameDraft] = useState(profile?.display_name || '')
  const draft = useMemo(() => parseCapture(capture), [capture])
  const needsName =
    !profile?.display_name?.trim() || profile.display_name.trim().toLowerCase() === 'you'

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

  function completeNext() {
    burstConfetti()
    setDidNext(true)
    toast.success('That’s the loop')
    onRefresh()
    window.setTimeout(() => go('ask'), 450)
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
      <div className="relative mb-4">
        <p className="kp-section-label">First minute</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {step === 'welcome' && '1 · Welcome'}
          {step === 'capture' && '2 · Capture'}
          {step === 'next' && '3 · Do this next'}
          {step === 'ask' && '4 · Ask'}
          {step === 'invite' && '5 · Together'}
        </p>
      </div>

      {step === 'welcome' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">
            {needsName
              ? 'What should we call you?'
              : `Welcome${profile?.display_name ? `, ${profile.display_name}` : ''}`}
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground sm:text-base">
            {needsName
              ? 'First name is enough — then we start the day loop.'
              : 'One next step. Ask that can act. Friends only if you want them. Private on this device.'}
          </p>
          {needsName ? (
            <form
              className="mt-5 space-y-3"
              onSubmit={(e) => {
                e.preventDefault()
                const next = nameDraft.trim()
                if (!next) return
                updateDisplayName(next)
                go('capture')
              }}
            >
              <Input
                autoFocus
                className="min-h-12"
                value={nameDraft === 'You' ? '' : nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                placeholder="Your name"
                aria-label="Your name"
              />
              <Button type="submit" className="min-h-12 gap-2" size="lg" disabled={!nameDraft.trim()}>
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <Button className="mt-6 min-h-12 gap-2" size="lg" onClick={() => go('capture')}>
              Start the day loop
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {step === 'capture' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Capture something</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Get it out of your head — we’ll put it on Today.
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
          <p className="mt-1 text-xs text-muted-foreground">Your one commitment — not the whole list.</p>
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
                    disabled={didNext}
                    onClick={() => {
                      tasksApi.completeTask(userId, nextItem.item.id)
                      completeNext()
                    }}
                  >
                    Mark done
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    className="min-h-12 gap-2"
                    size="lg"
                    disabled={didNext}
                    onClick={() => {
                      habitsApi.toggleToday(userId, nextItem.item.id)
                      completeNext()
                    }}
                  >
                    Check in
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </>
          ) : (
            <>
              <h2 className="mt-2 font-display text-2xl tracking-tight">You’re set</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Nothing urgent right now — protect the calm, then ask what’s next.
              </p>
              <Button className="mt-5 min-h-12 gap-2" onClick={() => go('ask')}>
                Continue to Ask
                <ArrowRight className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      )}

      {step === 'ask' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">Ask can act</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your day guide already knows your plate — try the focus question, then confirm a chip.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild className="min-h-12 gap-2" size="lg">
              <Link to={ASK_FOCUS} onClick={() => go('invite')}>
                <Sparkles className="h-4 w-4" />
                What should I work on today?
              </Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Tap the chip Ask gives you — that’s the whole product in one move.
          </p>
        </div>
      )}

      {step === 'invite' && (
        <div className="relative">
          <h2 className="font-display text-2xl tracking-tight sm:text-3xl">One tap to Together</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Invite a friend or open Social — private life stays on this device.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <InviteFriendButton size="lg" />
            <Button asChild className="min-h-12" variant="secondary">
              <Link to="/social" onClick={finish}>
                Open Social
              </Link>
            </Button>
          </div>
          <Button variant="ghost" className="mt-3 min-h-11 text-muted-foreground" onClick={finish}>
            Enter Today without inviting
          </Button>
        </div>
      )}
    </motion.section>
  )
}
