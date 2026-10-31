import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { CALENDAR_ITEM_COLORS, type CalendarItemType } from '@/theme/functional'
import {
  CALENDAR_COLOR_SWATCHES,
  CALENDAR_ITEM_TYPES,
  defaultCalendarItemColors,
  normalizeCalendarHex,
  type CalendarItemColors,
} from '../item-colors'

const LABELS: Record<CalendarItemType, string> = {
  event: 'Events',
  task: 'Tasks',
  goal: 'Goals',
  habit: 'Habits',
}

function sameHex(a: string, b: string) {
  return a.toUpperCase() === b.toUpperCase()
}

function TypeMark({ kind, color }: { kind: CalendarItemType; color: string }) {
  const base = 'kp-type-mark inline-block h-2.5 w-2.5 shrink-0'
  if (kind === 'task') return <span className={cn(base, 'rounded-[2px]')} style={{ background: color }} />
  if (kind === 'goal') return <span className={cn(base, 'rotate-45 rounded-[2px]')} style={{ background: color }} />
  if (kind === 'habit') {
    return <span className={cn(base, 'rounded-full border-2')} style={{ borderColor: color }} />
  }
  return <span className={cn(base, 'rounded-full')} style={{ background: color }} />
}

export function CalendarColorLegend({ colors }: { colors: CalendarItemColors }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground" aria-label="Calendar colors">
      {CALENDAR_ITEM_TYPES.map((kind) => (
        <span key={kind} className="inline-flex items-center gap-1.5">
          <TypeMark kind={kind} color={colors[kind]} />
          {LABELS[kind]}
        </span>
      ))}
    </div>
  )
}

export function CalendarColorSettings({
  colors,
  onChange,
}: {
  colors: CalendarItemColors
  onChange: (next: CalendarItemColors) => void
}) {
  const [drafts, setDrafts] = useState<Partial<Record<CalendarItemType, string>>>({})
  const allDefault = CALENDAR_ITEM_TYPES.every((kind) => sameHex(colors[kind], CALENDAR_ITEM_COLORS[kind]))

  function setKind(kind: CalendarItemType, hex: string) {
    onChange({ ...colors, [kind]: hex })
  }

  return (
    <Collapsible className="border-t border-border pt-3">
      <div className="flex items-center justify-between gap-2">
        <CollapsibleTrigger
          type="button"
          className="text-xs font-medium text-foreground outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          Change colors
        </CollapsibleTrigger>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          disabled={allDefault}
          onClick={() => onChange(defaultCalendarItemColors())}
        >
          Reset all
        </Button>
      </div>
      <CollapsibleContent className="space-y-3 pt-3">
        {CALENDAR_ITEM_TYPES.map((kind) => {
          const current = colors[kind]
          const draft = drafts[kind]
          const shown = draft ?? current
          const invalid = draft != null && draft !== '' && normalizeCalendarHex(draft) == null
          const isDefault = sameHex(current, CALENDAR_ITEM_COLORS[kind])
          return (
            <div key={kind} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <TypeMark kind={kind} color={current} />
                <span className="min-w-0 flex-1 text-xs text-foreground">{LABELS[kind]}</span>
                <input
                  type="color"
                  aria-label={`Custom ${LABELS[kind]} color`}
                  value={current.toLowerCase()}
                  className="h-8 w-9 cursor-pointer rounded-md border border-border bg-card p-0.5"
                  onChange={(event) => {
                    const hex = normalizeCalendarHex(event.target.value)
                    if (hex) setKind(kind, hex)
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  disabled={isDefault}
                  onClick={() => {
                    setKind(kind, CALENDAR_ITEM_COLORS[kind])
                    setDrafts((prev) => {
                      const next = { ...prev }
                      delete next[kind]
                      return next
                    })
                  }}
                >
                  Reset
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${LABELS[kind]} swatches`}>
                {CALENDAR_COLOR_SWATCHES.map((hex) => {
                  const selected = sameHex(current, hex)
                  return (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`${LABELS[kind]} ${hex}`}
                      aria-pressed={selected}
                      className={cn(
                        'kp-type-mark h-5 w-5 rounded-full border border-border outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]',
                        selected && 'ring-2 ring-ring ring-offset-2 ring-offset-popover',
                      )}
                      style={{ background: hex }}
                      onClick={() => setKind(kind, hex)}
                    />
                  )
                })}
              </div>
              <Input
                value={shown}
                spellCheck={false}
                maxLength={7}
                aria-label={`${LABELS[kind]} hex`}
                aria-invalid={invalid || undefined}
                className="h-8 font-mono text-xs uppercase"
                onChange={(event) => {
                  const value = event.target.value
                  setDrafts((prev) => ({ ...prev, [kind]: value }))
                  const hex = normalizeCalendarHex(value)
                  if (hex) setKind(kind, hex)
                }}
                onBlur={() => {
                  setDrafts((prev) => {
                    const next = { ...prev }
                    delete next[kind]
                    return next
                  })
                }}
              />
              {invalid ? (
                <p className="text-xs text-destructive">Use a color like #3673CC.</p>
              ) : null}
            </div>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}
