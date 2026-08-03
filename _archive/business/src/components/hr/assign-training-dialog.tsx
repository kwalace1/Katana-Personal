import { dateKeyDaysFromNow } from '@/lib/due-date-utils'
"use client"

import type React from "react"
import { useEffect, useState } from "react"
import * as hrApi from "@/lib/hr-api"
import type { Employee, TrainingCourse, TrainingPriority } from "@/lib/hr-api"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { BookOpen, GraduationCap } from "lucide-react"

interface AssignTrainingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  courses?: TrainingCourse[]
  onAssigned?: () => void
  onManageCourses?: () => void
}

const defaultDueDate = () =>
  dateKeyDaysFromNow(30)

export function AssignTrainingDialog({
  open,
  onOpenChange,
  employees = [],
  courses: coursesProp,
  onAssigned,
  onManageCourses,
}: AssignTrainingDialogProps) {
  const { toast } = useToast()
  const [courses, setCourses] = useState<TrainingCourse[]>(coursesProp ?? [])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState({
    employee_id: "",
    course_id: "",
    priority: "medium" as TrainingPriority,
    due_date: defaultDueDate(),
    notes: "",
  })

  useEffect(() => {
    if (coursesProp) setCourses(coursesProp)
  }, [coursesProp])

  useEffect(() => {
    if (!open) return
    if (!coursesProp?.length) {
      hrApi.getTrainingCourses().then(setCourses)
    }
    setForm({
      employee_id: "",
      course_id: "",
      priority: "medium",
      due_date: defaultDueDate(),
      notes: "",
    })
  }, [open, coursesProp])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id) {
      toast({ title: "Select an employee", variant: "destructive" })
      return
    }
    if (!form.course_id) {
      toast({ title: "Select a training course", variant: "destructive" })
      return
    }
    if (!form.due_date) {
      toast({ title: "Set a completion deadline", variant: "destructive" })
      return
    }

    setIsSubmitting(true)
    try {
      const result = await hrApi.assignTraining({
        employee_id: form.employee_id,
        course_id: form.course_id,
        priority: form.priority,
        due_date: form.due_date,
        notes: form.notes.trim() || undefined,
      })
      if (!result) {
        toast({
          title: "Could not assign training",
          description: "Check that the training courses migration has been applied.",
          variant: "destructive",
        })
        return
      }
      const emp = employees.find((e) => e.id === form.employee_id)
      const course = courses.find((c) => c.id === form.course_id)
      toast({
        title: "Training assigned",
        description: `${course?.title ?? "Course"} assigned to ${emp?.name ?? "employee"}. It will appear on their portal.`,
      })
      onOpenChange(false)
      onAssigned?.()
    } catch (err) {
      console.error(err)
      toast({ title: "Unexpected error", variant: "destructive" })
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCourse = courses.find((c) => c.id === form.course_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="flex h-[min(85vh,640px)] flex-col gap-0 overflow-hidden p-0">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-12">
            <DialogTitle>Assign Training</DialogTitle>
            <DialogDescription className="text-left">
              Assign a course from your catalog. The employee will see it on their portal feed and in Learning &amp; Development.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-5 px-6 py-5">
              <div className="grid gap-2">
                <Label htmlFor="training-employee">Employee *</Label>
                <Select
                  value={form.employee_id}
                  onValueChange={(v) => setForm({ ...form, employee_id: v })}
                >
                  <SelectTrigger id="training-employee" className="w-full">
                    <SelectValue placeholder="Choose employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No employees available
                      </SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} — {emp.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="training-course">Training course *</Label>
                  {onManageCourses && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="h-auto shrink-0 px-0 text-xs sm:text-sm"
                      onClick={onManageCourses}
                    >
                      Manage catalog
                    </Button>
                  )}
                </div>
                {courses.length === 0 ? (
                  <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-5 text-center text-sm text-muted-foreground">
                    <p className="mb-3">No courses in your catalog yet.</p>
                    {onManageCourses && (
                      <Button type="button" variant="outline" size="sm" onClick={onManageCourses}>
                        Create a course
                      </Button>
                    )}
                  </div>
                ) : (
                  <>
                    <Select
                      value={form.course_id}
                      onValueChange={(v) => setForm({ ...form, course_id: v })}
                    >
                      <SelectTrigger id="training-course" className="w-full">
                        <SelectValue placeholder="Choose course…" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.title}
                            {c.category ? ` · ${c.category}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCourse && (
                      <div className="rounded-md border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
                        {selectedCourse.description && (
                          <p className="mb-1.5 text-foreground/80">{selectedCourse.description}</p>
                        )}
                        <p>
                          {[
                            selectedCourse.duration_hours ? `${selectedCourse.duration_hours} hours` : null,
                            selectedCourse.level ? `Level: ${selectedCourse.level}` : null,
                            selectedCourse.skills.length
                              ? `Skills: ${selectedCourse.skills.join(", ")}`
                              : null,
                            selectedCourse.certifications.length
                              ? `Certs: ${selectedCourse.certifications.join(", ")}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="training-priority">Priority</Label>
                  <Select
                    value={form.priority}
                    onValueChange={(v) => setForm({ ...form, priority: v as TrainingPriority })}
                  >
                    <SelectTrigger id="training-priority" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High — Required</SelectItem>
                      <SelectItem value="medium">Medium — Recommended</SelectItem>
                      <SelectItem value="low">Low — Optional</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="training-deadline">Completion deadline *</Label>
                  <Input
                    id="training-deadline"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="training-notes">Notes for employee</Label>
                <Textarea
                  id="training-notes"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Context or instructions for this assignment…"
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex items-start gap-3 rounded-lg border bg-accent/20 px-4 py-3">
                <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Shows on the employee portal feed and under Learning &amp; Development. Completing the course can unlock configured skills and certifications.
                </p>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="shrink-0 gap-2 border-t px-6 py-4 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || courses.length === 0}>
              <BookOpen className="mr-2 h-4 w-4" />
              {isSubmitting ? "Assigning…" : "Assign Training"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
