import { format, isSameDay, isToday, todayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { agendaForDay, type AgendaItem, type AgendaKind } from '../agenda'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const KIND_LABEL: Record<AgendaKind, [string, string]> = {
  event: ['event', 'events'],
  task: ['task', 'tasks'],
  goal: ['goal', 'goals'],
  habit: ['habit', 'habits'],
  circle: ['circle event', 'circle events'],
}

function describeDay(day: Date, items: AgendaItem[]) {
  const parts = (Object.keys(KIND_LABEL) as AgendaKind[])
    .map((kind) => {
      const count = items.filter((item) => item.kind === kind).length
      if (count === 0) return null
      const [one, many] = KIND_LABEL[kind]
      return `${count} ${count === 1 ? one : many}`
    })
    .filter((part): part is string => Boolean(part))
  const date = format(day, 'EEEE, MMMM d')
  return parts.length > 0 ? `${date}, ${parts.join(', ')}` : date
}

type DayMark = { key: string; color: string; kind: AgendaKind }

/**
 * At most two type marks. Habits stay behind other types so a daily habit does not cover an event.
 * +N is the number of items whose type is not one of those marks, so extra items of a shown type are not counted again.
 */
function dayMarks(items: AgendaItem[]): { shown: DayMark[]; overflow: number } {
  const seen = new Set<AgendaKind>()
  const marks: DayMark[] = []
  const ordered = [...items].sort((a, b) => {
    const rank = (kind: AgendaKind) => (kind === 'habit' ? 1 : 0)
    return rank(a.kind) - rank(b.kind) || a.starts_at.localeCompare(b.starts_at)
  })
  for (const item of ordered) {
    if (seen.has(item.kind)) continue
    seen.add(item.kind)
    marks.push({ key: item.kind, color: item.color, kind: item.kind })
  }
  const shown = marks.slice(0, 2)
  const shownKinds = new Set(shown.map((mark) => mark.kind))
  return {
    shown,
    overflow: items.filter((item) => !shownKinds.has(item.kind)).length,
  }
}

function DayMarkGlyph({ mark }: { mark: DayMark }) {
  const base = 'kp-type-mark inline-block h-1.5 w-1.5 shrink-0'
  if (mark.kind === 'task') {
    return <span className={cn(base, 'rounded-[1px]')} style={{ background: mark.color }} />
  }
  if (mark.kind === 'goal') {
    return <span className={cn(base, 'rotate-45 rounded-[1px]')} style={{ background: mark.color }} />
  }
  if (mark.kind === 'habit') {
    return <span className={cn(base, 'rounded-full border border-current')} style={{ color: mark.color }} />
  }
  if (mark.kind === 'circle') {
    return <span className={cn(base, 'rounded-full border-2')} style={{ borderColor: mark.color }} />
  }
  return <span className={cn(base, 'rounded-full')} style={{ background: mark.color }} />
}

function DayIndicators({ items }: { items: AgendaItem[] }) {
  const { shown, overflow } = dayMarks(items)
  if (shown.length === 0) return <span className="mt-1 block h-4" aria-hidden="true" />
  return (
    <span className="mt-1 flex h-4 items-center gap-0.5" aria-hidden="true">
      {shown.map((mark) => (
        <DayMarkGlyph key={mark.key} mark={mark} />
      ))}
      {overflow > 0 ? <span className="text-[0.65rem] leading-none text-muted-foreground">+{overflow}</span> : null}
    </span>
  )
}

export function CalendarGrid({
  days,
  selectedDay,
  viewMonth,
  compact,
  muteOutsideMonth = true,
  onSelectDay,
  agenda,
}: {
  days: Date[]
  selectedDay: Date
  /** Month being displayed; days outside it are muted. */
  viewMonth: Date
  compact?: boolean
  muteOutsideMonth?: boolean
  onSelectDay: (day: Date) => void
  agenda: AgendaItem[]
}) {
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayItems = agendaForDay(agenda, day)
          const selected = isSameDay(day, selectedDay)
          const outside = muteOutsideMonth && day.getMonth() !== viewMonth.getMonth()
          return (
            <button
              key={todayKey(day)}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={selected}
              aria-label={describeDay(day, dayItems)}
              className={cn(
                'flex flex-col text-left transition',
                compact ? 'min-h-11 p-1 sm:min-h-14' : 'min-h-16 p-1.5 sm:min-h-24',
                selected ? 'kp-day-selected bg-primary/10' : 'hover:bg-secondary/50',
                outside && 'kp-outside-day opacity-40',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold leading-none',
                  selected && 'bg-primary text-primary-foreground',
                  isToday(day) && !selected && 'text-primary',
                )}
              >
                {format(day, 'd')}
              </span>
              <DayIndicators items={dayItems} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

