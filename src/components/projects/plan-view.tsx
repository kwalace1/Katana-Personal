"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import type { Project, Task, Milestone } from "@/lib/project-data"
import { formatDueDateLabel, isPmTaskOverdue } from "@/lib/due-date-utils"
import { formatAssigneeSummary } from "@/lib/task-assignees"
import { getTaskDisplayProgressWithCache } from "@/lib/project-data-supabase"
import { CheckCircle2, Circle, Clock, AlertCircle, Target, Calendar, TrendingUp, Plus, Edit, Lightbulb } from "lucide-react"
import { AddMilestoneDialog } from "./add-milestone-dialog"
import { EditMilestoneDialog } from "./edit-milestone-dialog"
import * as ProjectData from "@/lib/project-data-supabase"

interface PlanViewProps {
  project: Project
  onProjectUpdate?: () => void
  readOnly?: boolean
}

export function PlanView({ project, onProjectUpdate, readOnly = false }: PlanViewProps) {
  const [addMilestoneDialogOpen, setAddMilestoneDialogOpen] = useState(false)
  const [editMilestoneDialogOpen, setEditMilestoneDialogOpen] = useState(false)
  const [selectedMilestone, setSelectedMilestone] = useState<Milestone | null>(null)
  const milestones = project.milestones || []

  // Suggested milestones: group unmapped tasks by deadline (e.g. by month) so user can add them as milestones
  const suggestedMilestones = useMemo(() => {
    const unmapped = project.tasks.filter((t) => !t.milestoneId && t.deadline)
    if (unmapped.length === 0) return []

    const byMonth = new Map<string, Task[]>()
    for (const task of unmapped) {
      const monthKey = task.deadline.slice(0, 7) // "2025-03"
      const list = byMonth.get(monthKey) || []
      list.push(task)
      byMonth.set(monthKey, list)
    }

    return Array.from(byMonth.entries())
      .map(([monthKey, tasks]) => {
        const sorted = [...tasks].sort((a, b) => a.deadline.localeCompare(b.deadline))
        const latest = sorted[sorted.length - 1]
        const [y, m] = monthKey.split("-")
        const monthName = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1).toLocaleString("default", { month: "long" })
        return {
          name: `${monthName} ${y}`,
          date: latest.deadline,
          taskIds: sorted.map((t) => t.id),
          taskCount: sorted.length,
        }
      })
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [project.tasks])

  // Group tasks by milestone
  const tasksByMilestone = new Map<string, Task[]>()
  const unmappedTasks: Task[] = []

  project.tasks.forEach((task) => {
    if (task.milestoneId) {
      const tasks = tasksByMilestone.get(task.milestoneId) || []
      tasks.push(task)
      tasksByMilestone.set(task.milestoneId, tasks)
    } else {
      // Only include unassigned tasks that are not completed
      if (task.status !== 'done') {
        unmappedTasks.push(task)
      }
    }
  })

  const getMilestoneProgress = (milestone: Milestone): number => {
    const tasks = tasksByMilestone.get(milestone.id) || []
    if (tasks.length === 0) return 0
    const completedTasks = tasks.filter(t => t.status === 'done').length
    return Math.round((completedTasks / tasks.length) * 100)
  }

  const getMilestoneStatusIcon = (milestone: Milestone) => {
    switch (milestone.status) {
      case "completed":
        return <CheckCircle2 className="w-8 h-8 text-green-500" />
      case "in-progress":
        return <Clock className="w-8 h-8 text-yellow-500 animate-pulse" />
      case "upcoming":
        return <Circle className="w-8 h-8 text-muted-foreground" />
    }
  }

  const getTaskStatusIcon = (task: Task) => {
    switch (task.status) {
      case "backlog":
        return <Circle className="w-4 h-4 text-muted-foreground fill-muted-foreground" />
      case "todo":
        return <Circle className="w-4 h-4 text-blue-500 fill-blue-500" />
      case "in-progress":
        return <Clock className="w-4 h-4 text-yellow-500 fill-yellow-500" />
      case "review":
        return <Circle className="w-4 h-4 text-purple-500 fill-purple-500" />
      case "blocked":
        return <AlertCircle className="w-4 h-4 text-red-500 fill-red-500" />
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-green-500 fill-green-500" />
      default:
        return <Circle className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getPriorityColor = (priority: Task["priority"]) => {
    switch (priority) {
      case "high":
        return "bg-red-500/10 text-red-500 border-red-500/50"
      case "medium":
        return "bg-yellow-500/10 text-yellow-500 border-yellow-500/50"
      case "low":
        return "bg-green-500/10 text-green-500 border-green-500/50"
    }
  }

  const taskIsOverdue = (task: Task) => task.isOverdue ?? isPmTaskOverdue(task)
  const dueLabel = (task: Task) => task.dueDateLabel ?? formatDueDateLabel(task.deadline)

  const handleAddMilestone = async (milestoneData: Omit<Milestone, 'id'>) => {
    console.log('[PlanView] Adding milestone:', milestoneData)
    
    try {
      const newMilestone = await ProjectData.addMilestone(project.id, milestoneData)
      
      if (newMilestone) {
        console.log('[PlanView] Milestone created successfully:', newMilestone.name)
        
        // Update task milestone associations
        if (milestoneData.taskIds && milestoneData.taskIds.length > 0) {
          // Update each task to have this milestone ID
          for (const taskId of milestoneData.taskIds) {
            await ProjectData.updateTask(project.id, taskId, { milestoneId: newMilestone.id })
          }
        }
        
        // Log activity
        await ProjectData.addActivity(project.id, {
          type: 'milestone_created',
          description: `Created milestone "${milestoneData.name}"${milestoneData.taskIds && milestoneData.taskIds.length > 0 ? ` with ${milestoneData.taskIds.length} task${milestoneData.taskIds.length !== 1 ? 's' : ''}` : ''}`,
          user: 'You',
        })
        
        // Trigger project update if callback provided
        if (onProjectUpdate) {
          onProjectUpdate()
        }
      } else {
        console.error('[PlanView] Failed to create milestone')
      }
    } catch (err) {
      console.error('[PlanView] Error adding milestone:', err)
    }
  }

  const handleEditMilestone = async (milestoneId: string, updates: Partial<Milestone>) => {
    console.log('[PlanView] Updating milestone:', milestoneId, updates)
    
    try {
      await ProjectData.updateMilestone(project.id, milestoneId, updates)
      
      // Update task milestone associations if taskIds changed
      if (updates.taskIds !== undefined) {
        // First, clear milestone from all tasks that had this milestone
        const tasksWithThisMilestone = project.tasks.filter(t => t.milestoneId === milestoneId)
        for (const task of tasksWithThisMilestone) {
          await ProjectData.updateTask(project.id, task.id, { milestoneId: undefined })
        }
        
        // Then set milestone on newly selected tasks
        if (updates.taskIds.length > 0) {
          for (const taskId of updates.taskIds) {
            await ProjectData.updateTask(project.id, taskId, { milestoneId: milestoneId })
          }
        }
      }
      
      // Log activity
      await ProjectData.addActivity(project.id, {
        type: 'milestone_updated',
        description: `Updated milestone "${updates.name || selectedMilestone?.name}"`,
        user: 'You',
      })
      
      console.log('[PlanView] Milestone updated successfully')
      
      // Trigger project update if callback provided
      if (onProjectUpdate) {
        onProjectUpdate()
      }
    } catch (err) {
      console.error('[PlanView] Error updating milestone:', err)
    }
  }

  const handleDeleteMilestone = async (milestoneId: string) => {
    console.log('[PlanView] Deleting milestone:', milestoneId)
    
    try {
      const milestone = milestones.find(m => m.id === milestoneId)
      
      // Clear milestone from all associated tasks
      const tasksWithThisMilestone = project.tasks.filter(t => t.milestoneId === milestoneId)
      for (const task of tasksWithThisMilestone) {
        await ProjectData.updateTask(project.id, task.id, { milestoneId: undefined })
      }
      
      await ProjectData.deleteMilestone(project.id, milestoneId)
      
      // Log activity
      if (milestone) {
        await ProjectData.addActivity(project.id, {
          type: 'milestone_deleted',
          description: `Deleted milestone "${milestone.name}"`,
          user: 'You',
        })
      }
      
      console.log('[PlanView] Milestone deleted successfully')
      
      // Trigger project update if callback provided
      if (onProjectUpdate) {
        onProjectUpdate()
      }
    } catch (err) {
      console.error('[PlanView] Error deleting milestone:', err)
    }
  }

  const handleOpenEditDialog = (milestone: Milestone) => {
    setSelectedMilestone(milestone)
    setEditMilestoneDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Add Milestone Dialog */}
      <AddMilestoneDialog
        open={addMilestoneDialogOpen}
        onOpenChange={setAddMilestoneDialogOpen}
        onAddMilestone={handleAddMilestone}
        availableTasks={project.tasks.filter(task => task.status !== 'done')}
      />

      {/* Edit Milestone Dialog */}
      <EditMilestoneDialog
        open={editMilestoneDialogOpen}
        onOpenChange={setEditMilestoneDialogOpen}
        onUpdateMilestone={handleEditMilestone}
        onDeleteMilestone={handleDeleteMilestone}
        milestone={selectedMilestone}
        availableTasks={project.tasks}
        currentTaskIds={selectedMilestone ? project.tasks.filter(t => t.milestoneId === selectedMilestone.id).map(t => t.id) : []}
      />

      {/* Project Overview */}
      <Card className="bg-gradient-to-br from-primary/5 to-card border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Target className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">Project Roadmap</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {milestones.length} milestones • {project.tasks.length} total tasks
                </p>
              </div>
            </div>
            {!readOnly ? (
            <Button
              onClick={() => setAddMilestoneDialogOpen(true)}
              size="sm"
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Milestone
            </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <Progress value={project.progress} className="h-3 flex-1 mr-4" />
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-bold text-primary">{project.progress}%</div>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {project.deadline && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Due: {project.deadline}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {project.completedTasks} of {project.totalTasks} tasks
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {milestones.filter(m => m.status === 'completed').length} of {milestones.length} milestones
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggested milestones (from task deadlines) */}
      {suggestedMilestones.length > 0 && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Lightbulb className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Suggested milestones</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Based on tasks that don’t have a milestone yet, grouped by deadline
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestedMilestones.map((sug) => (
                <div
                  key={sug.date + sug.name}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{sug.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {sug.taskCount} task{sug.taskCount !== 1 ? "s" : ""} · Due by {sug.date}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    className="shrink-0"
                    onClick={async () => {
                      await handleAddMilestone({
                        name: sug.name,
                        date: sug.date,
                        status: "upcoming",
                        taskIds: sug.taskIds,
                      })
                      onProjectUpdate?.()
                    }}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add milestone
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Milestones Timeline */}
      {milestones.length > 0 ? (
        <div className="space-y-6">
          {milestones.map((milestone, index) => {
            const tasks = tasksByMilestone.get(milestone.id) || []
            const progress = getMilestoneProgress(milestone)
            const completedTasks = tasks.filter(t => t.status === 'done').length
            const allTasksCompleted = tasks.length > 0 && completedTasks === tasks.length

            return (
              <div key={milestone.id} className="relative">
                {/* Timeline connector */}
                {index < milestones.length - 1 && (
                  <div className="absolute left-10 top-20 bottom-0 w-0.5 bg-border z-0" />
                )}

                <Card className={`relative z-10 ${
                  milestone.status === 'in-progress' 
                    ? 'border-primary/50 shadow-lg shadow-primary/10' 
                    : milestone.status === 'completed'
                    ? 'border-green-500/50'
                    : 'border-border'
                }`}>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {/* Status Icon */}
                      <div className="flex-shrink-0 mt-1">
                        {getMilestoneStatusIcon(milestone)}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <CardTitle className="text-xl">{milestone.name}</CardTitle>
                              <Badge 
                                variant="outline" 
                                className={
                                  milestone.status === 'completed' 
                                    ? 'bg-green-500/10 text-green-500 border-green-500/50'
                                    : milestone.status === 'in-progress'
                                    ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50'
                                    : 'bg-muted text-muted-foreground'
                                }
                              >
                                {milestone.status}
                              </Badge>
                              {!readOnly ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOpenEditDialog(milestone)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              ) : null}
                            </div>
                            {milestone.description && (
                              <p className="text-sm text-muted-foreground">{milestone.description}</p>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="flex items-center gap-2 justify-end">
                              <div className="text-2xl font-bold">{progress}%</div>
                              {(!readOnly && allTasksCompleted && milestone.status !== 'completed') && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="h-7 text-xs bg-green-500 hover:bg-green-600"
                                  onClick={async () => {
                                    await handleEditMilestone(milestone.id, { status: 'completed' })
                                  }}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Complete
                                </Button>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              <Calendar className="inline-block w-3 h-3 mr-1" />
                              {milestone.date}
                            </p>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <Progress 
                            value={progress} 
                            className={`h-2 ${
                              milestone.status === 'completed' ? '[&>div]:bg-green-500' : ''
                            }`}
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            {completedTasks} of {tasks.length} tasks completed
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Tasks in this milestone */}
                  {tasks.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-accent ${
                              task.status === 'done' ? 'opacity-60' : ''
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {getTaskStatusIcon(task)}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${
                                  task.status === 'done' ? 'line-through text-muted-foreground' : ''
                                }`}>
                                  {task.title}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground">
                                    {formatAssigneeSummary(task)}
                                  </span>
                                  {task.deadline && (
                                    <span className={`text-xs ${
                                      taskIsOverdue(task)
                                        ? 'text-red-500 font-semibold'
                                        : 'text-muted-foreground'
                                    }`}>
                                      {task.deadline}
                                      {taskIsOverdue(task) ? ` (${dueLabel(task)})` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-xs ${getPriorityColor(task.priority)}`}
                              >
                                {task.priority}
                              </Badge>
                              {(() => {
                                const pct = getTaskDisplayProgressWithCache(task.id, task)
                                return pct !== null ? (
                                  <span className="text-xs text-muted-foreground">{pct}%</span>
                                ) : null
                              })()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              </div>
            )
          })}
        </div>
      ) : (
        <Card className="p-12 text-center">
          <Target className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Milestones Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add milestones to organize your project tasks into phases
          </p>
          {!readOnly ? (
          <Button
            onClick={() => setAddMilestoneDialogOpen(true)}
            variant="outline"
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Your First Milestone
          </Button>
          ) : null}
        </Card>
      )}

      {/* Unmapped Tasks */}
      {unmappedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Unassigned Tasks</CardTitle>
            <p className="text-sm text-muted-foreground">
              {unmappedTasks.length} tasks not assigned to any milestone
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unmappedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between p-3 rounded-lg border transition-colors hover:bg-accent"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {getTaskStatusIcon(task)}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${
                        task.status === 'done' ? 'line-through text-muted-foreground' : ''
                      }`}>
                        {task.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatAssigneeSummary(task)}
                        </span>
                        {task.deadline && (
                          <span className={`text-xs ${
                            taskIsOverdue(task)
                              ? 'text-red-500 font-semibold'
                              : 'text-muted-foreground'
                          }`}>
                            {task.deadline}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getPriorityColor(task.priority)}`}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

