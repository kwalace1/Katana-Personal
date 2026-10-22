import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Circle } from 'lucide-react'

export type TodayDayTask = {
  id: string
  title: string
  detail?: string
  trailing?: string
}

export type TodayDayHabit = {
  id: string
  title: string
  detail?: string
}

export type TodayDayEvent = {
  id: string
  title: string
  trailing: string
  to: string
}

type Row =
  | ({ kind: 'habit' } & TodayDayHabit)
  | ({ kind: 'task' } & TodayDayTask)
  | ({ kind: 'event' } & TodayDayEvent)

type Props = {
  tasks: TodayDayTask[]
  habits: TodayDayHabit[]
  events: TodayDayEvent[]
  onCompleteTask: (id: string) => void
  onCheckHabit: (id: string) => void
}

const LIMIT = 8

export function TodayDayList({ tasks, habits, events, onCompleteTask, onCheckHabit }: Props) {
  const rows: Row[] = [
    ...habits.map((habit) => ({ kind: 'habit' as const, ...habit })),
    ...tasks.map((task) => ({ kind: 'task' as const, ...task })),
    ...events.map((event) => ({ kind: 'event' as const, ...event })),
  ]
  const shown = rows.slice(0, LIMIT)
  const viewTo = tasks.length > 0 ? '/tasks' : events.length > 0 ? '/calendar' : '/habits'

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
        <h2 className="text-sm font-semibold tracking-tight">Your day</h2>
        {rows.length > 0 ? (
          <Link
            to={viewTo}
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            View all
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
      {shown.length === 0 ? (
        <p className="px-0.5 text-sm text-muted-foreground">Nothing scheduled today.</p>
      ) : (
        <div className="kp-surface divide-y">
          {shown.map((row) => {
            if (row.kind === 'event') {
              return (
                <Link
                  key={`event-${row.id}`}
                  to={row.to}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/40"
                >
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{row.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{row.trailing}</span>
                </Link>
              )
            }

            const href = row.kind === 'task' ? `/tasks?id=${row.id}` : `/habits?id=${row.id}`
            const actionLabel = row.kind === 'task' ? `Mark ${row.title} done` : `Check in ${row.title}`
            return (
              <div key={`${row.kind}-${row.id}`} className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  aria-label={actionLabel}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (row.kind === 'task') onCompleteTask(row.id)
                    else onCheckHabit(row.id)
                  }}
                >
                  <Circle className="h-4 w-4" />
                </button>
                <Link to={href} className="min-w-0 flex-1 py-0.5 hover:opacity-80">
                  <p className="truncate text-sm font-medium">{row.title}</p>
                  {row.detail ? (
                    <p className="truncate text-xs text-muted-foreground">{row.detail}</p>
                  ) : null}
                </Link>
                {row.kind === 'task' && row.trailing ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{row.trailing}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
