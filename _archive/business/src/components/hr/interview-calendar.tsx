import { formatDateOnly } from '@/lib/due-date-utils'
"use client"

import { useState, useMemo } from "react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  GripVertical,
  Calendar as CalendarIcon,
  Clock,
  User,
} from "lucide-react"
import { scheduleInterview } from "@/lib/recruitment-db"
import { useToast } from "@/hooks/use-toast"

/**
 * Minimal shape we need from a job application to render an interview on the
 * calendar. Matches the fields that `getAllApplications()` already returns.
 */
export interface CalendarApplication {
  id?: string | null
  anonymousId?: string | null
  firstName?: string | null
  lastName?: string | null
  jobTitle?: string | null
  department?: string | null
  status?: string | null
  interviewDate?: string | null
  isRevealed?: boolean | null
  notes?: string | null
}

interface InterviewCalendarProps {
  applications: CalendarApplication[]
  /** Open the parent's "Schedule Interview" dialog with date pre-filled. */
  onScheduleNew: (dateISO: string) => void
  /** Open the parent's "Schedule Interview" dialog in edit-mode for this app. */
  onEditInterview: (app: CalendarApplication) => void
  /** Open the parent's candidate detail modal. */
  onViewCandidate: (app: CalendarApplication) => void
  /** Refresh `applications` from the source after a reschedule. */
  onRefresh: () => Promise<void> | void
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const WEEKDAYS = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
]

export function InterviewCalendar({
  applications,
  onScheduleNew,
  onEditInterview,
  onViewCandidate,
  onRefresh,
}: InterviewCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("scheduled")
  const [draggedApp, setDraggedApp] = useState<CalendarApplication | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const { toast } = useToast()

  // Only count applications that actually have an interview date.
  const interviews = useMemo(() => {
    return applications.filter((a) => !!a.interviewDate)
  }, [applications])

  const filteredInterviews = useMemo(() => {
    if (statusFilter === "all") return interviews
    if (statusFilter === "scheduled") {
      return interviews.filter(
        (a) => a.status === "interview-scheduled" || a.status === "interviewed",
      )
    }
    return interviews.filter((a) => a.status === statusFilter)
  }, [interviews, statusFilter])

  // Group interviews by YYYY-MM-DD for fast cell lookup.
  const interviewsByDate = useMemo(() => {
    const map = new Map<string, CalendarApplication[]>()
    for (const app of filteredInterviews) {
      if (!app.interviewDate) continue
      const dateKey = toDateKey(app.interviewDate)
      if (!dateKey) continue
      const list = map.get(dateKey) ?? []
      list.push(app)
      map.set(dateKey, list)
    }
    return map
  }, [filteredInterviews])

  const daysInMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0,
  ).getDate()
  const firstDayOfMonth = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1,
  ).getDay()

  const previousMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  const nextMonth = () =>
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  const goToToday = () => setCurrentDate(new Date())

  const dateKeyForDay = (day: number) =>
    `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(day)}`

  const handleCellClick = (day: number) => {
    setSelectedDate(dateKeyForDay(day))
  }

  const handleAddForSelectedDate = () => {
    if (selectedDate) {
      onScheduleNew(selectedDate)
      setSelectedDate(null)
    }
  }

  const handleDragStart = (e: React.DragEvent, app: CalendarApplication) => {
    setDraggedApp(app)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggedApp(null)
    setDragOverDate(null)
  }

  const handleDragOver = (e: React.DragEvent, day: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverDate(dateKeyForDay(day))
  }

  const handleDragLeave = () => setDragOverDate(null)

  const handleDrop = async (e: React.DragEvent, day: number) => {
    e.preventDefault()
    setDragOverDate(null)

    if (!draggedApp || !draggedApp.id) {
      setDraggedApp(null)
      return
    }

    const newDate = dateKeyForDay(day)
    const previousKey = draggedApp.interviewDate
      ? toDateKey(draggedApp.interviewDate)
      : null
    if (previousKey === newDate) {
      setDraggedApp(null)
      return
    }

    // Preserve the original time-of-day when rescheduling.
    const newDateTime = preserveTimeOfDay(draggedApp.interviewDate, newDate)

    try {
      const ok = await scheduleInterview(draggedApp.id, newDateTime)
      if (!ok) throw new Error("scheduleInterview returned false")

      await onRefresh()
      toast({
        title: "Interview rescheduled",
        description: `${candidateLabel(draggedApp)} → ${formatHumanDate(newDate)}`,
      })
    } catch (err) {
      console.error("[InterviewCalendar] Reschedule failed:", err)
      toast({
        title: "Could not reschedule",
        description: "The interview could not be moved. Please try again.",
        variant: "destructive",
      })
    } finally {
      setDraggedApp(null)
    }
  }

  const today = new Date()
  const upcoming = useMemo(() => {
    const todayKey = toDateKey(today.toISOString())
    return filteredInterviews
      .filter((a) => {
        const k = a.interviewDate ? toDateKey(a.interviewDate) : null
        return k && todayKey && k >= todayKey
      })
      .sort((a, b) => (a.interviewDate ?? "").localeCompare(b.interviewDate ?? ""))
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredInterviews])

  return (
    <div className="space-y-4">
      <Card className="p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled & Interviewed</SelectItem>
                <SelectItem value="interview-scheduled">Scheduled only</SelectItem>
                <SelectItem value="interviewed">Interviewed only</SelectItem>
                <SelectItem value="offer">Offer</SelectItem>
                <SelectItem value="all">All with interview date</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              onClick={() => onScheduleNew(toDateKey(today.toISOString()) ?? "")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Schedule Interview
            </Button>
          </div>
        </div>

        {/* Hint */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/40">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">Tip:</span> Click a day to schedule an interview · drag interviews between days to reschedule · click an interview to view candidate details.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-2">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="text-center font-semibold text-sm text-muted-foreground py-3 border-b"
            >
              {d}
            </div>
          ))}

          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[120px] bg-muted/20 rounded-lg border border-transparent"
            />
          ))}

          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const key = dateKeyForDay(day)
            const dayInterviews = interviewsByDate.get(key) ?? []
            const isToday =
              day === today.getDate() &&
              currentDate.getMonth() === today.getMonth() &&
              currentDate.getFullYear() === today.getFullYear()
            const isDragOver = dragOverDate === key

            return (
              <div
                key={day}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
                onClick={() => handleCellClick(day)}
                className={`
                  min-h-[120px] p-2 rounded-lg border transition-all cursor-pointer
                  ${isToday ? "bg-primary/5 border-primary/60" : "bg-card border-border/40"}
                  ${isDragOver ? "border-primary border-2 bg-primary/10 scale-[1.02]" : "hover:border-primary/40 hover:shadow-sm"}
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`
                      text-sm font-semibold
                      ${isToday ? "w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center" : "text-foreground"}
                    `}
                  >
                    {day}
                  </span>
                  {dayInterviews.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {dayInterviews.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {dayInterviews.slice(0, 3).map((app) => {
                    const tone = statusTone(app.status)
                    return (
                      <div
                        key={app.id ?? candidateLabel(app)}
                        draggable
                        onDragStart={(e) => handleDragStart(e, app)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditInterview(app)
                        }}
                        className={`
                          group relative text-xs p-1.5 pl-6 rounded truncate cursor-move transition-all hover:scale-105 hover:shadow-md
                          ${tone}
                          ${draggedApp?.id === app.id ? "opacity-50" : ""}
                        `}
                        title={`Click to edit · drag to reschedule · ${candidateLabel(app)}${app.jobTitle ? ` — ${app.jobTitle}` : ""}`}
                      >
                        <GripVertical className="absolute left-0.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                        <span className="truncate">{candidateLabel(app)}</span>
                      </div>
                    )
                  })}
                  {dayInterviews.length > 3 && (
                    <div
                      className="text-xs text-muted-foreground text-center py-1 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedDate(key)
                      }}
                    >
                      +{dayInterviews.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Upcoming */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-4 text-foreground">
            Upcoming Interviews
          </h3>
          <div className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No upcoming interviews.
              </p>
            ) : (
              upcoming.map((app) => {
                const dt = app.interviewDate ? new Date(app.interviewDate) : null
                const day = dt ? dt.getDate() : "—"
                const month = dt
                  ? dt.toLocaleString("en-US", { month: "short" }).toUpperCase()
                  : ""
                return (
                  <div
                    key={app.id ?? candidateLabel(app)}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all"
                  >
                    <div className="text-center min-w-[60px]">
                      <p className="text-2xl font-bold text-foreground">{day}</p>
                      <p className="text-xs text-muted-foreground">{month}</p>
                    </div>
                    <div className="flex-1 cursor-pointer" onClick={() => onEditInterview(app)}>
                      <p className="font-medium text-foreground">
                        {candidateLabel(app)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3" />
                          {dt ? formatHumanDate(toDateKey(dt.toISOString()) ?? "") : ""}
                        </span>
                        {dt && hasTimeComponent(app.interviewDate) && (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {app.jobTitle ?? "Position TBD"}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditInterview(app)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onViewCandidate(app)
                        }}
                      >
                        View
                      </Button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </Card>

      {/* Day detail sheet */}
      <Sheet
        open={!!selectedDate}
        onOpenChange={(open) => !open && setSelectedDate(null)}
      >
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          {selectedDate && (
            <>
              <div className="p-6 pb-4 border-b border-border/60 bg-muted/30">
                <SheetHeader>
                  <SheetTitle className="text-xl font-semibold text-foreground">
                    {formatHumanDate(selectedDate)}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Interviews scheduled on this date
                  </SheetDescription>
                </SheetHeader>
                <p className="mt-1 text-sm text-muted-foreground">
                  {(() => {
                    const list = interviewsByDate.get(selectedDate) ?? []
                    return list.length === 0
                      ? "No interviews on this date"
                      : `${list.length} interview${list.length === 1 ? "" : "s"} on this date`
                  })()}
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4 min-h-0">
                {(() => {
                  const list = interviewsByDate.get(selectedDate) ?? []
                  if (list.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-sm text-muted-foreground mb-4">
                          Nothing scheduled yet.
                        </p>
                        <Button variant="outline" onClick={handleAddForSelectedDate}>
                          <Plus className="w-4 h-4 mr-2" />
                          Schedule interview on this date
                        </Button>
                      </div>
                    )
                  }
                  return (
                    <ul className="space-y-3">
                      {list.map((app) => (
                        <li key={app.id ?? candidateLabel(app)}>
                          <div className="p-4 rounded-xl border border-border/50 hover:border-primary/40 transition-all hover:shadow-md">
                            <p className="font-medium text-foreground leading-snug flex items-center gap-2">
                              <User className="w-4 h-4 text-muted-foreground" />
                              {candidateLabel(app)}
                            </p>
                            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                              <Badge
                                variant="outline"
                                className={`text-xs capitalize ${statusTone(app.status)}`}
                              >
                                {(app.status ?? "interview-scheduled").replace(/-/g, " ")}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {app.jobTitle ?? "Position TBD"}
                              </Badge>
                              {app.interviewDate && hasTimeComponent(app.interviewDate) && (
                                <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(app.interviewDate).toLocaleTimeString([], {
                                    hour: "numeric",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-3">
                              <Button
                                size="sm"
                                onClick={() => {
                                  onEditInterview(app)
                                  setSelectedDate(null)
                                }}
                              >
                                Edit interview
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  onViewCandidate(app)
                                  setSelectedDate(null)
                                }}
                              >
                                View candidate
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
              </div>
              <div className="p-4 pt-3 border-t border-border/60 bg-background">
                <Button className="w-full" size="lg" onClick={handleAddForSelectedDate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Schedule interview on this date
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

// ---------- helpers ----------

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

/** Convert any ISO-ish string to YYYY-MM-DD. Returns null on failure. */
function toDateKey(input: string | null | undefined): string | null {
  if (!input) return null
  // If it's already YYYY-MM-DD, keep it.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const d = new Date(input)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function hasTimeComponent(input: string | null | undefined): boolean {
  if (!input) return false
  return /T\d{2}:\d{2}/.test(input) || /\d{2}:\d{2}/.test(input.slice(10))
}

function preserveTimeOfDay(
  original: string | null | undefined,
  newDateKey: string,
): string {
  if (!original || !hasTimeComponent(original)) return newDateKey
  const orig = new Date(original)
  if (Number.isNaN(orig.getTime())) return newDateKey
  const [y, m, d] = newDateKey.split("-").map(Number)
  const next = new Date(orig)
  next.setFullYear(y, (m ?? 1) - 1, d ?? 1)
  return next.toISOString()
}

function formatHumanDate(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return dateKey
  return formatDateOnly(`${dateKey}T12:00:00`, "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

function candidateLabel(app: CalendarApplication): string {
  if (app.isRevealed && (app.firstName || app.lastName)) {
    return `${app.firstName ?? ""} ${app.lastName ?? ""}`.trim() || (app.anonymousId ?? "Candidate")
  }
  return app.anonymousId ?? "Candidate"
}

function statusTone(status: string | null | undefined): string {
  switch (status) {
    case "offer":
      return "bg-green-500/20 text-green-700 dark:text-green-300"
    case "interviewed":
      return "bg-purple-500/20 text-purple-700 dark:text-purple-300"
    case "rejected":
      return "bg-red-500/20 text-red-700 dark:text-red-300"
    case "interview-scheduled":
    default:
      return "bg-blue-500/20 text-blue-700 dark:text-blue-300"
  }
}
