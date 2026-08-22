import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, Send, Sparkles, Trash2 } from 'lucide-react'
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
import { resolveAskAgent, historyToAskMessages } from '../llm'
import { askApi, type AskAction, type AskMessage } from '../ask-api'
import { createId } from '@/lib/id'
import { toast } from 'sonner'
import {
  ASK_PERSONALITIES,
  coachFollowUp,
  coachPlaceholder,
  coachThinkingLabel,
  parseAskPersonality,
} from '../personality'

const STARTER_PROMPTS = [
  'What should I work on today?',
  'Help me plan around my calendar',
  'How’s my week looking?',
  'Add gym tomorrow 7am',
] as const

export default function AskPage() {
  const { user, profile } = useAuth()
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
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  const [streamingId, setStreamingId] = useState<string | null>(null)
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
  const emptyChat = messages.filter((m) => m.role === 'you').length === 0
  const emptyPrompts = useMemo(() => {
    const hour = suggestedAsksForHour()
    const merged = [...hour, ...STARTER_PROMPTS]
    return [...new Set(merged)].slice(0, 6)
  }, [])

  function isCaptureReply(reply: AskReply): boolean {
    return reply.actions.some((a) => a.kind === 'create_task' || a.kind === 'create_event')
  }

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
  }, [messages.length, pending, tick, statusLabel])

  async function finalizeReply(question: string, reply: AskReply, prior: AskMessage[]) {
    const lastKatana = [...prior].reverse().find((m) => m.role === 'katana')
    const continueLlm = Boolean(lastKatana?.viaLlm) && !isCaptureReply(reply)
    const useLlm = Boolean(reply.useLlm || continueLlm)

    if (!useLlm) {
      askApi.append(userId, { role: 'katana', text: reply.text, actions: reply.actions })
      refresh()
      return
    }

    if (!canUseLlmAsk()) {
      askApi.append(userId, {
        role: 'katana',
        text: `${reply.text}\n\n—\nYou’ve used today’s ${FREE_LLM_ASKS_PER_DAY} free deeper Ask replies. Action chips still work; the Accountability pack unlocks unlimited depth.`,
        actions: [
          ...reply.actions.slice(0, 3),
          {
            id: createId(),
            label: 'Accountability pack',
            kind: 'open_route',
            route: '/settings#plus',
          },
        ],
      })
      setPlusOpen(true)
      refresh()
      return
    }

    setPending(true)
    setLlmHint(null)
    setStatusLabel('Thinking…')
    const placeholder = askApi.append(userId, {
      role: 'katana',
      text: '',
      actions: [],
      viaLlm: true,
    })
    setStreamingId(placeholder.id)
    refresh()

    let acc = ''
    try {
      const snap = buildSnapshot(userId, name)
      const history = historyToAskMessages(
        prior
          .filter((m) => m.id !== placeholder.id)
          .map((m) => ({
            role: m.role === 'you' ? ('you' as const) : ('katana' as const),
            text: m.text,
          })),
      )

      const resolved = await resolveAskAgent(userId, question, snap, reply, {
        personality,
        history,
        handlers: {
          onStatus: (label) => {
            setStatusLabel(label)
            if (!acc) {
              askApi.update(userId, placeholder.id, { text: label })
              refresh()
            }
          },
          onDelta: (delta) => {
            setStatusLabel(null)
            if (!acc) acc = delta
            else acc += delta
            askApi.update(userId, placeholder.id, { text: acc })
            refresh()
          },
        },
      })

      if (resolved.usedLlm) {
        consumeLlmAsk()
        setLlmHint(null)
        askApi.update(userId, placeholder.id, {
          text: resolved.text,
          actions: resolved.actions,
          viaLlm: true,
        })
      } else {
        setLlmHint(
          'Deeper Ask needs the Ask API key configured — showing a rules briefing instead (still useful).',
        )
        askApi.update(userId, placeholder.id, {
          text: `${resolved.text}\n\n—\nDeeper Ask isn’t available right now (no model key). This is a rules briefing — chips still act.`,
          actions: resolved.actions,
          viaLlm: false,
        })
      }
    } finally {
      setStreamingId(null)
      setStatusLabel(null)
      setPending(false)
      refresh()
    }
  }

  async function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed || pending) return
    const prior = askApi.list(userId)
    askApi.append(userId, { role: 'you', text: trimmed })
    setDraft('')
    refresh()
    const reply = answerQuestionWithActions(userId, trimmed, name, personality)
    await finalizeReply(trimmed, reply, prior)
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

  function clearChat() {
    askApi.clear(userId)
    setSpent({})
    seededQ.current = false
    const opening = answerQuestionWithActions(userId, 'briefing', name, personality)
    askApi.append(userId, {
      role: 'katana',
      text: opening.text,
      actions: opening.actions,
    })
    refresh()
  }

  return (
    <motion.div
      {...pageEnterSubtle}
      className="kp-page relative mx-auto flex h-[calc(100dvh-3.75rem)] max-w-2xl flex-col overflow-hidden !py-4 md:h-[100dvh] md:!py-6 lg:!py-6"
    >
      <div
        className="pointer-events-none absolute -right-24 -top-16 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-20 top-40 h-48 w-48 rounded-full bg-[hsl(200_40%_50%/0.12)] blur-3xl"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col">
        <PageHeader
          className="mb-3 shrink-0 sm:mb-4"
          eyebrow="Life-aware AI"
          title="Ask"
          description="Sees your tasks, calendar, habits, and goals — and can act on them."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm" className="rounded-full text-xs">
                <Link to="/settings#ask-coach">Voice · {modeMeta.label}</Link>
              </Button>
              {messages.length > 1 ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  disabled={pending}
                  onClick={clearChat}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          {llmLeft != null ? (
            <p>
              Deeper Ask: {llmLeft}/{FREE_LLM_ASKS_PER_DAY} free today
              {llmLeft === 0 ? (
                <>
                  {' · '}
                  <button
                    type="button"
                    className="text-primary underline"
                    onClick={() => setPlusOpen(true)}
                  >
                    Unlock pack
                  </button>
                </>
              ) : null}
            </p>
          ) : (
            <p className="inline-flex items-center gap-1.5 text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Accountability pack · unlimited depth
            </p>
          )}
          <p className="text-muted-foreground/80">{modeMeta.blurb}</p>
        </div>
        {llmHint ? <p className="mb-2 shrink-0 text-xs text-muted-foreground">{llmHint}</p> : null}

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-border/50 bg-gradient-to-b from-card/95 via-background/85 to-card/60 shadow-[0_20px_50px_-28px_hsl(200_25%_10%/0.35)]">
          <div className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-3 sm:px-5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Sparkles className="h-4 w-4" />
              {pending ? (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-primary ring-2 ring-background" />
              ) : null}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">Katana Ask</p>
              <p className="truncate text-[0.7rem] text-muted-foreground">
                {pending
                  ? statusLabel || coachThinkingLabel(personality)
                  : `${modeMeta.label} · sees your life data`}
              </p>
            </div>
            {pending ? (
              <span className="hidden rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-medium text-primary sm:inline">
                Working
              </span>
            ) : null}
          </div>

          <div
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((m) => {
              const isStreaming = m.id === streamingId
              const showStatusOnly = isStreaming && !m.text
              return (
                <div
                  key={m.id}
                  className={cn('flex gap-2.5', m.role === 'you' ? 'justify-end' : 'justify-start')}
                >
                  {m.role === 'katana' ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                    </span>
                  ) : null}
                  <div
                    className={cn(
                      'max-w-[min(92%,28rem)] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'you'
                        ? 'rounded-2xl rounded-br-md bg-primary text-primary-foreground shadow-sm'
                        : 'rounded-2xl rounded-bl-md border border-border/50 bg-background/90 text-foreground shadow-[0_1px_0_hsl(200_20%_10%/0.04)]',
                    )}
                  >
                    {m.role === 'katana' && m.viaLlm && !isStreaming ? (
                      <p className="mb-2 inline-flex items-center gap-1 text-[0.65rem] font-medium uppercase tracking-[0.12em] text-primary/80">
                        <CheckCircle2 className="h-3 w-3" />
                        Deeper reply
                      </p>
                    ) : null}
                    {showStatusOnly ? (
                      <span className="text-muted-foreground">
                        {statusLabel || coachThinkingLabel(personality)}
                      </span>
                    ) : (
                      m.text
                    )}
                    {isStreaming && m.text ? (
                      <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse rounded-sm bg-primary/70 align-middle" />
                    ) : null}
                    {m.role === 'katana' && m.actions.length > 0 && !isStreaming ? (
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
                              className="min-h-10 rounded-full px-3.5 text-xs"
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
              )
            })}

            {emptyChat ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {emptyPrompts.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    className="rounded-full border border-border/40 bg-background/70"
                    onClick={() => void ask(prompt)}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="shrink-0 border-t border-border/40 bg-background/75 p-3 backdrop-blur-sm sm:p-3.5"
          >
            <div className="flex gap-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={coachPlaceholder(personality)}
                className="min-h-[3rem] flex-1 resize-none border-border/50 bg-card/85"
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
                className="h-[3rem] w-[3rem] shrink-0 self-end rounded-2xl"
                aria-label="Send"
                disabled={pending || !draft.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </div>
      </div>

      <PlusPaywallSheet open={plusOpen} onOpenChange={setPlusOpen} feature="llm" />
    </motion.div>
  )
}
