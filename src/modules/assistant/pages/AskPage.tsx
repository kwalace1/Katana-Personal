import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Send, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { pageEnterSubtle } from '@/lib/motion-ui'
import { cn } from '@/lib/utils'
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

export default function AskPage() {
  const { user, profile } = useAuth()
  const userId = user!.id
  const name = profile?.display_name || 'there'
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const bottomRef = useRef<HTMLDivElement>(null)
  const [tick, setTick] = useState(0)
  const refresh = () => setTick((n) => n + 1)
  const [draft, setDraft] = useState('')
  const [spent, setSpent] = useState<Record<string, true>>({})
  const [pending, setPending] = useState(false)
  const seededQ = useRef(false)

  const messages = useMemo(() => {
    void tick
    return askApi.list(userId)
  }, [userId, tick])

  useEffect(() => {
    if (messages.length === 0) {
      const opening = answerQuestionWithActions(userId, 'briefing', name)
      askApi.append(userId, { role: 'katana', text: opening.text, actions: opening.actions })
      refresh()
    }
  }, [userId, name, messages.length])

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

  async function finalizeReply(question: string, reply: AskReply) {
    if (reply.useLlm) {
      setPending(true)
      try {
        const snap = buildSnapshot(userId, name)
        const resolved = await resolveWithLlm(question, snap, reply)
        askApi.append(userId, { role: 'katana', text: resolved.text, actions: resolved.actions })
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
    const reply = answerQuestionWithActions(userId, trimmed, name)
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
      const hour = new Date().getHours()
      const followUps: AskAction[] = [
        {
          id: createId(),
          label: 'What’s next?',
          kind: 'open_route',
          route: '/ask?q=What%20should%20I%20work%20on%20today',
        },
      ]
      if (hour >= 17) {
        followUps.push({
          id: createId(),
          label: 'Close my day',
          kind: 'open_route',
          route: '/ask?q=Close%20my%20day',
        })
      } else {
        followUps.push({
          id: createId(),
          label: 'Invite a friend',
          kind: 'open_route',
          route: '/friends',
        })
      }
      askApi.append(userId, {
        role: 'katana',
        text: `${result} What’s next?`,
        actions: followUps,
      })
      refresh()
    }
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Day guide"
        title="Ask"
        description="Day guide that knows your plate — and can draft small actions you confirm."
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
                const opening = answerQuestionWithActions(userId, 'briefing', name)
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

      <div className="mb-5 flex flex-wrap gap-2">
        {messages.filter((m) => m.role === 'you').length === 0
          ? suggestedAsksForHour().map((prompt) => (
              <Button
                key={prompt}
                type="button"
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => void ask(prompt)}
              >
                {prompt}
              </Button>
            ))
          : null}
      </div>

      <div
        className="kp-surface mb-4 max-h-[52vh] space-y-3 overflow-y-auto p-4 sm:p-5"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.role === 'you' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[92%] rounded-[1.25rem] px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                m.role === 'you'
                  ? 'rounded-br-md bg-primary text-primary-foreground'
                  : 'rounded-bl-md bg-secondary/70 text-foreground',
              )}
            >
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
            <div className="rounded-[1.25rem] rounded-bl-md bg-secondary/70 px-4 py-3 text-sm text-muted-foreground">
              Thinking…
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your day, or “add gym tomorrow”…"
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
    </motion.div>
  )
}
