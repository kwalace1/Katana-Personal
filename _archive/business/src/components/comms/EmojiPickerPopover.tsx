import { useState } from 'react'
import { Smile } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EMOJI_CATEGORIES, QUICK_REACTIONS } from '@/lib/comms-emojis'

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void
  triggerClassName?: string
}

export function EmojiPickerPopover({ onSelect, triggerClassName }: EmojiPickerPopoverProps) {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState(0)

  const handleSelect = (emoji: string) => {
    onSelect(emoji)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 text-muted-foreground hover:text-foreground ${triggerClassName ?? ''}`}
          title="Add emoji"
        >
          <Smile className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start" side="top">
        <div className="flex gap-1 mb-2 flex-wrap">
          {QUICK_REACTIONS.map(emoji => (
            <button
              key={emoji}
              type="button"
              className="text-xl p-1.5 rounded hover:bg-muted transition-colors"
              onClick={() => handleSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="flex gap-1 mb-2 border-b border-border pb-2">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={cat.label}
              type="button"
              className={`text-xs px-2 py-1 rounded ${
                category === i ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              }`}
              onClick={() => setCategory(i)}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <ScrollArea className="h-40">
          <div className="flex flex-wrap gap-0.5 pr-2">
            {EMOJI_CATEGORIES[category]?.emojis.map(emoji => (
              <button
                key={emoji}
                type="button"
                className="text-xl p-1 rounded hover:bg-muted transition-colors"
                onClick={() => handleSelect(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
