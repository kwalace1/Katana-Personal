import { formatDateOnly } from '@/lib/due-date-utils'
"use client"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Project, Task } from "@/lib/project-data"
import { getTaskDisplayProgressWithCache } from "@/lib/project-data-supabase"
import { formatDueDateLabel, isPmTaskOverdue } from "@/lib/due-date-utils"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"

interface TimelineViewProps {
  project: Project
  onTaskClick?: (task: Task) => void
}

const statusConfig = [
  { key: 'backlog', label: 'Backlog', color: 'bg-gray-500' },
  { key: 'todo', label: 'To Do', color: 'bg-yellow-500' },
  { key: 'in-progress', label: 'In Progress', color: 'bg-blue-500' },
  { key: 'review', label: 'Review', color: 'bg-purple-500' },
  { key: 'blocked', label: 'Blocked', color: 'bg-red-500' },
  { key: 'done', label: 'Done', color: 'bg-green-500' },
]

export function TimelineView({ project, onTaskClick }: TimelineViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date())

  // Calculate timeline range
  const { startDate, endDate, months } = useMemo(() => {
    if (!project.tasks || project.tasks.length === 0) {
      const now = new Date()
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 3, 0)
      return { startDate: start, endDate: end, months: [] }
    }

    const dates = project.tasks.map(t => new Date(t.deadline))
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))

    // Add padding
    const start = new Date(minDate.getFullYear(), minDate.getMonth() - 1, 1)
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth() + 2, 0)

    // Generate months
    const monthsList = []
    let current = new Date(start)
    while (current <= end) {
      monthsList.push({
        date: new Date(current),
        label: current.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      })
      current.setMonth(current.getMonth() + 1)
    }

    return { startDate: start, endDate: end, months: monthsList }
  }, [project.tasks])

  // Group tasks by assignee (normalize empty to "Unassigned")
  const tasksByAssignee = useMemo(() => {
    const groups: Record<string, Task[]> = {}

    project.tasks.forEach(task => {
      const assigneeName = task.assignee?.name?.trim() || 'Unassigned'
      if (!groups[assigneeName]) {
        groups[assigneeName] = []
      }
      groups[assigneeName].push(task)
    })

    return groups
  }, [project.tasks])

  // Get unique team members
  const teamMembers = useMemo(() => {
    return Object.keys(tasksByAssignee).map(name => {
      const firstTask = tasksByAssignee[name][0]
      return {
        name,
        avatar: firstTask.assignee.avatar,
        role: name.toLowerCase().includes('designer') ? 'designer' : 'developer'
      }
    })
  }, [tasksByAssignee])

  // Calculate task position
  const getTaskPosition = (task: Task) => {
    const taskDate = new Date(task.deadline)
    const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const daysFromStart = (taskDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    const left = (daysFromStart / totalDays) * 100
    return Math.max(0, Math.min(left, 100))
  }

  // Get status color for a task
  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'done': return 'bg-green-500'
      case 'in-progress': return 'bg-blue-500'
      case 'review': return 'bg-purple-500'
      case 'blocked': return 'bg-red-500'
      case 'todo': return 'bg-yellow-500'
      case 'backlog': return 'bg-gray-500'
      default: return 'bg-blue-500'
    }
  }

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev)
      newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1))
      return newDate
    })
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        {/* Timeline Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Project Roadmap</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Timeline view of all project tasks • {project.tasks.length} task{project.tasks.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Timeline Swimlanes */}
        {project.tasks.length > 0 ? (
          <div className="space-y-4">
            {/* Month Headers */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('prev')}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-0 min-w-full">
                  {months.map((month, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center py-2 px-4 bg-muted/30 border-r border-border/40 last:border-r-0"
                      style={{ minWidth: `${100 / months.length}%` }}
                    >
                      <div className="text-sm font-semibold text-foreground">{month.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateMonth('next')}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Team Member Swimlanes */}
            <div className="space-y-4">
              {teamMembers.map(member => {
                const tasks = tasksByAssignee[member.name]
                // Compute rows for height (card ~160px ≈ 12–16% of typical lane; use 12% for overlap)
                const rowForIndex = (i: number) => {
                  const position = getTaskPosition(tasks[i])
                  let row = 0
                  const cardWidthPct = 12
                  for (let j = 0; j < i; j++) {
                    const prevPos = getTaskPosition(tasks[j])
                    if (Math.abs(position - prevPos) < cardWidthPct) row++
                  }
                  return row
                }
                const maxRow = tasks.length === 0 ? 0 : Math.max(...tasks.map((_, i) => rowForIndex(i)))
                const laneHeight = 24 + (maxRow + 1) * 88

                return (
                  <div key={member.name} className="border border-border rounded-lg overflow-visible bg-card">
                    {/* Lane Header */}
                    <div className="px-4 py-3 border-b border-border bg-muted/30">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          name={member.name}
                          photoUrl={member.avatar && member.avatar !== "/placeholder.svg?height=32&width=32" ? member.avatar : undefined}
                          size="md"
                        />
                        <div>
                          <div className="text-sm font-semibold text-foreground">{member.name}</div>
                          <div className="text-xs text-muted-foreground">{member.role}</div>
                        </div>
                        <span className="ml-auto text-xs text-muted-foreground">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    {/* Lane Content - timeline track aligned with month headers */}
                    <div className="relative bg-muted/10 overflow-visible" style={{ minHeight: laneHeight }}>
                      <div className="absolute inset-0 flex" aria-hidden>
                        {months.map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 border-r border-border/50 last:border-r-0"
                            style={{ minWidth: months.length ? `${100 / months.length}%` : '100%' }}
                          />
                        ))}
                      </div>
                      <div className="relative w-full h-full" style={{ minHeight: laneHeight, padding: '12px 0' }}>
                        {tasks.map((task, i) => {
                          const position = getTaskPosition(task)
                          const row = rowForIndex(i)
                          const statusColor = getStatusColor(task.status)
                          const overdue = task.isOverdue ?? isPmTaskOverdue(task)
                          const dueLabel = task.dueDateLabel ?? formatDueDateLabel(task.deadline)
                          const topPx = 12 + row * 88

                          return (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => onTaskClick?.(task)}
                              className={`absolute h-[80px] w-[160px] px-3 py-2 rounded-lg shadow border text-left transition-all hover:shadow-md hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${statusColor} text-white group ${
                                overdue ? 'ring-2 ring-red-500 border-red-400' : 'border-black/10'
                              }`}
                              style={{
                                left: `max(0%, min(${position}%, calc(100% - 160px)))`,
                                transform: 'translateX(-50%)',
                                top: `${topPx}px`,
                              }}
                              title={task.title}
                            >
                              <div className="flex flex-col h-full overflow-hidden">
                                <div className="text-xs font-semibold truncate leading-tight">{task.title}</div>
                                <div className="text-[10px] opacity-90 mt-1 capitalize">{task.status.replace('-', ' ')}</div>
                                <div className={`text-[10px] mt-0.5 truncate ${overdue ? 'font-semibold' : 'opacity-80'}`}>
                                  {dueLabel}
                                </div>
                                {(() => {
                                  const pct = getTaskDisplayProgressWithCache(task.id, task)
                                  return pct !== null ? (
                                    <div className="mt-auto flex items-center gap-2">
                                      <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden min-w-0">
                                        <div
                                          className="h-full bg-white/80 rounded-full transition-all"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                      <span className="text-[10px] opacity-90 shrink-0">{pct}%</span>
                                    </div>
                                  ) : null
                                })()}
                              </div>
                              {/* Tooltip on hover */}
                              <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50 w-[220px]">
                                <span className="block bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-lg border border-border text-left">
                                  <span className="text-sm font-semibold block">{task.title}</span>
                                  <span className={`text-xs block ${overdue ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
                                    {dueLabel}
                                  </span>
                                  <span className="text-xs text-muted-foreground capitalize block">Status: {task.status.replace('-', ' ')}</span>
                                </span>
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No tasks to display
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-border flex items-center gap-6 flex-wrap">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          {statusConfig.map((item) => (
            <div key={item.key} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${item.color}`} />
              <span className="text-xs text-foreground">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Total Tasks + counts under status */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap items-center gap-6 md:gap-8">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground whitespace-nowrap">Total Tasks</p>
            <p className="text-2xl font-bold text-foreground tabular-nums">{project.tasks.length}</p>
          </div>
          {statusConfig.map((item) => (
            <div key={item.key} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-sm ${item.color}`} />
              <p className="text-sm text-muted-foreground whitespace-nowrap">{item.label}</p>
              <p className="text-lg font-semibold text-foreground tabular-nums">
                {project.tasks.filter((t) => t.status === item.key).length}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Milestones - Only show if project has milestones */}
      {project.milestones && project.milestones.length > 0 && (
        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">Project Milestones</h3>
          </div>
          <div className="space-y-3">
            {project.milestones.map((milestone, i) => (
              <div
                key={milestone.id}
                className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all"
              >
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    ${
                      milestone.status === "completed"
                        ? "bg-green-500/20 text-green-500"
                        : milestone.status === "in-progress"
                          ? "bg-yellow-500/20 text-yellow-500"
                          : "bg-blue-500/20 text-blue-500"
                    }
                  `}
                >
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground text-sm">{milestone.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateOnly(milestone.date)}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-xs ${
                    milestone.status === "completed"
                      ? "border-green-500/50 text-green-500"
                      : milestone.status === "in-progress"
                        ? "border-yellow-500/50 text-yellow-500"
                        : "border-blue-500/50 text-blue-500"
                  }`}
                >
                  {milestone.status}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
