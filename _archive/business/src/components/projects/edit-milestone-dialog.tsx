"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CheckCircle2 } from "lucide-react"
import type { Milestone, Task } from "@/lib/project-data"
import { formatAssigneeSummary } from "@/lib/task-assignees"

interface EditMilestoneDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdateMilestone: (milestoneId: string, updates: Partial<Milestone>) => Promise<void>
  onDeleteMilestone: (milestoneId: string) => Promise<void>
  milestone: Milestone | null
  availableTasks?: Task[]
  currentTaskIds?: string[]
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

export function EditMilestoneDialog({ 
  open, 
  onOpenChange, 
  onUpdateMilestone, 
  onDeleteMilestone,
  milestone,
  availableTasks = [],
  currentTaskIds = []
}: EditMilestoneDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    status: "upcoming" as Milestone['status'],
    description: "",
  })
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Get tasks assigned to this milestone
  const milestoneTasks = availableTasks.filter(t => selectedTaskIds.includes(t.id))
  
  // Check if all assigned tasks are completed
  const allTasksCompleted = milestoneTasks.length > 0 && 
    milestoneTasks.every(t => t.status === 'done')

  // Filter out done tasks for selection (but show all in the logic above)
  const selectableTasks = availableTasks.filter(task => task.status !== 'done')

  // Update form when milestone changes
  useEffect(() => {
    if (milestone) {
      setFormData({
        name: milestone.name,
        date: milestone.date,
        status: milestone.status,
        description: milestone.description || "",
      })
      setSelectedTaskIds(currentTaskIds)
    }
  }, [milestone, currentTaskIds])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!milestone || !formData.name.trim() || !formData.date) return

    await onUpdateMilestone(milestone.id, {
      name: formData.name,
      date: formData.date,
      status: formData.status,
      description: formData.description,
      taskIds: selectedTaskIds,
    })

    onOpenChange(false)
  }

  const handleDelete = async () => {
    if (!milestone) return
    await onDeleteMilestone(milestone.id)
    setShowDeleteConfirm(false)
    onOpenChange(false)
  }

  const handleTaskToggle = (taskId: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  if (!milestone) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Milestone</DialogTitle>
        </DialogHeader>

        {showDeleteConfirm ? (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this milestone? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
              >
                Delete Milestone
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col overflow-hidden">
            <div className="space-y-4 overflow-y-auto flex-1">
              <div className="space-y-2">
                <Label htmlFor="name">Milestone Name*</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Design Phase Complete"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Target Date*</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                {allTasksCompleted && formData.status !== 'completed' && (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/50 rounded text-xs text-green-600 mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>All tasks completed!</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="ml-auto h-6 text-xs text-green-600 hover:text-green-700 hover:bg-green-500/20"
                      onClick={() => setFormData({ ...formData, status: 'completed' })}
                    >
                      Mark as Completed
                    </Button>
                  </div>
                )}
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as Milestone['status'] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of this milestone..."
                  rows={3}
                />
              </div>

              {/* Task Selection */}
              {selectableTasks.length > 0 && (
                <div className="space-y-2">
                  <Label>Assign Tasks (Optional)</Label>
                  <div className="text-xs text-muted-foreground mb-2">
                    Select tasks to include in this milestone (completed tasks excluded)
                  </div>
                  <ScrollArea className="h-[200px] border rounded-lg p-3">
                    <div className="space-y-3">
                      {selectableTasks.map((task) => (
                        <div key={task.id} className="flex items-start gap-3 p-2 rounded hover:bg-accent">
                          <Checkbox
                            id={`task-${task.id}`}
                            checked={selectedTaskIds.includes(task.id)}
                            onCheckedChange={() => handleTaskToggle(task.id)}
                          />
                          <label
                            htmlFor={`task-${task.id}`}
                            className="flex-1 cursor-pointer text-sm"
                          >
                            <div className="font-medium">{task.title}</div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">{formatAssigneeSummary(task)}</span>
                              <Badge variant="outline" className={`text-xs ${getStatusColor(task.status)}`}>
                                {task.status.replace('-', ' ')}
                              </Badge>
                            </div>
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  {selectedTaskIds.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      {selectedTaskIds.length} task{selectedTaskIds.length !== 1 ? 's' : ''} selected
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-between pt-4 border-t">
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!formData.name.trim() || !formData.date}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}



