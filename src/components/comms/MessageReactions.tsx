import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { ReactionSummary } from '@/lib/comms-api'
import { QUICK_REACTIONS } from '@/lib/comms-emojis'

interface MessageReactionsProps {
  summaries: ReactionSummary[]
  onToggle: (emoji: string) => void
}

export function MessageReactions({ summaries, onToggle }: MessageReactionsProps) {
  const [pickerOpen, setPickerOpen] = useState(false)

  if (summaries.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {summaries.map(s => (
        <button
          key={s.emoji}
          type="button"
          onClick={() => onToggle(s.emoji)}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-all duration-150 ${
            s.reactedByMe
              ? 'bg-primary/15 border-primary/40 text-primary shadow-sm'
              : 'bg-muted/60 border-border/70 hover:bg-muted hover:border-border'
          }`}
          title={`${s.count} reaction${s.count === 1 ? '' : 's'}`}
        >
          <span>{s.emoji}</span>
          <span className="font-medium tabular-nums">{s.count}</span>
        </button>
      ))}
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1" align="start">
          <div className="flex gap-0.5">
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                type="button"
                className="text-lg p-1.5 rounded hover:bg-muted"
                onClick={() => {
                  onToggle(emoji)
                  setPickerOpen(false)
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
