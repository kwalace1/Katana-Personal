"use client"
import { useState, useEffect, useRef } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Project, Task } from "@/lib/project-data"
import { formatDueDateLabel, isPmTaskOverdue } from "@/lib/due-date-utils"
import { canMarkTaskDone } from "@/lib/project-data"
import { getTaskDisplayProgressWithCache } from "@/lib/project-data-supabase"
import { updateTaskStatus, reorderTasks, getTaskWithCachedSubtasks } from "@/lib/project-data-supabase"
import { toast } from "sonner"
import { GripVertical, Plus, Circle, CircleDot } from "lucide-react"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"
import { TaskAssigneeDisplay } from "@/components/projects/TaskAssigneePicker"

interface KanbanBoardProps {
  project: Project
  readOnly?: boolean
  onAddTask?: (defaultStatus?: Task["status"]) => void
  onTaskClick?: (task: Task) => void
}

interface DragData {
  task: Task
  sourceColumnId: string
}

const statusColumns = [
  { id: "backlog", label: "Backlog", color: "bg-muted" },
  { id: "todo", label: "To Do", color: "bg-blue-500/10" },
  { id: "in-progress", label: "In Progress", color: "bg-yellow-500/10" },
  { id: "review", label: "Review", color: "bg-purple-500/10" },
  { id: "blocked", label: "Blocked", color: "bg-red-500/10" },
  { id: "done", label: "Done", color: "bg-green-500/10" },
] as const

function TaskCard({ 
  task, 
  onDragStart, 
  onClick,
  onDragOver,
  isDraggedOver,
  isBeingDragged,
  isSelected,
  onToggleSelect,
  onDragEnd,
  readOnly = false,
}: { 
  task: Task
  onDragStart: (task: Task) => void
  onClick: (task: Task) => void
  onDragOver: () => void
  isDraggedOver: boolean
  isBeingDragged: boolean
  isSelected: boolean
  onToggleSelect: (e: React.MouseEvent, taskId: string) => void
  onDragEnd?: () => void
  readOnly?: boolean
}) {
  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "border-red-500/50 text-red-500 bg-red-500/10"
      case "medium":
        return "border-yellow-500/50 text-yellow-500 bg-yellow-500/10"
      case "low":
        return "border-green-500/50 text-green-500 bg-green-500/10"
    }
  }

  const overdue = task.isOverdue ?? isPmTaskOverdue(task)
  const dueLabel = task.dueDateLabel ?? formatDueDateLabel(task.deadline)

  return (
    <div className="relative">
      {isDraggedOver && (
        <div className="absolute -top-2 left-0 right-0 h-1 bg-primary rounded-full shadow-lg shadow-primary/50 z-10 animate-pulse" />
      )}
      <Card
        draggable={!readOnly}
        onDragStart={readOnly ? undefined : (e) => {
          e.dataTransfer.effectAllowed = "move"
          e.dataTransfer.setData("text/plain", task.id)
          onDragStart(task)
          console.log("[v0] Started dragging:", task.title)
        }}
        onDragEnd={() => {
          onDragEnd?.()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          e.stopPropagation()
          onDragOver()
        }}
        onClick={() => onClick(task)}
        className={`p-3 cursor-pointer hover:shadow-lg transition-all group ${
          isBeingDragged ? 'opacity-40 scale-95' : 'active:opacity-50'
        } ${
          isDraggedOver ? 'ring-2 ring-primary ring-offset-2 bg-primary/5 scale-[1.02]' : ''
        } ${isSelected ? 'ring-2 ring-primary ring-offset-2 bg-primary/10' : ''}`}
      >
      <div className="flex items-start gap-2">
        {!readOnly ? (
        <button
          type="button"
          className="shrink-0 p-0.5 rounded hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50"
          onClick={(e) => {
            e.stopPropagation()
            onToggleSelect(e, task.id)
          }}
          aria-label={isSelected ? 'Deselect task' : 'Select task'}
        >
          {isSelected ? (
            <CircleDot className="w-4 h-4 text-primary" aria-hidden />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground opacity-60 hover:opacity-100" aria-hidden />
          )}
        </button>
        ) : null}
        {!readOnly ? (
        <div className="cursor-grab active:cursor-grabbing mt-0.5">
          <GripVertical className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
        </div>
        ) : null}
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-medium text-foreground leading-tight">{task.title}</h4>

          <TaskAssigneeDisplay task={task} showNames={false} />

          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
              {task.priority}
            </Badge>
            <span
              className={`text-xs ${
                overdue ? "text-red-500 font-semibold" : "text-muted-foreground"
              }`}
            >
              {dueLabel}
            </span>
          </div>

          {(() => {
            const pct = getTaskDisplayProgressWithCache(task.id, task)
            return pct !== null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-foreground font-medium">
                    {pct === 100 ? "Complete" : `${pct}%`}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            ) : null
          })()}
        </div>
      </div>
    </Card>
    </div>
  )
}

function Column({
  column,
  tasks,
  onDrop,
  onDragStart,
  onAddTask,
  onTaskClick,
  onReorder,
  projectId,
  draggedTaskId,
  draggingTaskIds,
  selectedTaskIds,
  onToggleSelect,
  onDragEnd,
  readOnly = false,
}: {
  column: (typeof statusColumns)[number]
  tasks: Task[]
  onDrop: (status: Task["status"]) => void
  onDragStart: (task: Task, columnId: string) => void
  onAddTask?: (defaultStatus?: Task["status"]) => void
  onTaskClick: (task: Task) => void
  onReorder: (taskId: string, targetIndex: number) => void
  projectId: string
  draggedTaskId: string | null
  draggingTaskIds: string[]
  selectedTaskIds: Set<string>
  onToggleSelect: (e: React.MouseEvent, taskId: string) => void
  onDragEnd?: () => void
  readOnly?: boolean
}) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null)

  const handleTaskDragOver = (taskId: string) => {
    setDragOverTaskId(taskId)
  }

  const isBulkDrag = draggingTaskIds.length > 1

  return (
    <div
      onDragOver={readOnly ? undefined : (e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = "move"
        setIsDragOver(true)
      }}
      onDragLeave={readOnly ? undefined : () => {
        setIsDragOver(false)
        setDragOverTaskId(null)
      }}
      onDrop={readOnly ? undefined : (e) => {
        e.preventDefault()
        setIsDragOver(false)
        setDragOverTaskId(null)
        
        const taskId = e.dataTransfer.getData("text/plain")
        const draggedTask = tasks.find(t => t.id === taskId)
        
        // When moving multiple tasks, always change column (no reorder)
        if (isBulkDrag) {
          onDrop(column.id as Task["status"])
          return
        }
        
        // Check if we dropped on a specific task (single-task reorder)
        if (dragOverTaskId && draggedTask) {
          const targetIndex = tasks.findIndex(t => t.id === dragOverTaskId)
          if (targetIndex !== -1) {
            onReorder(taskId, targetIndex)
            return
          }
        }
        
        // Otherwise, just change the status
        onDrop(column.id as Task["status"])
      }}
      className={`
        flex flex-col w-[280px] shrink-0 rounded-lg border border-border/40 transition-all min-h-[400px]
        ${isDragOver ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.02]" : ""}
      `}
    >
      <div className={`p-3 rounded-t-lg ${column.color} border-b border-border/40`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">{column.label}</h3>
          <Badge variant="secondary" className="text-xs">
            {tasks.length}
          </Badge>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2">
        {tasks.map((task) => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onDragStart={(t) => onDragStart(t, column.id)} 
            onClick={onTaskClick}
            onDragOver={() => handleTaskDragOver(task.id)}
            isDraggedOver={dragOverTaskId === task.id}
            isBeingDragged={draggedTaskId === task.id || (isBulkDrag && draggingTaskIds.includes(task.id))}
            isSelected={selectedTaskIds.has(task.id)}
            onToggleSelect={onToggleSelect}
            onDragEnd={onDragEnd}
            readOnly={readOnly}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            {isDragOver ? "Drop here" : "No tasks"}
          </div>
        )}
      </div>

      {!readOnly ? (
      <div className="p-2 border-t border-border/40">
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full justify-start text-muted-foreground"
          onClick={() => onAddTask?.(column.id as Task["status"])}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add task
        </Button>
      </div>
      ) : null}
    </div>
  )
}

export function KanbanBoard({ project, readOnly = false, onAddTask, onTaskClick }: KanbanBoardProps) {
  const [tasks, setTasks] = useState<Task[]>(project.tasks)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [sourceColumnId, setSourceColumnId] = useState<string | null>(null)
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set())
  const [draggingTaskIds, setDraggingTaskIds] = useState<string[]>([])
  const dropInFlight = useRef(false)

  useEffect(() => {
    if (dropInFlight.current) return
    setTasks(project.tasks)
  }, [project.tasks])

  const getTasksByStatus = (status: Task["status"]) => {
    return tasks.filter((task) => task.status === status)
  }

  const handleToggleSelect = (e: React.MouseEvent, taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  const handleDragStart = (task: Task, columnId: string) => {
    setDraggedTask(task)
    setSourceColumnId(columnId)
    if (selectedTaskIds.has(task.id)) {
      setDraggingTaskIds(Array.from(selectedTaskIds))
    } else {
      setDraggingTaskIds([task.id])
    }
  }

  const handleDrop = async (newStatus: Task["status"]) => {
    if (readOnly) return
    const idsToMove = draggingTaskIds.length > 0 ? draggingTaskIds : (draggedTask ? [draggedTask.id] : [])
    if (idsToMove.length === 0) return

    const getTaskForId = (taskId: string): Task | undefined =>
      project.tasks.find((t) => t.id === taskId) ?? (taskId === draggedTask?.id ? draggedTask : tasks.find((t) => t.id === taskId))

    const getTaskForValidationAndPayload = (taskId: string): Task | undefined => {
      const task = getTaskForId(taskId)
      return task ? getTaskWithCachedSubtasks(taskId, task) : undefined
    }

    if (newStatus === "done") {
      for (const taskId of idsToMove) {
        const task = getTaskForValidationAndPayload(taskId)
        if (task && !canMarkTaskDone(task)) {
          toast.error("Complete all subtasks before marking this task as done.")
          setDraggedTask(null)
          setSourceColumnId(null)
          setDraggingTaskIds([])
          setSelectedTaskIds(new Set())
          return
        }
      }
    }

    // Optimistic update FIRST so the card stays in the new column immediately
    dropInFlight.current = true
    setTasks((prevTasks) =>
      prevTasks.map((task) =>
        idsToMove.includes(task.id) ? { ...task, status: newStatus } : task
      ),
    )
    setDraggedTask(null)
    setSourceColumnId(null)
    setDraggingTaskIds([])
    setSelectedTaskIds(new Set())

    try {
      for (const taskId of idsToMove) {
        await updateTaskStatus(project.id, taskId, newStatus, getTaskForValidationAndPayload(taskId))
      }
      // Keep the guard up long enough for the parent re-fetch (triggered by
      // the projectDataUpdated event inside updateTaskStatus) to complete
      // and re-render with the correct server data before we accept prop syncs.
      setTimeout(() => { dropInFlight.current = false }, 2000)
    } catch (e) {
      dropInFlight.current = false
      setTasks(project.tasks)
      toast.error(e instanceof Error ? e.message : "Could not update task")
    }
  }

  const handleDragEnd = () => {
    if (dropInFlight.current) return
    setDraggedTask(null)
    setSourceColumnId(null)
    setDraggingTaskIds([])
  }

  const handleReorder = (taskId: string, targetIndex: number) => {
    if (!draggedTask) {
      console.log("[v0] No dragged task found for reorder!")
      return
    }

    console.log("[v0] Reordering task", taskId, "to index", targetIndex)

    // Get all tasks in the same status as the dragged task
    const tasksInColumn = tasks.filter(t => t.status === draggedTask.status)
    const currentIndex = tasksInColumn.findIndex(t => t.id === draggedTask.id)
    
    if (currentIndex === targetIndex) {
      console.log("[v0] Task is already at target position")
      setDraggedTask(null)
      setSourceColumnId(null)
      return
    }

    // Calculate the global index in the tasks array
    let globalTargetIndex = 0
    let countInStatus = 0
    
    for (let i = 0; i < tasks.length; i++) {
      if (tasks[i].status === draggedTask.status) {
        if (countInStatus === targetIndex) {
          globalTargetIndex = i
          break
        }
        countInStatus++
      }
    }

    // Call reorder function
    reorderTasks(project.id, draggedTask.id, globalTargetIndex)

    // Update local state optimistically
    const newTasks = [...tasks]
    const draggedIndex = newTasks.findIndex(t => t.id === draggedTask.id)
    const [removed] = newTasks.splice(draggedIndex, 1)
    newTasks.splice(globalTargetIndex, 0, removed)
    setTasks(newTasks)

    setDraggedTask(null)
    setSourceColumnId(null)
    setDraggingTaskIds([])
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold text-foreground">Kanban Board</h2>
        <div className="flex items-center gap-2">
          {!readOnly && selectedTaskIds.size > 0 && (
            <span className="text-sm text-muted-foreground">
              {selectedTaskIds.size} selected — drag to move all
            </span>
          )}
          {!readOnly ? (
          <Button size="sm" onClick={() => onAddTask?.()}>
            <Plus className="w-4 h-4 mr-2" />
            Add Task
          </Button>
          ) : null}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-2 min-w-0 -mx-1 px-1 scroll-smooth">
        {statusColumns.map((column) => {
          const columnTasks = getTasksByStatus(column.id as Task["status"])

          return (
            <Column
              key={column.id}
              column={column}
              tasks={columnTasks}
              onDrop={handleDrop}
              onDragStart={handleDragStart}
              onAddTask={onAddTask}
              onTaskClick={onTaskClick || (() => {})}
              onReorder={handleReorder}
              projectId={project.id}
              draggedTaskId={draggedTask?.id || null}
              draggingTaskIds={draggingTaskIds}
              selectedTaskIds={selectedTaskIds}
              onToggleSelect={handleToggleSelect}
              onDragEnd={handleDragEnd}
              readOnly={readOnly}
            />
          )
        })}
      </div>
    </div>
  )
}
