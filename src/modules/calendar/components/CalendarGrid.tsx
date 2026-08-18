import { format, isSameDay, isToday, todayKey } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { agendaForDay, type AgendaItem } from '../agenda'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayTaskCount(items: AgendaItem[]) {
  return items.filter((item) => item.kind === 'task').length
}

function uniqueDots(items: AgendaItem[], max = 3) {
  const seen = new Set<string>()
  const dots: { color: string; key: string }[] = []
  for (const item of items) {
    const key = `${item.kind}-${item.color}`
    if (seen.has(key)) continue
    seen.add(key)
    dots.push({ color: item.color, key })
    if (dots.length >= max) break
  }
  return dots
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
      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const dayItems = agendaForDay(agenda, day)
          const tasks = dayTaskCount(dayItems)
          const selected = isSameDay(day, selectedDay)
          const outside = muteOutsideMonth && day.getMonth() !== viewMonth.getMonth()
          const dots = uniqueDots(dayItems)
          return (
            <button
              key={todayKey(day)}
              type="button"
              onClick={() => onSelectDay(day)}
              aria-pressed={selected}
              aria-label={`${format(day, 'EEEE, MMMM d')}${
                tasks > 0 ? `, ${tasks} ${tasks === 1 ? 'task' : 'tasks'}` : ''
              }`}
              className={cn(
                'flex flex-col rounded-lg border p-1.5 text-left transition',
                compact ? 'min-h-[4.25rem] sm:min-h-[4.75rem]' : 'min-h-[5.25rem] sm:min-h-[6.5rem]',
                selected
                  ? 'border-primary bg-primary/10'
                  : 'border-border/50 bg-card/40 hover:border-primary/40',
                isToday(day) && !selected && 'ring-1 ring-primary/30',
                outside && 'opacity-40',
              )}
            >
              <span
                className={cn(
                  'text-xs font-semibold leading-none',
                  isToday(day) && 'text-primary',
                )}
              >
                {format(day, 'd')}
              </span>
              {tasks > 0 ? (
                <span className="mt-1 text-[0.65rem] font-semibold leading-tight text-primary">
                  {tasks}
                  <span className="hidden sm:inline"> {tasks === 1 ? 'task' : 'tasks'}</span>
                </span>
              ) : dayItems.length > 0 ? (
                <span className="mt-1 text-[0.65rem] leading-tight text-muted-foreground">
                  {dayItems.length}
                </span>
              ) : null}
              {dots.length > 0 ? (
                <span className="mt-auto flex gap-0.5 pt-1">
                  {dots.map((dot) => (
                    <span
                      key={dot.key}
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: dot.color }}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DayWeekStrip({
  days,
  selectedDay,
  agenda,
  onSelectDay,
}: {
  days: Date[]
  selectedDay: Date
  agenda: AgendaItem[]
  onSelectDay: (day: Date) => void
}) {
  return (
    <div className="mb-4 grid grid-cols-7 gap-1">
      {days.map((day) => {
        const dayItems = agendaForDay(agenda, day)
        const tasks = dayTaskCount(dayItems)
        const selected = isSameDay(day, selectedDay)
        return (
          <button
            key={todayKey(day)}
            type="button"
            onClick={() => onSelectDay(day)}
            className={cn(
              'rounded-lg border px-1 py-2 text-center transition',
              selected
                ? 'border-primary bg-primary/10'
                : 'border-border/50 bg-card/40 hover:border-primary/40',
              isToday(day) && !selected && 'ring-1 ring-primary/30',
            )}
          >
            <p className="text-[0.65rem] font-semibold uppercase text-muted-foreground">
              {format(day, 'EEE')}
            </p>
            <p className={cn('font-display text-lg leading-none', isToday(day) && 'text-primary')}>
              {format(day, 'd')}
            </p>
            {tasks > 0 ? (
              <p className="mt-1 text-[0.65rem] font-semibold text-primary">{tasks}</p>
            ) : dayItems.length > 0 ? (
              <p className="mt-1 text-[0.65rem] text-muted-foreground">{dayItems.length}</p>
            ) : (
              <p className="mt-1 text-[0.65rem] text-transparent">0</p>
            )}
          </button>
        )
      })}
    </div>
  )
}
