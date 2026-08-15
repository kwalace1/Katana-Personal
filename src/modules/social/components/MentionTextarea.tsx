import { useMemo } from 'react'
import { Textarea } from '@/components/ui/textarea'

export type MentionCandidate = { uid: string; name: string }

export function MentionTextarea({
  value,
  onChange,
  candidates,
  mentions,
  onMentionsChange,
  placeholder,
  rows = 3,
  maxLength,
  className,
}: {
  value: string
  onChange: (value: string) => void
  candidates: MentionCandidate[]
  mentions: MentionCandidate[]
  onMentionsChange: (mentions: MentionCandidate[]) => void
  placeholder?: string
  rows?: number
  maxLength?: number
  className?: string
}) {
  const query = /(?:^|\s)@([^@\n]*)$/.exec(value)?.[1]?.trim().toLowerCase() ?? null
  const suggestions = useMemo(() => {
    if (query == null) return []
    return candidates
      .filter((candidate) => candidate.name.toLowerCase().includes(query))
      .filter((candidate) => !mentions.some((mention) => mention.uid === candidate.uid))
      .slice(0, 6)
  }, [candidates, mentions, query])

  function updateText(next: string) {
    onChange(next)
    onMentionsChange(
      mentions.filter((mention) => next.toLowerCase().includes(`@${mention.name.toLowerCase()}`)),
    )
  }

  function pick(candidate: MentionCandidate) {
    const match = /(?:^|\s)@([^@\n]*)$/.exec(value)
    if (!match || match.index == null) return
    const prefix = value.slice(0, match.index)
    const leadingSpace = match[0].startsWith(' ') ? ' ' : ''
    const next = `${prefix}${leadingSpace}@${candidate.name} `
    onChange(next)
    onMentionsChange([...mentions, candidate])
  }

  return (
    <div className="relative">
      <Textarea
        value={value}
        onChange={(event) => updateText(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        className={className}
      />
      {suggestions.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-border/60 bg-card py-1 shadow-lg">
          {suggestions.map((candidate) => (
            <button
              key={candidate.uid}
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/70"
              onClick={() => pick(candidate)}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {candidate.name.slice(0, 2).toUpperCase()}
              </span>
              <span>@{candidate.name}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

