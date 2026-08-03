import { getTodayDateKey, dateKeyDaysFromNow } from '@/lib/due-date-utils'
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { getAllEmployees, type Employee } from "@/lib/hr-api"

interface AddProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddProject: (project: {
    name: string
    status: "active" | "completed" | "on-hold"
    deadline: string
    owner?: { name: string; avatar: string; hrEmployeeId?: string | null }
  }) => void
}

export function AddProjectDialog({ open, onOpenChange, onAddProject }: AddProjectDialogProps) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [allowBackdate, setAllowBackdate] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    status: "active" as "active" | "completed" | "on-hold",
    deadline: "",
    ownerName: "",
    ownerAvatar: "",
    ownerHrEmployeeId: "" as string,
  })

  useEffect(() => {
    if (open) {
      getAllEmployees().then(setEmployees).catch(() => setEmployees([]))
    }
  }, [open])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) return

    const projectToAdd: Parameters<typeof onAddProject>[0] = {
      name: formData.name,
      status: formData.status,
      deadline: formData.deadline || dateKeyDaysFromNow(30),
    }

    if (formData.ownerName) {
      projectToAdd.owner = {
        name: formData.ownerName,
        avatar: formData.ownerAvatar,
        hrEmployeeId: formData.ownerHrEmployeeId || null,
      }
    }

    onAddProject(projectToAdd)

    setFormData({ name: "", status: "active", deadline: "", ownerName: "", ownerAvatar: "", ownerHrEmployeeId: "" })
    onOpenChange(false)
  }

  const today = getTodayDateKey()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Add a new project to your workspace. You can add tasks and team members later.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="Enter project name..."
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "active" | "completed" | "on-hold") =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="owner">Assign To</Label>
                <Select
                  value={formData.ownerName}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setFormData({ ...formData, ownerName: "", ownerAvatar: "", ownerHrEmployeeId: "" })
                    } else {
                      const emp = employees.find(e => e.name === value)
                      setFormData({
                        ...formData,
                        ownerName: value,
                        ownerAvatar: emp?.photo_url || "",
                        ownerHrEmployeeId: emp?.id || "",
                      })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.name}>
                        {emp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="deadline">Deadline (Optional)</Label>
              <Input
                id="deadline"
                type="date"
                {...(!allowBackdate ? { min: today } : {})}
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!formData.name.trim()}>
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

