import { formatDateOnly } from '@/lib/due-date-utils'
"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import type { Project, Task } from "@/lib/project-data"
import { getTaskDisplayProgressWithCache } from "@/lib/project-data-supabase"
import * as ProjectData from "@/lib/project-data-supabase"
import { Plus, Play, CheckCircle2, Calendar, Users, Target, TrendingUp, Flag, X, Trash2, Lightbulb, Info } from "lucide-react"
import { TaskAssigneeDisplay } from "@/components/projects/TaskAssigneePicker"
import { AddTaskDialog } from "./add-task-dialog"

interface SprintViewProps {
  project: Project
  onProjectUpdate?: () => void
  readOnly?: boolean
}

interface Sprint {
  id: string
  name: string
  goal: string
  startDate: string
  endDate: string
  status: "planned" | "active" | "completed"
  taskIds: string[]
}

export function SprintView({ project, onProjectUpdate, readOnly = false }: SprintViewProps) {
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [selectedSprint, setSelectedSprint] = useState<Sprint | null>(null)
  const [newSprint, setNewSprint] = useState({
    name: "",
    goal: "",
    startDate: "",
    endDate: "",
  })
  const [selectedTasks, setSelectedTasks] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [suggestedTaskIdsToAdd, setSuggestedTaskIdsToAdd] = useState<string[] | null>(null)
  const { toast } = useToast()

  // Load sprints from Supabase
  const loadSprints = async () => {
    setIsLoading(true)
    try {
      const sprintsData = await ProjectData.getProjectSprints(project.id)
      setSprints(sprintsData)
    } catch (error) {
      console.error("[SprintView] Error loading sprints:", error)
      toast({
        title: "Error",
        description: "Failed to load sprints",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadSprints()
  }, [project.id])

  // Listen for project data updates
  useEffect(() => {
    const handleProjectUpdate = () => {
      loadSprints()
    }

    window.addEventListener('projectDataUpdated', handleProjectUpdate)
    return () => window.removeEventListener('projectDataUpdated', handleProjectUpdate)
  }, [project.id])

  const activeSprint = sprints.find(s => s.status === "active")
  const plannedSprints = sprints.filter(s => s.status === "planned")
  const completedSprints = sprints.filter(s => s.status === "completed")

  const taskIdsInSprints = useMemo(() => {
    const set = new Set<string>()
    sprints.forEach((s) => s.taskIds.forEach((id) => set.add(id)))
    return set
  }, [sprints])

  const suggestedSprints = useMemo(() => {
    const unmapped = project.tasks.filter((t) => t.deadline && !taskIdsInSprints.has(t.id))
    if (unmapped.length === 0) return []

    const byMonth = new Map<string, Task[]>()
    for (const task of unmapped) {
      const monthKey = task.deadline.slice(0, 7)
      const list = byMonth.get(monthKey) || []
      list.push(task)
      byMonth.set(monthKey, list)
    }

    return Array.from(byMonth.entries())
      .map(([monthKey, tasks]) => {
        const [y, m] = monthKey.split("-").map(Number)
        const startDate = `${monthKey}-01`
        const lastDay = new Date(y, m, 0).getDate()
        const endDate = `${monthKey}-${String(lastDay).padStart(2, "0")}`
        const monthName = formatDateOnly(`${monthKey}-01`, { month: "long" })
        const sorted = [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline))
        return {
          name: `Sprint ${monthName} ${y}`,
          goal: `Complete ${sorted.length} task${sorted.length !== 1 ? "s" : ""} by end of ${monthName}`,
          startDate,
          endDate,
          taskIds: sorted.map((t) => t.id),
          taskCount: sorted.length,
        }
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }, [project.tasks, taskIdsInSprints])

  const getSprintTasks = (sprintId: string) => {
    const sprint = sprints.find(s => s.id === sprintId)
    if (!sprint) return []
    return project.tasks.filter(t => sprint.taskIds.includes(t.id))
  }

  const getSprintProgress = (sprintId: string) => {
    const sprintTasks = getSprintTasks(sprintId)
    if (sprintTasks.length === 0) return 0
    const completedTasks = sprintTasks.filter(t => t.status === "done").length
    return Math.round((completedTasks / sprintTasks.length) * 100)
  }

  const handleAddSprint = async () => {
    if (newSprint.name && newSprint.startDate && newSprint.endDate) {
      setIsSubmitting(true)
      try {
        const sprintId = await ProjectData.createSprint(project.id, {
          name: newSprint.name,
          goal: newSprint.goal,
          startDate: newSprint.startDate,
          endDate: newSprint.endDate,
          status: "planned",
        })

        if (sprintId) {
          toast({
            title: "Sprint created",
            description: `${newSprint.name} has been created successfully`,
          })
          setNewSprint({ name: "", goal: "", startDate: "", endDate: "" })
          setIsDialogOpen(false)
          await loadSprints()
          onProjectUpdate?.()
        } else {
          throw new Error("Failed to create sprint")
        }
      } catch (error) {
        console.error("[SprintView] Error creating sprint:", error)
        const errorMessage = error instanceof Error && error.message === 'Supabase is not configured'
          ? "Database is not configured. Please set up your environment variables."
          : "Failed to create sprint. Check console for details."
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
      } finally {
        setIsSubmitting(false)
      }
    }
  }

  const handleStartSprint = async (sprintId: string) => {
    setIsSubmitting(true)
    try {
      const success = await ProjectData.startSprint(sprintId)
      
      if (success) {
        toast({
          title: "Sprint started",
          description: "The sprint is now active",
        })
        await loadSprints()
        onProjectUpdate?.()
      } else {
        throw new Error("Failed to start sprint")
      }
    } catch (error) {
      console.error("[SprintView] Error starting sprint:", error)
      toast({
        title: "Error",
        description: "Failed to start sprint",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCompleteSprint = async (sprintId: string) => {
    setIsSubmitting(true)
    try {
      const success = await ProjectData.completeSprint(sprintId)
      
      if (success) {
        toast({
          title: "Sprint completed",
          description: "The sprint has been marked as completed",
        })
        await loadSprints()
        onProjectUpdate?.()
      } else {
        throw new Error("Failed to complete sprint")
      }
    } catch (error) {
      console.error("[SprintView] Error completing sprint:", error)
      toast({
        title: "Error",
        description: "Failed to complete sprint",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSprint = async (sprintId: string) => {
    setIsSubmitting(true)
    try {
      const success = await ProjectData.deleteSprint(sprintId)
      
      if (success) {
        toast({
          title: "Sprint deleted",
          description: "The sprint has been removed",
        })
        await loadSprints()
        onProjectUpdate?.()
      } else {
        throw new Error("Failed to delete sprint")
      }
    } catch (error) {
      console.error("[SprintView] Error deleting sprint:", error)
      toast({
        title: "Error",
        description: "Failed to delete sprint",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOpenTaskDialog = (sprint: Sprint) => {
    setSelectedSprint(sprint)
    setSelectedTasks(sprint.taskIds)
    setIsTaskDialogOpen(true)
  }

  const handleAddTasksToSprint = async () => {
    if (!selectedSprint) return

    setIsSubmitting(true)
    try {
      // Find tasks to add and remove
      const currentTaskIds = selectedSprint.taskIds
      const tasksToAdd = selectedTasks.filter(id => !currentTaskIds.includes(id))
      const tasksToRemove = currentTaskIds.filter(id => !selectedTasks.includes(id))

      console.log('[SprintView] Current task IDs:', currentTaskIds)
      console.log('[SprintView] Selected task IDs:', selectedTasks)
      console.log('[SprintView] Tasks to add:', tasksToAdd)
      console.log('[SprintView] Tasks to remove:', tasksToRemove)

      // Add new tasks
      for (const taskId of tasksToAdd) {
        console.log('[SprintView] Adding task to sprint:', taskId)
        const success = await ProjectData.addTaskToSprint(selectedSprint.id, taskId)
        console.log('[SprintView] Add task result:', success)
      }

      // Remove deselected tasks
      for (const taskId of tasksToRemove) {
        console.log('[SprintView] Removing task from sprint:', taskId)
        const success = await ProjectData.removeTaskFromSprint(selectedSprint.id, taskId)
        console.log('[SprintView] Remove task result:', success)
      }

      toast({
        title: "Tasks updated",
        description: `Sprint tasks have been updated`,
      })
      
      setIsTaskDialogOpen(false)
      await loadSprints()
      onProjectUpdate?.()
    } catch (error) {
      console.error("[SprintView] Error updating tasks:", error)
      toast({
        title: "Error",
        description: "Failed to update sprint tasks",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
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

  if (isLoading) {
    return <div className="flex items-center justify-center p-12">
      <div className="text-center text-muted-foreground">Loading sprints...</div>
    </div>
  }

  return (
    <div className="space-y-4">
      {/* Sprint Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Sprint Board</h2>
          <p className="text-sm text-muted-foreground">Manage your sprints and track progress</p>
        </div>
        {!readOnly ? (
        <Button size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          New Sprint
        </Button>
        ) : null}
      </div>

      {/* Sprint metrics – one rectangular bar */}
      <Card className="overflow-hidden border-border bg-card/50">
        <div className="stat-bar">
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Play className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Active Sprint</p>
              <p className="text-2xl font-bold tabular-nums">{activeSprint ? "1" : "0"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {activeSprint ? activeSprint.name : "No active sprint"}
              </p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Target className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Total Tasks</p>
              <p className="text-2xl font-bold tabular-nums">
                {activeSprint ? getSprintTasks(activeSprint.id).length : 0}
              </p>
              <p className="text-xs text-muted-foreground">
                {activeSprint
                  ? `${getSprintTasks(activeSprint.id).filter((t) => t.status === "done").length} completed`
                  : "N/A"}
              </p>
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="stat-bar-label">Progress</p>
              <p className="text-2xl font-bold tabular-nums">
                {activeSprint ? `${getSprintProgress(activeSprint.id)}%` : "0%"}
              </p>
              <Progress value={activeSprint ? getSprintProgress(activeSprint.id) : 0} className="mt-2 h-2" />
            </div>
          </div>
          <div className="stat-bar-item">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="stat-bar-label">Team Capacity</p>
              <p className="text-2xl font-bold tabular-nums">{project.team.length}</p>
              <p className="text-xs text-muted-foreground">Team members</p>
            </div>
          </div>
        </div>
      </Card>

      {/* How sprints work + suggested sprints */}
      <Card className="border-dashed border-primary/40 bg-primary/5">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Info className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">How sprints work</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Sprints are time-boxed periods (e.g. 1–2 weeks) where the team focuses on a set of tasks. Create a sprint with a goal and dates, add tasks, then start it. Only one sprint is active at a time. When the period ends, complete the sprint and plan the next.
              </p>
            </div>
          </div>
        </CardHeader>
        {suggestedSprints.length > 0 && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Suggested sprints</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Based on tasks not yet in a sprint, grouped by deadline
            </p>
            <div className="space-y-3">
              {suggestedSprints.map((sug) => (
                <div
                  key={sug.startDate + sug.endDate}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{sug.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sug.taskCount} task{sug.taskCount !== 1 ? "s" : ""} · {sug.startDate} → {sug.endDate}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={() => {
                      setNewSprint({
                        name: sug.name,
                        goal: sug.goal,
                        startDate: sug.startDate,
                        endDate: sug.endDate,
                      })
                      setSuggestedTaskIdsToAdd(sug.taskIds)
                      setIsDialogOpen(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Create sprint
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Sprint Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Sprint</TabsTrigger>
          <TabsTrigger value="planned">Planned ({plannedSprints.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completedSprints.length})</TabsTrigger>
        </TabsList>

        {/* Active Sprint */}
        <TabsContent value="active" className="space-y-4">
          {activeSprint ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-xl">{activeSprint.name}</CardTitle>
                      <Badge variant="default" className="bg-green-500">
                        <Play className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Target className="w-3 h-3 inline mr-1" />
                      {activeSprint.goal}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {activeSprint.startDate} → {activeSprint.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right mr-4">
                      <div className="text-3xl font-bold">{getSprintProgress(activeSprint.id)}%</div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenTaskDialog(activeSprint)}
                    >
                      Manage Tasks
                    </Button>
                    <Button 
                      size="sm"
                      variant="default"
                      onClick={() => handleCompleteSprint(activeSprint.id)}
                      disabled={isSubmitting}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Complete Sprint
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold">Sprint Tasks</h4>
                    <Badge variant="outline">
                      {getSprintTasks(activeSprint.id).length} tasks
                    </Badge>
                  </div>
                  {getSprintTasks(activeSprint.id).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-foreground">{task.title}</p>
                          <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                            <Flag className="w-3 h-3 mr-1" />
                            {task.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <TaskAssigneeDisplay task={task} />
                          <span>•</span>
                          <span>Due {task.deadline}</span>
                        </div>
                        {(() => {
                          const pct = getTaskDisplayProgressWithCache(task.id, task)
                          return pct !== null ? (
                            <div className="mt-2">
                              <Progress value={pct} className="h-1.5" />
                            </div>
                          ) : null
                        })()}
                      </div>
                      <Badge variant="outline" className={getStatusColor(task.status)}>
                        {task.status === "done" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                        {task.status.replace("-", " ")}
                      </Badge>
                    </div>
                  ))}
                  {getSprintTasks(activeSprint.id).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No tasks in this sprint yet</p>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-4"
                        onClick={() => handleOpenTaskDialog(activeSprint)}
                      >
                        Add Tasks
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Play className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Active Sprint</h3>
                <p className="mb-4">Start a sprint to begin tracking your team's progress</p>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Sprint
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Planned Sprints */}
        <TabsContent value="planned" className="space-y-4">
          {plannedSprints.map((sprint) => (
            <Card key={sprint.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                      <Badge variant="outline" className="border-blue-500 text-blue-600 bg-blue-500/20">
                        Planned
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Target className="w-3 h-3 inline mr-1" />
                      {sprint.goal}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {sprint.startDate} → {sprint.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleOpenTaskDialog(sprint)}
                    >
                      Manage Tasks
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      onClick={() => handleStartSprint(sprint.id)}
                      disabled={isSubmitting}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Start Sprint
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteSprint(sprint.id)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{getSprintTasks(sprint.id).length} tasks planned</span>
                  <span>Ready to start</span>
                </div>
              </CardContent>
            </Card>
          ))}
          {plannedSprints.length === 0 && (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Planned Sprints</h3>
                <p>Create a sprint to plan your upcoming work</p>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Completed Sprints */}
        <TabsContent value="completed" className="space-y-4">
          {completedSprints.map((sprint) => (
            <Card key={sprint.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-lg">{sprint.name}</CardTitle>
                      <Badge variant="outline" className="border-green-500 text-green-600 bg-green-500/20">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      <Target className="w-3 h-3 inline mr-1" />
                      {sprint.goal}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 inline mr-1" />
                      {sprint.startDate} → {sprint.endDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{getSprintProgress(sprint.id)}%</div>
                      <div className="text-xs text-muted-foreground">Complete</div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteSprint(sprint.id)}
                      disabled={isSubmitting}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
          {completedSprints.length === 0 && (
            <Card className="p-12">
              <div className="text-center text-muted-foreground">
                <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Completed Sprints</h3>
                <p>Complete your first sprint to see it here</p>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Sprint Dialog */}
      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) setSuggestedTaskIdsToAdd(null)
          setIsDialogOpen(open)
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Sprint</DialogTitle>
            <DialogDescription>
              Plan your next sprint with goals and timeline.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sprint-name">Sprint Name *</Label>
              <Input
                id="sprint-name"
                placeholder="e.g., Sprint 3 - Performance"
                value={newSprint.name}
                onChange={(e) => setNewSprint({ ...newSprint, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sprint-goal">Sprint Goal</Label>
              <Textarea
                id="sprint-goal"
                placeholder="What do you want to achieve in this sprint?"
                value={newSprint.goal}
                onChange={(e) => setNewSprint({ ...newSprint, goal: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sprint-start">Start Date *</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  value={newSprint.startDate}
                  onChange={(e) => setNewSprint({ ...newSprint, startDate: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sprint-end">End Date *</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  value={newSprint.endDate}
                  onChange={(e) => setNewSprint({ ...newSprint, endDate: e.target.value })}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddSprint}
              disabled={!newSprint.name || !newSprint.startDate || !newSprint.endDate || isSubmitting}
            >
              Create Sprint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manage Tasks Dialog */}
      <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Manage Sprint Tasks</DialogTitle>
            <DialogDescription>
              Select tasks to include in {selectedSprint?.name} (completed tasks excluded)
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-2">
              {project.tasks.filter(task => task.status !== 'done').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No available tasks</p>
                  <p className="text-xs mt-2">All tasks are completed</p>
                </div>
              ) : (
                project.tasks
                  .filter(task => task.status !== 'done')
                  .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/20 transition-all"
                  >
                    <Checkbox
                      checked={selectedTasks.includes(task.id)}
                      onCheckedChange={() => toggleTaskSelection(task.id)}
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm">{task.title}</p>
                        <Badge variant="outline" className={`text-xs ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </Badge>
                        <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                          {task.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <TaskAssigneeDisplay task={task} />
                        <span>• Due {task.deadline}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {selectedTasks.length} tasks selected
                </p>
                <Button variant="outline" size="sm" onClick={() => setIsCreateTaskOpen(true)}>
                  <Plus className="w-3 h-3 mr-1" />
                  New Task
                </Button>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleAddTasksToSprint}
                  disabled={isSubmitting}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {!readOnly ? (
      <AddTaskDialog
        projectId={project.id}
        open={isCreateTaskOpen}
        onOpenChange={setIsCreateTaskOpen}
        onTaskAdded={(task) => {
          setSelectedTasks(prev => [...prev, task.id])
          onProjectUpdate?.()
        }}
      />
      ) : null}
    </div>
  )
}

