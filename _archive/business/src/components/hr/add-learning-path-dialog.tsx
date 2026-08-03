import { dateKeyDaysFromNow } from '@/lib/due-date-utils'
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import * as hrApi from '@/lib/hr-api'
import type { Employee, TrainingCourse } from "@/lib/hr-api"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"

interface AddLearningPathDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  courses?: TrainingCourse[]
  onLearningPathAdded?: () => void
}

export function AddLearningPathDialog({ 
  open, 
  onOpenChange, 
  employees = [],
  courses: coursesProp = [],
  onLearningPathAdded 
}: AddLearningPathDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [courses, setCourses] = useState<TrainingCourse[]>(coursesProp)
  const [useCatalog, setUseCatalog] = useState(true)
  const [formData, setFormData] = useState({
    employee_id: "",
    course_id: "",
    course: "",
    progress: 0,
    due_date: dateKeyDaysFromNow(30),
    status: "not-started" as "in-progress" | "completed" | "not-started",
  })

  useEffect(() => {
    setCourses(coursesProp)
  }, [coursesProp])

  useEffect(() => {
    if (open && !coursesProp.length) {
      hrApi.getTrainingCourses().then(setCourses)
    }
  }, [open, coursesProp.length])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.employee_id) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      })
      return
    }

    const catalogCourse = useCatalog && formData.course_id
      ? courses.find((c) => c.id === formData.course_id)
      : null
    const courseName = catalogCourse?.title || formData.course.trim()

    if (!courseName) {
      toast({
        title: "Error",
        description: "Please select or enter a course name",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await hrApi.createLearningPath({
        employee_id: formData.employee_id,
        course_id: catalogCourse?.id ?? null,
        course: courseName,
        progress: formData.progress,
        due_date: formData.due_date,
        status: formData.status,
        priority: "medium",
      })

      if (result) {
        toast({
          title: "Success",
          description: "Learning path added successfully",
        })
        onOpenChange(false)
        setFormData({
          employee_id: "",
          course_id: "",
          course: "",
          progress: 0,
          due_date: dateKeyDaysFromNow(30),
          status: "not-started",
        })
        onLearningPathAdded?.()
      } else {
        toast({
          title: "Error",
          description: "Failed to add learning path",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding learning path:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Learning Path</DialogTitle>
            <DialogDescription>
              Assign a training course or learning program to an employee
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="employee">Employee *</Label>
              <Select
                value={formData.employee_id}
                onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees && employees.length > 0 ? (
                    employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.position}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>No employees available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {courses.length > 0 && (
              <div className="grid gap-2">
                <Label>Course source</Label>
                <Select
                  value={useCatalog ? "catalog" : "custom"}
                  onValueChange={(v) => setUseCatalog(v === "catalog")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="catalog">From catalog</SelectItem>
                    <SelectItem value="custom">Custom name</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {useCatalog && courses.length > 0 ? (
              <div className="grid gap-2">
                <Label>Course *</Label>
                <Select
                  value={formData.course_id}
                  onValueChange={(value) => setFormData({ ...formData, course_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="course">Course/Training Name *</Label>
                <Input
                  id="course"
                  value={formData.course}
                  onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                  placeholder="e.g., Advanced React Patterns"
                  required
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="due_date">Due Date *</Label>
              <Input
                id="due_date"
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "in-progress" | "completed" | "not-started") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="not-started">Not Started</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Progress: {formData.progress}%</Label>
              <Slider
                value={[formData.progress]}
                onValueChange={(value) => setFormData({ ...formData, progress: value[0] })}
                min={0}
                max={100}
                step={1}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Learning Path"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
