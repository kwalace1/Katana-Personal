import { formatDateOnly } from '@/lib/due-date-utils'
import { TaskAssigneePicker, TaskAssigneeDisplay } from '@/components/projects/TaskAssigneePicker'
import { getTaskAssignees, mergeAssigneeFields } from '@/lib/task-assignees'
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateTask, deleteTask, getProjectTeamMembers, type Task } from "@/lib/project-data-supabase"
import { getTaskComments, addTaskComment } from "@/lib/supabase-api"
import { getTaskWithCachedSubtasks, setSubtasksCache } from "@/lib/subtasks-cache"
import type { Activity, Subtask, TeamMember } from "@/lib/project-data"
import { canMarkTaskDone, enrichSubtaskUpdates, formatSubtaskCompletionMeta } from "@/lib/project-data"
import { randomId } from "@/lib/utils"
import { toast } from "sonner"
import { useAuth } from "@/contexts/AuthContext"
import { Edit, Trash2, Calendar, User, Flag, CheckCircle, TrendingUp, Plus, X, Send, MessageSquare, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useEffect, useRef } from "react"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"
import { ModuleDiscussion } from "@/components/comms/ModuleDiscussion"

interface TaskDetailsDialogProps {
  projectId: string
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskSaved?: (task: Task) => void
  readOnly?: boolean
}

function formatCommentTime(timestamp: string): string {
  const d = new Date(timestamp)
  if (isNaN(d.getTime())) return timestamp
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDays = Math.floor(diffHr / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TaskDetailsDialog({ 
  projectId, 
  task,
  open, 
  onOpenChange,
  onTaskSaved,
  readOnly = false,
}: TaskDetailsDialogProps) {
  const { profile } = useAuth()
  const [mode, setMode] = useState<'view' | 'edit'>('view')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [formData, setFormData] = useState<Task | null>(task)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const addSubtaskRef = useRef<HTMLButtonElement>(null)

  const [comments, setComments] = useState<Activity[]>([])
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    void getProjectTeamMembers(projectId).then(setTeamMembers).catch(() => setTeamMembers([]))
  }, [open, projectId])

  useEffect(() => {
    if (!open || !task) return
    void getTaskComments(task.id).then(setComments).catch(() => setComments([]))
  }, [open, task?.id])

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const handleAddComment = async () => {
    if (readOnly || !newComment.trim() || !task) return
    setSubmittingComment(true)
    const userName = profile?.full_name || profile?.email || 'You'
    const result = await addTaskComment(projectId, task.id, newComment.trim(), userName)
    if (result) {
      setComments(prev => [...prev, result])
      setNewComment('')
    } else {
      toast.error('Failed to add comment')
    }
    setSubmittingComment(false)
  }

  // Legacy tasks: infer HR ids from assignee display names once team loads
  useEffect(() => {
    if (!open || !task || teamMembers.length === 0) return
    const assignees = getTaskAssignees(task)
    const needsEnrichment = assignees.some((a) => !a.employeeId?.trim())
    if (!needsEnrichment && task.assigneeEmployeeId) return

    const enriched = assignees.map((a) => {
      if (a.employeeId?.trim()) return a
      const match = teamMembers.find((m) => m.name.trim().toLowerCase() === a.name.trim().toLowerCase())
      if (!match) return a
      return {
        ...a,
        employeeId: match.hrEmployeeId || null,
        avatar: a.avatar || match.avatar || "/placeholder.svg?height=32&width=32",
      }
    })

    const merged = mergeAssigneeFields({
      ...task,
      assignees: enriched,
    })

    setFormData((fd) =>
      fd && fd.id === task.id
        ? {
            ...fd,
            assignees: merged.assignees,
            assigneeEmployeeId: merged.assigneeEmployeeId,
            assignee: merged.assignee,
          }
        : fd
    )
  }, [open, task, teamMembers])

  const addSubtaskInEdit = () => {
    setFormData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        subtasks: [...(prev.subtasks ?? []), { id: randomId(), title: '', completed: false }],
      }
    })
  }

  // Native click listener so Add subtask works (must run before any early return to keep hook count consistent)
  useEffect(() => {
    const el = addSubtaskRef.current
    if (!el) return
    const handler = () => addSubtaskInEdit()
    el.addEventListener('click', handler)
    return () => el.removeEventListener('click', handler)
  }, [mode])

  // Keep global subtasks cache in sync so Kanban can block Done and preserve subtasks even before save
  useEffect(() => {
    if (formData?.id != null && formData.subtasks != null) {
      setSubtasksCache(formData.id, formData.subtasks)
    }
  }, [formData?.id, formData?.subtasks])

  useEffect(() => {
    if (!open || !task) return
    const loaded = getTaskWithCachedSubtasks(task.id, task)
    setFormData({
      ...loaded,
      assignees: getTaskAssignees(loaded),
    })
    setMode('view')
  }, [open, task])

  useEffect(() => {
    if (readOnly && mode === 'edit') setMode('view')
  }, [readOnly, mode])

  if (!task || !formData) return null

  const handleSave = async () => {
    if (!formData.title.trim()) return

    const subtasks = (formData.subtasks ?? []).filter((s) => s.title.trim()).map((s) => ({ ...s, title: s.title.trim() }))
    const merged = mergeAssigneeFields({
      assignees: formData.assignees ?? getTaskAssignees(formData),
      assignee: formData.assignee,
      assigneeEmployeeId: formData.assigneeEmployeeId ?? null,
    })
    const updates: Partial<Task> = {
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      assignees: merged.assignees,
      assignee: merged.assignee,
      assigneeEmployeeId: merged.assigneeEmployeeId,
      deadline: formData.deadline,
      status: formData.status,
      subtasks,
    }

    if (formData.status === "done") {
      const merged = { ...formData, subtasks } as Task
      if (!canMarkTaskDone(merged)) {
        toast.error("Complete all subtasks before marking this task as done.")
        return
      }
    }

    try {
      const savedTask = await updateTask(projectId, task.id, updates)
      const updatedTask: Task = savedTask ?? { ...task, ...updates, id: task.id }
      onTaskSaved?.(updatedTask)
      setMode('view')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save task")
    }
  }

  const handleDelete = async () => {
    await deleteTask(projectId, task.id)
    setDeleteDialogOpen(false)
    onOpenChange(false)
  }

  const subtasks = formData.subtasks ?? []
  const completedCount = subtasks.filter((s) => s.completed).length
  const progressFromSubtasks = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : null

  const handleSubtaskToggle = async (subId: string) => {
    if (readOnly) return
    const actorName = profile?.full_name || profile?.email || 'You'
    const toggled = subtasks.map((s) => (s.id === subId ? { ...s, completed: !s.completed } : s))
    const updated = enrichSubtaskUpdates(subtasks, toggled, actorName)
    const nextTask = { ...formData, subtasks: updated }
    setFormData(nextTask)
    setSubtasksCache(task.id, updated)
    try {
      const savedTask = await updateTask(projectId, task.id, { subtasks: updated })
      onTaskSaved?.(savedTask ?? { ...task, ...nextTask, id: task.id })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update subtask')
      setFormData(getTaskWithCachedSubtasks(task.id, task))
    }
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "text-red-600 bg-red-500/10 border-red-500"
      case "medium":
        return "text-yellow-600 bg-yellow-500/10 border-yellow-500"
      case "low":
        return "text-green-600 bg-green-500/10 border-green-500"
    }
  }

  const getStatusColor = (status: Task["status"]) => {
    switch (status) {
      case "done":
        return "text-green-600 bg-green-500/10 border-green-500"
      case "in-progress":
        return "text-blue-600 bg-blue-500/10 border-blue-500"
      case "review":
        return "text-purple-600 bg-purple-500/10 border-purple-500"
      case "blocked":
        return "text-red-600 bg-red-500/10 border-red-500"
      case "todo":
        return "text-gray-600 bg-gray-500/10 border-gray-500"
      default:
        return "text-gray-600 bg-gray-500/10 border-gray-500"
    }
  }

  const formatDeadline = (deadline: string) => {
    if (!deadline) return 'No deadline set'
    return formatDateOnly(deadline, 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{mode === 'view' ? 'Task Details' : 'Edit Task'}</DialogTitle>
            <div className="absolute right-14 top-4 flex gap-2">
              {!readOnly && mode === 'view' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMode('edit')}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </>
              ) : !readOnly && mode === 'edit' ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setFormData(task)
                      setMode('view')
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSave}
                  >
                    Save
                  </Button>
                </>
              ) : null}
            </div>
          </DialogHeader>

          <Tabs defaultValue="details" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="comments" className="gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Comments{comments.length > 0 && ` (${comments.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4 pt-4">
              {mode === 'view' ? (
                // View Mode
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
                    {task.description && (
                      <p className="text-sm text-muted-foreground">{task.description}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Status:</span>
                      </div>
                      <Badge className={getStatusColor(task.status)}>
                        {task.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Flag className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Priority:</span>
                      </div>
                      <Badge className={getPriorityColor(task.priority)}>
                        {task.priority.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">Assignees:</span>
                      </div>
                      <TaskAssigneeDisplay task={task} size="md" />
                    </div>

                    {task.deadline && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="w-4 h-4 text-muted-foreground" />
                          <span className="font-medium">Deadline:</span>
                        </div>
                        <p className="text-sm">{formatDeadline(task.deadline)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Progress
                      </span>
                      <span className="text-lg font-semibold text-primary">
                        {progressFromSubtasks !== null
                          ? `${progressFromSubtasks}% (${completedCount}/${subtasks.length} subtasks)`
                          : task.status === 'done'
                            ? 'Complete'
                            : 'In progress'}
                      </span>
                    </div>
                    {(progressFromSubtasks !== null || task.status === 'done') && (
                      <div className="w-full bg-muted rounded-full h-2.5">
                        <div
                          className="bg-primary rounded-full h-2.5 transition-all"
                          style={{ width: `${progressFromSubtasks ?? 100}%` }}
                        />
                      </div>
                    )}
                    {progressFromSubtasks === null && (
                      <p className="text-xs text-muted-foreground">
                        Progress is based on status. Add subtasks or move to Done on the board to complete.
                      </p>
                    )}
                  </div>

                  {subtasks.length > 0 && (
                    <div className="space-y-2">
                      <span className="font-medium text-sm">Subtasks</span>
                      <ul className="space-y-1.5">
                        {subtasks.map((sub) => {
                          const completionMeta = formatSubtaskCompletionMeta(sub)
                          return (
                            <li key={sub.id} className="flex items-start gap-2">
                              <button
                                type="button"
                                onClick={() => handleSubtaskToggle(sub.id)}
                                className="shrink-0 rounded border p-0.5 mt-0.5 focus:ring-2 focus:ring-primary/50"
                                aria-label={sub.completed ? 'Mark incomplete' : 'Mark complete'}
                              >
                                {sub.completed ? (
                                  <CheckCircle className="h-4 w-4 text-primary" />
                                ) : (
                                  <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/50" />
                                )}
                              </button>
                              <div className="min-w-0 flex-1">
                                <span className={sub.completed ? 'text-muted-foreground line-through' : ''}>
                                  {sub.title || '(Untitled)'}
                                </span>
                                {completionMeta && (
                                  <p className="text-xs text-foreground/70 mt-1 flex items-center gap-1.5">
                                    <User className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                    <span>{completionMeta}</span>
                                  </p>
                                )}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-title">Task Title *</Label>
                    <Input
                      id="edit-title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter task title..."
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Enter task description..."
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="edit-status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value) => setFormData({ ...formData, status: value as Task["status"] })}
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
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="edit-priority">Priority</Label>
                      <Select
                        value={formData.priority}
                        onValueChange={(value) => setFormData({ ...formData, priority: value as Task["priority"] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-assignee">Assignees</Label>
                    <TaskAssigneePicker
                      id="edit-assignee"
                      teamMembers={teamMembers}
                      value={formData.assignees ?? getTaskAssignees(formData)}
                      onChange={(assignees) => {
                        const merged = mergeAssigneeFields({
                          assignees,
                          assignee: formData.assignee,
                          assigneeEmployeeId: formData.assigneeEmployeeId ?? null,
                        })
                        setFormData({
                          ...formData,
                          assignees: merged.assignees,
                          assignee: merged.assignee,
                          assigneeEmployeeId: merged.assigneeEmployeeId,
                        })
                      }}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="edit-deadline">Deadline (Optional)</Label>
                    <Input
                      id="edit-deadline"
                      type="date"
                      value={formData.deadline || ''}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label>Subtasks (optional)</Label>
                    <p className="text-xs text-muted-foreground">
                      Progress is calculated from completed subtasks. Toggle in view mode.
                    </p>
                    {(formData.subtasks ?? []).map((sub, index) => (
                      <div key={sub.id} className="flex gap-2 items-center">
                        <Input
                          value={sub.title}
                          onChange={(e) => {
                            const next = [...(formData.subtasks ?? [])]
                            next[index] = { ...next[index], title: e.target.value }
                            setFormData({ ...formData, subtasks: next })
                          }}
                          placeholder="Subtask title..."
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              subtasks: (formData.subtasks ?? []).filter((_, i) => i !== index),
                            })
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <button
                      ref={addSubtaskRef}
                      type="button"
                      className="inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 px-4 py-2 w-full cursor-pointer"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add subtask
                    </button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="comments" className="pt-4">
              <div className="flex flex-col h-[320px]">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1 mb-3">
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <MessageSquare className="w-8 h-8 mb-2 opacity-40" />
                      <p className="text-sm">No comments yet</p>
                      <p className="text-xs">Be the first to comment on this task</p>
                    </div>
                  ) : (
                    comments.map((c) => {
                      const isOwn = c.user === (profile?.full_name || profile?.email || 'You')
                      return (
                        <div key={c.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                            isOwn
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}>
                            {!isOwn && (
                              <p className="text-xs font-semibold mb-0.5 opacity-70">{c.user}</p>
                            )}
                            <p className="whitespace-pre-wrap">{c.description}</p>
                            <p className={`text-[10px] mt-1 ${isOwn ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                              {formatCommentTime(c.timestamp)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                  <div ref={commentsEndRef} />
                </div>

                {!readOnly ? (
                <div className="flex gap-2 border-t pt-3">
                  <Input
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleAddComment()
                      }
                    }}
                    disabled={submittingComment}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                ) : null}
              </div>
              {task && (
                <ModuleDiscussion
                  contextType="task"
                  contextId={task.id}
                  title="Team discussion (Comms)"
                  className="mt-4 border-t pt-3"
                />
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Task</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

