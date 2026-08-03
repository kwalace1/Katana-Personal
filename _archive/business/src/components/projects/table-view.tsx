import { formatDateOnly, formatDueDateLabel, isPmTaskOverdue } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Project, Task } from "@/lib/project-data"
import { canMarkTaskDone } from "@/lib/project-data"
import { getTaskDisplayProgressWithCache } from "@/lib/project-data-supabase"
import { Plus, Search, Filter, MoreVertical, Trash2 } from "lucide-react"
import { TaskDetailsDialog } from "./task-details-dialog"
import { getProjectTeamMembers, updateTaskStatus, deleteTask, addTask, updateTask, getTaskWithCachedSubtasks } from "@/lib/project-data-supabase"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"
import { toast } from "sonner"
import type { TeamMember } from "@/lib/project-data"
import { TaskAssigneePicker, TaskAssigneeDisplay } from "@/components/projects/TaskAssigneePicker"
import { mergeAssigneeFields, type TaskAssignee } from "@/lib/task-assignees"

interface TableViewProps {
  project: Project
  readOnly?: boolean
}

export function TableView({ project, readOnly = false }: TableViewProps) {
  const [tasks, setTasks] = useState<Task[]>(project.tasks)
  const [searchQuery, setSearchQuery] = useState("")
  const [savedView, setSavedView] = useState("all")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false)
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [newTask, setNewTask] = useState({
    title: "",
    assignees: [] as TaskAssignee[],
    status: "todo" as Task["status"],
    deadline: "",
  })

  useEffect(() => {
    getProjectTeamMembers(project.id).then(setTeamMembers).catch(() => setTeamMembers([]))
  }, [project.id])

  const filteredTasks = tasks.filter((task) => {
    if (!task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (savedView === "overdue") return task.isOverdue ?? isPmTaskOverdue(task)
    if (savedView === "high-priority") return task.priority === "high"
    return true
  })

  // Update tasks when project data changes
  useEffect(() => {
    setTasks(project.tasks)
  }, [project.tasks])

  // Listen for project data updates
  useEffect(() => {
    const handleProjectUpdate = (event: CustomEvent) => {
      if (event.detail.projectId === project.id) {
        console.log("[TableView] Project data updated, refreshing tasks")
        setTasks(project.tasks)
      }
    }

    window.addEventListener('projectDataUpdated', handleProjectUpdate as EventListener)
    return () => window.removeEventListener('projectDataUpdated', handleProjectUpdate as EventListener)
  }, [project.id, project.tasks])

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task)
    setTaskDetailsOpen(true)
  }

  const formatDeadline = (task: Task) => {
    if (task.dueDateLabel) return task.dueDateLabel
    const deadline = task.deadline
    if (!deadline) return 'No deadline'
    return formatDateOnly(deadline, 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const handleAddTask = async () => {
    if (!newTask.title.trim()) return
    const merged = mergeAssigneeFields({
      assignees: newTask.assignees,
      assignee: { name: 'Unassigned', avatar: '/placeholder.svg?height=32&width=32' },
      assigneeEmployeeId: null,
    })
    const taskData: Omit<Task, 'id'> = {
      title: newTask.title.trim(),
      status: newTask.status,
      priority: "medium",
      assignees: merged.assignees,
      assignee: merged.assignee,
      assigneeEmployeeId: merged.assigneeEmployeeId,
      deadline: newTask.deadline,
      progress: 0,
    }

    const newTaskWithId = await addTask(project.id, taskData)

    if (!newTaskWithId) {
      console.error("[TableView] Failed to add task")
      return
    }

    setTasks([...tasks, newTaskWithId])
    setNewTask({ title: "", assignees: [], status: "todo", deadline: "" })
  }

  const handleStatusChange = async (taskId: string, newStatus: Task["status"]) => {
    const task = tasks.find((t) => t.id === taskId)
    const taskWithCache = task ? getTaskWithCachedSubtasks(taskId, task) : undefined
    if (newStatus === "done" && taskWithCache && !canMarkTaskDone(taskWithCache)) {
      toast.error("Complete all subtasks before marking this task as done.")
      return
    }
    const prevTasks = tasks
    setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)))
    try {
      await updateTaskStatus(project.id, taskId, newStatus, taskWithCache)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update task")
      setTasks(prevTasks)
    }
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "border-red-500 text-red-600 bg-red-500/20 dark:text-red-400"
      case "medium":
        return "border-yellow-500 text-yellow-600 bg-yellow-500/20 dark:text-yellow-400"
      case "low":
        return "border-green-500 text-green-600 bg-green-500/20 dark:text-green-400"
    }
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "backlog":
        return "border-muted-foreground text-muted-foreground bg-muted/80"
      case "todo":
        return "border-blue-500 text-blue-600 bg-blue-500/20 dark:text-blue-400"
      case "in-progress":
        return "border-yellow-500 text-yellow-600 bg-yellow-500/20 dark:text-yellow-400"
      case "review":
        return "border-purple-500 text-purple-600 bg-purple-500/20 dark:text-purple-400"
      case "blocked":
        return "border-red-500 text-red-600 bg-red-500/20 dark:text-red-400"
      case "done":
        return "border-green-500 text-green-600 bg-green-500/20 dark:text-green-400"
    }
  }

  const taskIsOverdue = (task: Task) => task.isOverdue ?? isPmTaskOverdue(task)

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const toggleSelectAll = () => {
    setSelectedTasks(prev =>
      prev.length === filteredTasks.length
        ? []
        : filteredTasks.map(t => t.id)
    )
  }

  const deleteSelectedTasks = () => {
    if (window.confirm(`Are you sure you want to delete ${selectedTasks.length} task(s)?`)) {
      // Delete each selected task
      selectedTasks.forEach(taskId => {
        deleteTask(project.id, taskId)
      })
      
      // Update local state
      setTasks(tasks.filter(t => !selectedTasks.includes(t.id)))
      setSelectedTasks([])
    }
  }

  return (
    <div className="space-y-4">
      {/* Quick Add Task Form */}
      {!readOnly ? (
      <Card className="p-4">
        <h3 className="font-semibold mb-3 text-foreground">Quick Add Task</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input
            placeholder="Task title"
            value={newTask.title}
            onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newTask.title.trim()) {
                handleAddTask()
              }
            }}
            className="md:col-span-2"
          />
          <TaskAssigneePicker
            teamMembers={teamMembers}
            value={newTask.assignees}
            onChange={(assignees) => setNewTask({ ...newTask, assignees })}
          />
          <Select
            value={newTask.status}
            onValueChange={(value) => setNewTask({ ...newTask, status: value as Task["status"] })}
          >
            <SelectTrigger>
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
          <div className="flex gap-2">
            <Input
              type="date"
              value={newTask.deadline}
              onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
              className="flex-1"
            />
            <Button 
              onClick={handleAddTask} 
              size="icon"
              disabled={!newTask.title.trim()}
              title={!newTask.title.trim() ? "Enter a task title" : "Add task"}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
      ) : null}

      {/* Search and Filter */}
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          {(!readOnly && selectedTasks.length > 0) && (
            <>
              <Badge variant="secondary">
                {selectedTasks.length} selected
              </Badge>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteSelectedTasks}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {selectedTasks.length === 1 ? 'Task' : `${selectedTasks.length} Tasks`}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Select value={savedView} onValueChange={setSavedView}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Saved views" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="my-tasks">My Tasks</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="high-priority">High Priority</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Tasks Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border/40">
              <tr>
                <th className="text-left p-4 text-sm font-semibold text-foreground w-12">
                  {!readOnly ? (
                  <Checkbox
                    checked={selectedTasks.length === filteredTasks.length && filteredTasks.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                  ) : null}
                </th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Task</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Assignee</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Status</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Priority</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Progress</th>
                <th className="text-left p-4 text-sm font-semibold text-foreground">Deadline</th>
                {!readOnly ? <th className="text-left p-4 text-sm font-semibold text-foreground">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, index) => (
                <tr
                  key={task.id}
                  className={`
                    border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer
                    ${index % 2 === 0 ? "bg-background" : "bg-muted/10"}
                  `}
                  onClick={() => handleTaskClick(task)}
                >
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {!readOnly ? (
                    <Checkbox
                      checked={selectedTasks.includes(task.id)}
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                    />
                    ) : null}
                  </td>
                  <td className="p-4">
                    <p className="font-medium text-foreground">{task.title}</p>
                  </td>
                  <td className="p-4">
                    <TaskAssigneeDisplay task={task} />
                  </td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    {readOnly ? (
                      <Badge variant="outline" className={`${getStatusColor(task.status)} border-0`}>
                        {task.status.replace("-", " ")}
                      </Badge>
                    ) : (
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleStatusChange(task.id, value as Task["status"])}
                    >
                      <SelectTrigger className="w-[140px]">
                        <Badge variant="outline" className={`${getStatusColor(task.status)} border-0`}>
                          {task.status.replace("-", " ")}
                        </Badge>
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
                    )}
                  </td>
                  <td className="p-4">
                    <Badge variant="outline" className={getPriorityColor(task.priority)}>
                      {task.priority}
                    </Badge>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 min-w-[100px]">
                      {(() => {
                        const pct = getTaskDisplayProgressWithCache(task.id, task)
                        return pct !== null ? (
                          <>
                            <Progress value={pct} className="flex-1 h-2" />
                            <span className="text-xs text-muted-foreground w-12">
                              {pct === 100 ? 'Complete' : `${pct}%`}
                            </span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-sm ${
                        taskIsOverdue(task) ? "text-red-500 font-semibold" : "text-foreground"
                      }`}
                    >
                      {formatDeadline(task)}
                    </span>
                  </td>
                  {!readOnly ? (
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => handleTaskClick(task)}>
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTasks.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">No tasks found</div>
        )}
      </Card>

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
