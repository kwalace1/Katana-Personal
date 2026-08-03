import { formatDateOnly } from '@/lib/due-date-utils'
"use client"

import { useMemo, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ChevronLeft, ChevronRight, Star, Target, Clock } from "lucide-react"
import {
  eventsByDateKey,
  type HrCalendarEvent,
  type HrCalendarEventType,
} from "@/lib/hr-member-scoped"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const EVENT_STYLE: Record<
  HrCalendarEventType,
  { dot: string; badge: "default" | "secondary" | "outline"; label: string }
> = {
  review: { dot: "bg-blue-500", badge: "default", label: "Review" },
  goal: { dot: "bg-amber-500", badge: "secondary", label: "Goal" },
  "time-off": { dot: "bg-green-500", badge: "outline", label: "Time off" },
  "next-review": { dot: "bg-purple-500", badge: "secondary", label: "Upcoming review" },
}

function pad(n: number) {
  return String(n).padStart(2, "0")
}

function formatHumanDate(dateKey: string) {
  return formatDateOnly(dateKey, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

interface HrEmployeeCalendarProps {
  events: HrCalendarEvent[]
}

export function HrEmployeeCalendar({ events }: HrEmployeeCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const byDate = useMemo(() => eventsByDateKey(events), [events])

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  ).getDate()
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  ).getDay()

  const dateKeyForDay = (day: number) =>
    `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(day)}`

  const selectedEvents = selectedDate ? byDate.get(selectedDate) ?? [] : []

  const todayKey = useMemo(() => {
    const t = new Date()
    return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  }, [])

  const upcoming = useMemo(
    () => events.filter((e) => e.dateKey >= todayKey).slice(0, 8),
    [events, todayKey]
  )

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your reviews, goals, time off, and scheduled review dates
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
              }
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
              }
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-foreground">
          {(Object.keys(EVENT_STYLE) as HrCalendarEventType[]).map((type) => (
            <span key={type} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${EVENT_STYLE[type].dot}`} />
              {EVENT_STYLE[type].label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[72px]" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const key = dateKeyForDay(day)
            const dayEvents = byDate.get(key) ?? []
            const isToday = key === todayKey
            const isSelected = selectedDate === key
            return (
              <button
                key={day}
                type="button"
                onClick={() => setSelectedDate(key)}
                className={`min-h-[72px] p-1.5 rounded-md border text-left transition-colors ${
                  isSelected
                    ? "border-primary bg-primary/5"
                    : isToday
                      ? "border-primary/40 bg-muted/30"
                      : "border-border/50 hover:bg-muted/40"
                }`}
              >
                <span className="text-sm font-medium">{day}</span>
                <div className="mt-1 space-y-0.5">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <div
                      key={ev.id}
                      className={`w-full h-1.5 rounded-full ${EVENT_STYLE[ev.type].dot}`}
                      title={ev.title}
                    />
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{dayEvents.length - 3}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </Card>

      {upcoming.length > 0 && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Coming up</h3>
          <div className="space-y-2">
            {upcoming.map((ev) => (
              <div key={ev.id} className="flex items-start gap-2 text-sm">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${EVENT_STYLE[ev.type].dot}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{formatHumanDate(ev.dateKey)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{selectedDate ? formatHumanDate(selectedDate) : "Day"}</SheetTitle>
            <SheetDescription>Events on this day for your account</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-3">
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled for this day.</p>
            ) : (
              selectedEvents.map((ev) => (
                <div key={ev.id} className="p-3 border rounded-lg">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {ev.type === "review" || ev.type === "next-review" ? (
                      <Star className="h-4 w-4 text-blue-500" />
                    ) : ev.type === "goal" ? (
                      <Target className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-green-500" />
                    )}
                    <Badge variant={EVENT_STYLE[ev.type].badge}>{EVENT_STYLE[ev.type].label}</Badge>
                    {ev.status && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {ev.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-medium">{ev.title}</p>
                  {ev.subtitle && (
                    <p className="text-xs text-muted-foreground mt-1">{ev.subtitle}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
