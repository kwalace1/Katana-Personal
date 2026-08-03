import { getTodayDateKey, dateKeyDaysFromNow, isPastDueDate, parseDateKey } from '@/lib/due-date-utils'
import { formatAssigneeSummary } from "@/lib/task-assignees"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import type { Project } from "@/lib/project-data"
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  BarChart3,
  Calendar,
  Users,
  Target,
  Activity,
} from "lucide-react"

interface ReportsViewProps {
  project: Project
}

export function ReportsView({ project }: ReportsViewProps) {
  // Calculate metrics
  const completionRate = project.totalTasks > 0 
    ? Math.round((project.completedTasks / project.totalTasks) * 100) 
    : 0

  const tasksByStatus = {
    todo: project.tasks.filter(t => t.status === 'todo').length,
    inProgress: project.tasks.filter(t => t.status === 'in-progress').length,
    done: project.tasks.filter(t => t.status === 'done').length,
    blocked: project.tasks.filter(t => t.status === 'blocked').length,
  }

  const tasksByPriority = {
    high: project.tasks.filter(t => t.priority === 'high').length,
    medium: project.tasks.filter(t => t.priority === 'medium').length,
    low: project.tasks.filter(t => t.priority === 'low').length,
  }

  // Calculate overdue tasks
  const todayKey = getTodayDateKey()
  const nextWeekKey = dateKeyDaysFromNow(7)
  const overdueTasks = project.tasks.filter(task => {
    if (!task.deadline || task.status === 'done') return false
    return isPastDueDate(task.deadline)
  }).length

  const upcomingDeadlines = project.tasks.filter(task => {
    if (!task.deadline || task.status === 'done') return false
    const due = parseDateKey(task.deadline)
    if (!due) return false
    return due >= todayKey && due <= nextWeekKey
  }).length

  // Team statistics
  const teamSize = project.team.length
  const taskAssignments = project.tasks.filter(t => t.assignee).length
  const unassignedTasks = project.totalTasks - taskAssignments

  return (
    <div className="space-y-6">
      {/* Overview – one rectangular bar */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="stat-bar">
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="stat-bar-label">Completion Rate</p>
              <p className="text-2xl font-bold tabular-nums">{completionRate}%</p>
              <p className="text-xs text-muted-foreground">{project.completedTasks} of {project.totalTasks} tasks</p>
              <Progress value={completionRate} className="mt-2 h-2" />
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Activity className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Progress</p>
              <p className="text-2xl font-bold tabular-nums">{project.progress}%</p>
              <p className="text-xs text-muted-foreground">{tasksByStatus.inProgress} in progress · {tasksByStatus.todo} in backlog</p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <AlertTriangle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Overdue Tasks</p>
              <p className="text-2xl font-bold tabular-nums text-destructive">{overdueTasks}</p>
              <p className="text-xs text-muted-foreground">{upcomingDeadlines} due this week</p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Team Members</p>
              <p className="text-2xl font-bold tabular-nums">{teamSize}</p>
              <p className="text-xs text-muted-foreground">{unassignedTasks} unassigned tasks</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Tasks by Status, Priority, Team Performance, Attention Required – one card, 2x2 grid */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="grid gap-0 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
          {/* Tasks by Status */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Tasks by Status</h3>
            <p className="text-xs text-muted-foreground mb-4">Distribution across workflow stages</p>
            <div className="space-y-3">
              {[
                { key: 'todo', label: 'To Do', color: 'bg-slate-500', value: tasksByStatus.todo },
                { key: 'inProgress', label: 'In Progress', color: 'bg-blue-500', value: tasksByStatus.inProgress },
                { key: 'done', label: 'Done', color: 'bg-green-500', value: tasksByStatus.done },
                ...(tasksByStatus.blocked > 0 ? [{ key: 'blocked', label: 'Blocked', color: 'bg-red-500', value: tasksByStatus.blocked }] : []),
              ].map(({ key, label, color, value }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      {label}
                    </span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <Progress value={project.totalTasks ? (value / project.totalTasks) * 100 : 0} className="h-1.5" />
                </div>
              ))}
            </div>
          </div>

          {/* Tasks by Priority */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Tasks by Priority</h3>
            <p className="text-xs text-muted-foreground mb-4">Priority distribution</p>
            <div className="space-y-3">
              {[
                { key: 'high', label: 'High', color: 'bg-red-500', value: tasksByPriority.high, barClass: '[&>div]:bg-red-500' },
                { key: 'medium', label: 'Medium', color: 'bg-yellow-500', value: tasksByPriority.medium, barClass: '[&>div]:bg-yellow-500' },
                { key: 'low', label: 'Low', color: 'bg-green-500', value: tasksByPriority.low, barClass: '[&>div]:bg-green-500' },
              ].map(({ key, label, color, value, barClass }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                      {label}
                    </span>
                    <span className="font-medium">{value}</span>
                  </div>
                  <Progress value={project.totalTasks ? (value / project.totalTasks) * 100 : 0} className={`h-1.5 ${barClass}`} />
                </div>
              ))}
            </div>
          </div>

          {/* Team Performance */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Team Performance</h3>
            <p className="text-xs text-muted-foreground mb-4">Task completion by member</p>
            <div className="space-y-3 max-h-48 overflow-y-auto">
              {project.team.length === 0 ? (
                <p className="text-xs text-muted-foreground">No team members</p>
              ) : (
                project.team.map((member) => {
                  const memberTasks = project.tasks.filter(t => t.assignee?.name === member.name)
                  const completedTasks = memberTasks.filter(t => t.status === 'done').length
                  const totalTasks = memberTasks.length
                  const rate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
                  return (
                    <div key={member.id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium truncate">{member.name}</span>
                        <span className="text-muted-foreground shrink-0">{completedTasks}/{totalTasks} · {rate}%</span>
                      </div>
                      <Progress value={rate} className="h-1.5" />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Attention Required */}
          <div className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-1">Attention Required</h3>
            <p className="text-xs text-muted-foreground mb-4">Overdue and high-priority tasks</p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {(() => {
                const attentionTasks = project.tasks.filter(task => {
                  const overdue = task.deadline && task.status !== 'done' && isPastDueDate(task.deadline)
                  const isHighPriority = task.priority === 'high' && task.status !== 'done'
                  return overdue || isHighPriority
                }).slice(0, 8)
                if (attentionTasks.length === 0) {
                  return <p className="text-xs text-muted-foreground">No overdue or high-priority tasks</p>
                }
                return attentionTasks.map(task => {
                  const overdue = task.deadline && isPastDueDate(task.deadline)
                  return (
                    <div key={task.id} className="flex items-center justify-between gap-2 py-2 px-3 border rounded-md text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{task.title}</p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          {formatAssigneeSummary(task) !== 'Unassigned' && <span>{formatAssigneeSummary(task)}</span>}
                          {task.deadline && <span>{task.deadline}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        {overdue && <Badge variant="destructive" className="text-[10px] px-1.5">Overdue</Badge>}
                        {task.priority === 'high' && !overdue && <Badge variant="outline" className="text-[10px] px-1.5 border-red-500 text-red-600">High</Badge>}
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

