import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Sparkles, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { PlusPaywallSheet, usePlusStatus } from '@/components/PlusPaywall'
import { useAuth } from '@/contexts/AuthContext'
import { burstConfetti } from '@/lib/celebrate'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'
import {
  canUseLlmAsk,
  consumeLlmAsk,
  FREE_LLM_ASKS_PER_DAY,
  freeLlmAsksRemaining,
} from '@/lib/plus'
import {
  answerQuestionWithActions,
  buildSnapshot,
  runAskAction,
  suggestedAsksForHour,
  type AskReply,
} from '../engine'
import { resolveWithLlm } from '../llm'
import { askApi, type AskAction, type AskMessage } from '../ask-api'
import { createId } from '@/lib/id'
import { toast } from 'sonner'
import {
  ASK_PERSONALITIES,
  coachFollowUp,
  coachPlaceholder,
  coachThinkingLabel,
  parseAskPersonality,
  type AskPersonality,
} from '../personality'

export default function AskPage() {
  const { user, profile, updatePreferences } = useAuth()
  const userId = user!.id
  const name = profile?.display_name || 'there'
  const personality = parseAskPersonality(profile?.preferences)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)
  const [draft, setDraft] = useState('')
  const [spent, setSpent] = useState<Record<string, true>>({})
  const [pending, setPending] = useState(false)
  const [plusOpen, setPlusOpen] = useState(false)
  const [llmHint, setLlmHint] = useState<string | null>(null)
  const seededQ = useRef(false)
  const plus = usePlusStatus()

  const messages = useMemo(() => {
    void tick
    return askApi.list(userId)
  }, [userId, tick])

  const llmLeft = plus ? null : freeLlmAsksRemaining()
  const modeMeta = ASK_PERSONALITIES.find((p) => p.id === personality) || ASK_PERSONALITIES[0]!

  useEffect(() => {
    if (messages.length === 0) {
      const opening = answerQuestionWithActions(userId, 'briefing', name, personality)
      askApi.append(userId, { role: 'katana', text: opening.text, actions: opening.actions })
      refresh()
    }
  }, [userId, name, messages.length, personality])

  useEffect(() => {
    const q = searchParams.get('q')?.trim()
    if (!q || seededQ.current) return
    seededQ.current = true
    void ask(q)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams, userId, name])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, pending])

  function setPersonality(next: AskPersonality) {
    updatePreferences({ ask_personality: next })
    toast.message(`${ASK_PERSONALITIES.find((p) => p.id === next)?.label || 'Coach'} mode on`)
  }

  async function finalizeReply(question: string, reply: AskReply) {
    if (reply.useLlm) {
      if (!canUseLlmAsk()) {
        askApi.append(userId, {
          role: 'katana',
          text: `${reply.text}\n\n—\nYou’ve used today’s ${FREE_LLM_ASKS_PER_DAY} free deeper coach replies. Action chips still work; the Accountability pack unlocks unlimited depth.`,
          actions: [
            ...reply.actions.slice(0, 3),
            { id: createId(), label: 'Accountability pack', kind: 'open_route', route: '/settings#plus' },
          ],
        })
        setPlusOpen(true)
        refresh()
        return
      }
      setPending(true)
      setLlmHint(null)
      try {
        const snap = buildSnapshot(userId, name)
        const resolved = await resolveWithLlm(question, snap, reply, personality)
        const usedLlm = resolved.text !== reply.text
        if (usedLlm) {
          consumeLlmAsk()
          setLlmHint(null)
        } else {
          setLlmHint(
            'Deeper coach needs the Ask API key configured — showing a rules briefing instead (still useful).',
          )
        }
        askApi.append(userId, {
          role: 'katana',
          text: usedLlm
            ? resolved.text
            : `${resolved.text}\n\n—\nDeeper Ask isn’t available right now (no model key). This is a rules briefing — chips still act.`,
          actions: resolved.actions,
        })
      } finally {
        setPending(false)
      }
    } else {
      askApi.append(userId, { role: 'katana', text: reply.text, actions: reply.actions })
    }
    refresh()
  }

  async function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    askApi.append(userId, { role: 'you', text: trimmed })
    setDraft('')
    refresh()
    const reply = answerQuestionWithActions(userId, trimmed, name, personality)
    await finalizeReply(trimmed, reply)
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void ask(draft)
  }

  function onAction(action: AskAction, message: AskMessage) {
    const key = `${message.id}:${action.id}`
    if (spent[key]) return

    if (action.kind === 'open_route' && action.route) {
      navigate(action.route)
      return
    }
    const result = runAskAction(userId, action)
    if (result) {
      toast.success(result)
      askApi.consumeAction(userId, message.id, action.id)
      setSpent((s) => ({ ...s, [key]: true }))

      if (action.kind === 'complete_task' || action.kind === 'toggle_habit') {
        burstConfetti()
      }

      if (action.kind === 'close_day') {
        navigate('/dashboard')
        return
      }

      const hour = new Date().getHours()
      const inRitualInvite = (() => {
        try {
          return localStorage.getItem('katana-personal:ritual-step') === 'invite'
        } catch {
          return false
        }
      })()

      const followUps: AskAction[] = inRitualInvite
        ? [
            {
              id: createId(),
              label: 'Invite a friend',
              kind: 'open_route',
              route: '/dashboard',
            },
            {
              id: createId(),
              label: 'Open Social',
              kind: 'open_route',
              route: '/social',
            },
          ]
        : [
            {
              id: createId(),
              label: 'What’s next?',
              kind: 'open_route',
              route: '/ask?q=What%20should%20I%20work%20on%20today',
            },
            hour >= 17
              ? {
                  id: createId(),
                  label: 'Close my day',
                  kind: 'open_route',
                  route: '/ask?q=Close%20my%20day',
                }
              : {
                  id: createId(),
                  label: 'Invite a friend',
                  kind: 'open_route',
                  route: '/social?tab=friends',
                },
          ]

      askApi.append(userId, {
        role: 'katana',
        text: inRitualInvite
          ? `${result} One more tap — invite someone, or open Social.`
          : coachFollowUp(personality, result),
        actions: followUps,
      })
      refresh()
    }
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Accountability coach"
        title="Ask"
        description={`${modeMeta.label} mode — ${modeMeta.blurb}`}
        actions={
          messages.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
              disabled={pending}
              onClick={() => {
                askApi.clear(userId)
                setSpent({})
                seededQ.current = false
                const opening = answerQuestionWithActions(userId, 'briefing', name, personality)
                askApi.append(userId, { role: 'katana', text: opening.text, actions: opening.actions })
                refresh()
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear
            </Button>
          ) : null
        }
      />

      <section className="mb-4 overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-primary/[0.08] via-card/80 to-card/40 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Coach voice</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Pick how Ask talks to you. Deeper replies use this personality end-to-end.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {ASK_PERSONALITIES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPersonality(p.id)}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-xs font-semibold transition',
                    personality === p.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/80 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {llmLeft != null ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Deeper coach today: {llmLeft}/{FREE_LLM_ASKS_PER_DAY} free
          {llmLeft === 0 ? (
            <>
              {' · '}
              <button type="button" className="text-primary underline" onClick={() => setPlusOpen(true)}>
                Unlock Accountability pack
              </button>
            </>
          ) : null}
        </p>
      ) : (
        <p className="mb-3 text-xs text-primary">Accountability pack — unlimited deeper coach</p>
      )}
      {llmHint ? <p className="mb-3 text-xs text-muted-foreground">{llmHint}</p> : null}

      <div className="mb-5 flex flex-wrap gap-2">
        {messages.filter((m) => m.role === 'you').length === 0
          ? suggestedAsksForHour().map((prompt) => (
              <Button
                key={prompt}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                className="rounded-full"
                onClick={() => void ask(prompt)}
              >
                {prompt}
              </Button>
            ))
          : null}
      </div>

      <div
        className="mb-4 max-h-[min(52vh,28rem)] space-y-3 overflow-y-auto rounded-2xl border border-border/40 bg-card/30 p-4 sm:p-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'you' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap shadow-sm',
                m.role === 'you'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md border border-border/40 bg-background/90 text-foreground',
              )}
            >
              {m.role === 'katana' ? (
                <p className="mb-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-primary/80">
                  Katana · {modeMeta.label}
                </p>
              ) : null}
              {m.text}
              {m.role === 'katana' && m.actions.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.actions.map((action) => {
                    const key = `${m.id}:${action.id}`
                    const used = Boolean(spent[key])
                    return (
                      <Button
                        key={action.id}
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={used || pending}
                        className="min-h-11 rounded-full px-4 text-xs"
                        onClick={() => onAction(action, m)}
                      >
                        {used ? 'Done' : action.label}
                      </Button>
                    )
                  })}
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {pending ? (
          <div className="flex justify-start">
            <div className="rounded-[1.25rem] rounded-bl-md border border-border/40 bg-background/90 px-4 py-3 text-sm text-muted-foreground">
              {coachThinkingLabel(personality)}
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={coachPlaceholder(personality)}
          className="min-h-[52px] flex-1 resize-none"
          rows={2}
          disabled={pending}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void ask(draft)
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          className="h-[52px] w-[52px] shrink-0"
          aria-label="Send"
          disabled={pending || !draft.trim()}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>

      <PlusPaywallSheet open={plusOpen} onOpenChange={setPlusOpen} feature="llm" />
    </motion.div>
  )
}
