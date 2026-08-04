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
import { answerQuestionWithActions, runAskAction, suggestedAsksForHour } from '../engine'
import { askApi, type AskAction, type AskMessage } from '../ask-api'
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
    askApi.append(userId, { role: 'you', text: q })
    const reply = answerQuestionWithActions(userId, q, name)
    askApi.append(userId, { role: 'katana', text: reply.text, actions: reply.actions })
    setSearchParams({}, { replace: true })
    refresh()
  }, [searchParams, setSearchParams, userId, name])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function ask(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    askApi.append(userId, { role: 'you', text: trimmed })
    const reply = answerQuestionWithActions(userId, trimmed, name)
    askApi.append(userId, { role: 'katana', text: reply.text, actions: reply.actions })
    setDraft('')
    refresh()
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    ask(draft)
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
      askApi.append(userId, {
        role: 'katana',
        text: result,
        actions: [],
      })
      refresh()
    }
  }

  return (
    <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Day guide"
        title="Ask"
        description="A quiet guide that already knows what’s on your plate — and can take action."
        actions={
          messages.length > 1 ? (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5"
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
        {suggestedAsksForHour().map((prompt) => (
          <Button key={prompt} type="button" size="sm" variant="outline" onClick={() => ask(prompt)}>
            {prompt}
          </Button>
        ))}
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
                        disabled={used}
                        className="h-8 rounded-full text-xs"
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
        <div ref={bottomRef} />
      </div>

      <form onSubmit={onSubmit} className="flex gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask about your day, or “add gym tomorrow”…"
          className="min-h-[52px] flex-1 resize-none"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              ask(draft)
            }
          }}
        />
        <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </motion.div>
  )
}
