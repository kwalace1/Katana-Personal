import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

function calendarOrigin(params: URLSearchParams): Record<string, string> {
  if (params.get('from') !== 'calendar') return {}
  const date = params.get('date')
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return { from: 'calendar', date }
  return { from: 'calendar' }
}

export function calendarReturnTo(params: URLSearchParams) {
  const origin = calendarOrigin(params)
  if (!origin.from) return null
  return origin.date ? `/calendar?date=${origin.date}` : '/calendar'
}

/** Keep the calendar return path when this page updates its own query. */
export function withCalendarOrigin(params: URLSearchParams, next: Record<string, string> = {}) {
  return { ...next, ...calendarOrigin(params) }
}

export function CalendarReturnLink() {
  const [params] = useSearchParams()
  const href = calendarReturnTo(params)
  if (!href) return null
  return (
    <Button asChild type="button" variant="ghost" size="sm" className="-ml-2 mb-2 gap-1.5 px-2">
      <Link to={href}>
        <ArrowLeft className="h-4 w-4" />
        Calendar
      </Link>
    </Button>
  )
}
