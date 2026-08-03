import { getTodayDateKey, formatDateOnly, parseDateOnly } from '@/lib/due-date-utils'
import { formatAssigneeSummary, isTaskAssignedTo, isTaskUnassigned } from '@/lib/task-assignees'
"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { Project, Task } from "@/lib/project-data"
import { addTask, getProjectTeamMembers, deleteTask, updateTask } from "@/lib/project-data-supabase"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronLeft, ChevronRight, Plus, X, GripVertical } from "lucide-react"
import { TaskDetailsDialog } from "./task-details-dialog"
import { useToast } from "@/hooks/use-toast"

interface CalendarViewProps {
  project: Project
  readOnly?: boolean
}

export function CalendarView({ project, readOnly = false }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date()) // Current month
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [tasks, setTasks] = useState<Task[]>(project.tasks)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false)
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [dragOverDate, setDragOverDate] = useState<string | null>(null)
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all") // "all" | assignee name
  const [selectedDate, setSelectedDate] = useState<string | null>(null) // YYYY-MM-DD for day-detail sheet
  const { toast } = useToast()
  const [allowBackdate, setAllowBackdate] = useState(false)
  const [newEvent, setNewEvent] = useState({
    title: "",
    description: "",
    assignee: "",
    priority: "medium" as Task["priority"],
    status: "todo" as Task["status"],
    date: "",
  })

  // Load team members
  useEffect(() => {
    const loadTeamMembers = async () => {
      const members = await getProjectTeamMembers(project.id)
      setTeamMembers(members)
    }
    loadTeamMembers()
  }, [project.id])

  // Update tasks when project data changes
  useEffect(() => {
    setTasks(project.tasks)
  }, [project.tasks])

  // Listen for project data updates
  useEffect(() => {
    const handleProjectUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === project.id) {
        console.log("[CalendarView] Project data updated, refreshing tasks")
        // The project prop will be updated by parent, which triggers the first useEffect
      }
    }

    window.addEventListener('projectDataUpdated', handleProjectUpdate as EventListener)
    return () => window.removeEventListener('projectDataUpdated', handleProjectUpdate as EventListener)
  }, [project.id])

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay()

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  // Tasks filtered by assignee (for calendar display)
  const filteredTasks = (() => {
    if (assigneeFilter === "all") return tasks
    if (assigneeFilter === "Unassigned") {
      return tasks.filter((t) => isTaskUnassigned(t))
    }
    return tasks.filter((t) => isTaskAssignedTo(t, { name: assigneeFilter }))
  })()

  // Map tasks to calendar: show tasks that span this day (from start to deadline).
  // If task has no startDate, treat as "from today" when deadline is in the future so it spans until completion.
  const getTasksForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    return getTasksForDateStr(dateStr)
  }

  const getTasksForDateStr = (dateStr: string) => {
    const todayStr = getTodayDateKey()
    return filteredTasks.filter((task) => {
      if (!task.deadline) return false
      const end = task.deadline
      const start = task.startDate
        ?? (end >= todayStr ? todayStr : end)
      return dateStr >= start && dateStr <= end
    })
  }

  // Assignee options for filter: All + everyone who has tasks (from tasks) + team members, Unassigned last
  const assigneeOptions = (() => {
    const names = new Set<string>(teamMembers.map((m: { name: string }) => m.name))
    tasks.forEach((t) => names.add(t.assignee?.name?.trim() || "Unassigned"))
    return [
      "all",
      ...Array.from(names).sort((a, b) => (a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b))),
    ]
  })()

  const handleAddEvent = async () => {
    if (newEvent.title) {
      const assigneeMember = newEvent.assignee ? teamMembers.find((m: any) => m.name === newEvent.assignee) : null
      
      const todayStr = getTodayDateKey()
      const deadlineStr = newEvent.date?.trim() || todayStr
      const taskData: Omit<Task, 'id'> = {
        title: newEvent.title,
        description: newEvent.description,
        status: newEvent.status,
        priority: newEvent.priority,
        assignee: {
          name: newEvent.assignee || "Unassigned",
          avatar: assigneeMember?.avatar || "/placeholder.svg?height=32&width=32",
        },
        startDate: todayStr,
        deadline: deadlineStr,
        progress: 0,
      }
      
      // Add task/event to global data store
      const newTaskWithId = await addTask(project.id, taskData)
      
      if (!newTaskWithId) {
        console.error("[CalendarView] Failed to add task")
        toast({
          title: "Error",
          description: "Failed to add event. Please try again.",
          variant: "destructive",
        })
        return
      }
      
      // Update local state immediately for instant UI feedback
      setTasks([...tasks, newTaskWithId])
      
      // Reset form and close dialog
      setNewEvent({
        title: "",
        description: "",
        assignee: "",
        priority: "medium",
        status: "todo",
        date: "",
      })
      setIsDialogOpen(false)
      
      toast({
        title: "Event added",
        description: `"${newTaskWithId.title}" has been added to the calendar.`,
      })
      
      console.log("[CalendarView] Event added:", newTaskWithId.title)
    }
  }

  // Open day-detail sheet for this date (shows all tasks + option to add)
  const handleCellClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    setSelectedDate(dateStr)
  }

  const handleAddTaskForSelectedDate = () => {
    if (selectedDate) {
      setNewEvent((prev) => ({ ...prev, date: selectedDate }))
      setIsDialogOpen(true)
      setSelectedDate(null)
    }
  }

  // Handle task deletion
  const handleDeleteTask = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation() // Prevent opening task details
    
    if (window.confirm(`Are you sure you want to delete "${task.title}"?`)) {
      try {
        await deleteTask(project.id, task.id)
        setTasks(tasks.filter(t => t.id !== task.id))
        
        toast({
          title: "Task deleted",
          description: `"${task.title}" has been removed.`,
        })
      } catch (error) {
        console.error("[CalendarView] Failed to delete task:", error)
        toast({
          title: "Error",
          description: "Failed to delete task. Please try again.",
          variant: "destructive",
        })
      }
    }
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragEnd = () => {
    setDraggedTask(null)
    setDragOverDate(null)
  }

  const handleDragOver = (e: React.DragEvent, day: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    setDragOverDate(dateStr)
  }

  const handleDragLeave = () => {
    setDragOverDate(null)
  }

  const handleDrop = async (e: React.DragEvent, day: number) => {
    e.preventDefault()
    setDragOverDate(null)
    if (readOnly) return
    
    if (!draggedTask) return
    
    const newDeadline = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
    
    // Don't update if dropping on the same date
    if (draggedTask.deadline === newDeadline) {
      setDraggedTask(null)
      return
    }
    
    try {
      await updateTask(project.id, draggedTask.id, { deadline: newDeadline })
      
      // Update local state
      setTasks(tasks.map(t => 
        t.id === draggedTask.id ? { ...t, deadline: newDeadline } : t
      ))
      
      toast({
        title: "Task moved",
        description: `"${draggedTask.title}" has been moved to ${formatDateOnly(newDeadline)}.`,
      })
    } catch (error) {
      console.error("[CalendarView] Failed to update task:", error)
      toast({
        title: "Error",
        description: "Failed to move task. Please try again.",
        variant: "destructive",
      })
    }
    
    setDraggedTask(null)
  }

  return (
    <div className="space-y-4">
      <Card className="p-6">
        {/* Calendar Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-foreground">
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                {assigneeOptions.filter((v) => v !== "all").map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={previousMonth}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={nextMonth}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            {!readOnly ? (
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
            ) : null}
          </div>
        </div>

        {/* Instructions hint */}
        <div className="mb-4 p-3 bg-muted/30 rounded-lg border border-border/40">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold">💡 Tip:</span> Click on any day to add an event • Drag tasks between days • Hover over tasks to delete
          </p>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-2">
          {/* Day Headers */}
          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
            <div key={day} className="text-center font-semibold text-sm text-muted-foreground py-3 border-b">
              {day}
            </div>
          ))}

          {/* Empty cells for days before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[120px] bg-muted/20 rounded-lg border border-transparent" />
          ))}

          {/* Calendar Days */}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayTasks = getTasksForDate(day)
            const today = new Date()
            const isToday = day === today.getDate() && 
                           currentDate.getMonth() === today.getMonth() && 
                           currentDate.getFullYear() === today.getFullYear()
            const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
            const isDragOver = dragOverDate === dateStr

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
                  {dayTasks.length > 0 && (
                    <Badge variant="secondary" className="text-xs h-5">
                      {dayTasks.length}
                    </Badge>
                  )}
                </div>

                <div className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <div
                      key={task.id}
                      draggable={!readOnly}
                      onDragStart={(e) => handleDragStart(e, task)}
                      onDragEnd={handleDragEnd}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTask(task)
                        setTaskDetailsOpen(true)
                      }}
                      className={`
                        group relative text-xs p-1.5 pl-6 pr-7 rounded truncate cursor-move transition-all hover:scale-105 hover:shadow-md
                        ${
                          task.status === "done"
                            ? "bg-green-500/20 text-green-700 dark:text-green-300"
                            : task.priority === "high"
                              ? "bg-red-500/20 text-red-700 dark:text-red-300"
                              : task.priority === "medium"
                                ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
                                : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                        }
                        ${draggedTask?.id === task.id ? "opacity-50" : ""}
                      `}
                    >
                      <GripVertical className="absolute left-0.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                      {task.title}
                      <button
                        onClick={(e) => handleDeleteTask(e, task)}
                        className="absolute right-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-500/30 rounded"
                        title="Delete task"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {dayTasks.length > 3 && (
                    <div 
                      className="text-xs text-muted-foreground text-center py-1 hover:bg-muted/50 rounded cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation()
                        const dateStr = `${currentDate.getFullYear()}-${(currentDate.getMonth() + 1).toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`
                        setSelectedDate(dateStr)
                      }}
                    >
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Upcoming Deadlines - inside same card */}
        <div className="mt-8 pt-6 border-t border-border">
          <h3 className="text-lg font-semibold mb-4 text-foreground">Upcoming Deadlines</h3>
          <div className="space-y-3">
            {tasks
              .filter((t) => t.status !== "done" && t.deadline)
              .slice(0, 5)
              .map((task) => {
                const deadlineDate = parseDateOnly(task.deadline)
                const day = deadlineDate?.getDate() ?? 0
                const month = deadlineDate?.toLocaleString('en-US', { month: 'short' }).toUpperCase() ?? ''

                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      setSelectedTask(task)
                      setTaskDetailsOpen(true)
                    }}
                    className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all cursor-pointer"
                  >
                    <div className="text-center min-w-[60px]">
                      <p className="text-2xl font-bold text-foreground">{day}</p>
                      <p className="text-xs text-muted-foreground">{month}</p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{task.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            task.priority === "high"
                              ? "border-red-500 text-red-600 bg-red-500/20 dark:text-red-400"
                              : task.priority === "medium"
                                ? "border-yellow-500 text-yellow-600 bg-yellow-500/20 dark:text-yellow-400"
                                : "border-green-500 text-green-600 bg-green-500/20 dark:text-green-400"
                          }`}
                        >
                          {task.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{formatAssigneeSummary(task)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            {filteredTasks.filter((t) => t.status !== "done" && t.deadline).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {assigneeFilter === "all" ? "No upcoming deadlines" : "No upcoming deadlines for this assignee"}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Day detail sheet: all tasks on selected date + Add task */}
      <Sheet open={!!selectedDate} onOpenChange={(open) => !open && setSelectedDate(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0">
          {selectedDate && (
            <>
              <div className="p-6 pb-4 border-b border-border/60 bg-muted/30">
                <SheetHeader>
                  <SheetTitle className="text-xl font-semibold text-foreground">
                    {formatDateOnly(selectedDate, 'en-US', {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </SheetTitle>
                  <SheetDescription className="sr-only">
                    Tasks due or spanning this date
                  </SheetDescription>
                </SheetHeader>
                <p className="mt-1 text-sm text-muted-foreground">
                  {getTasksForDateStr(selectedDate).length === 0
                    ? "No tasks on this date"
                    : `${getTasksForDateStr(selectedDate).length} task${getTasksForDateStr(selectedDate).length === 1 ? "" : "s"} on this date`}
                </p>
              </div>
              <div className="flex-1 overflow-auto p-4 min-h-0">
                {getTasksForDateStr(selectedDate).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <p className="text-sm text-muted-foreground mb-4">Nothing scheduled yet.</p>
                    <Button variant="outline" onClick={handleAddTaskForSelectedDate}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add task to this date
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {getTasksForDateStr(selectedDate).map((task) => (
                      <li key={task.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedTask(task)
                            setTaskDetailsOpen(true)
                          }}
                          className={`
                            w-full text-left p-4 rounded-xl border transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                            ${task.status === "done"
                              ? "bg-green-500/10 border-green-500/30 hover:border-green-500/50"
                              : "bg-card border-border/50 hover:border-primary/40 hover:bg-muted/20"}
                          `}
                        >
                          <p className="font-medium text-foreground leading-snug">{task.title}</p>
                          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                task.priority === "high"
                                  ? "border-red-500/60 text-red-600 dark:text-red-400"
                                  : task.priority === "medium"
                                    ? "border-yellow-500/60 text-yellow-600 dark:text-yellow-400"
                                    : "border-green-500/60 text-green-600 dark:text-green-400"
                              }`}
                            >
                              {task.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {task.status.replace("-", " ")}
                            </Badge>
                            <span className="text-xs text-muted-foreground">· {task.assignee?.name || "Unassigned"}</span>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="p-4 pt-3 border-t border-border/60 bg-background">
                <Button className="w-full" size="lg" onClick={handleAddTaskForSelectedDate}>
                  <Plus className="w-4 h-4 mr-2" />
                  Add task to this date
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Event Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
            <DialogDescription>
              Create a new event or task in the calendar.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="event-title">Event Title *</Label>
              <Input
                id="event-title"
                placeholder="e.g., Team Meeting, Product Launch"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                placeholder="Describe the event..."
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-assignee">Assignee *</Label>
                <Select
                  value={newEvent.assignee}
                  onValueChange={(value) => setNewEvent({ ...newEvent, assignee: value })}
                >
                  <SelectTrigger id="event-assignee">
                    <SelectValue placeholder="Select assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.name}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-date">Completion date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={newEvent.date}
                  onChange={(e) => setNewEvent({ ...newEvent, date: e.target.value })}
                  {...(!allowBackdate ? { min: getTodayDateKey() } : {})}
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={allowBackdate}
                    onCheckedChange={(c) => setAllowBackdate(!!c)}
                  />
                  <span className="text-xs text-muted-foreground">Allow historical/past dates</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="event-priority">Priority</Label>
                <Select
                  value={newEvent.priority}
                  onValueChange={(value: Task["priority"]) => setNewEvent({ ...newEvent, priority: value })}
                >
                  <SelectTrigger id="event-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="event-status">Status</Label>
                <Select
                  value={newEvent.status}
                  onValueChange={(value: Task["status"]) => setNewEvent({ ...newEvent, status: value })}
                >
                  <SelectTrigger id="event-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="backlog">Backlog</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddEvent}
              disabled={!newEvent.title}
            >
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <TaskDetailsDialog
        projectId={project.id}
        task={selectedTask}
        open={taskDetailsOpen}
        onOpenChange={setTaskDetailsOpen}
        readOnly={readOnly}
      />
    </div>
  )
}
