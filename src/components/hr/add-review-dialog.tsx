import { getTodayDateKey } from '@/lib/due-date-utils'
"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { ClipboardList, UserRound, ArrowLeft } from "lucide-react"
import type { Employee, PerformanceReviewFormat } from "@/lib/hr-api"
import { createPerformanceReview } from "@/lib/hr-api"
import { useToast } from "@/hooks/use-toast"
import { useLoggedInHrEmployee } from "@/hooks/use-logged-in-hr-employee"

interface AddReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  onReviewAdded?: () => void
  preselectedEmployeeId?: string
}

type WizardStep = "format" | "details"

const EMPTY_FORM = {
  employee_id: "",
  review_format: "standard" as PerformanceReviewFormat,
  review_type: "quarterly" as "quarterly" | "annual" | "probation" | "promotion",
  review_period: "",
  review_date: getTodayDateKey(),
  collaboration: 3,
  accountability: 3,
  trustworthy: 3,
  leadership: 3,
  strengths: "",
  improvements: "",
  goals: "",
  trend: "stable" as "up" | "down" | "stable",
  status: "on-time" as "on-time" | "overdue" | "upcoming",
}

const REVIEW_FORMAT_OPTIONS: {
  value: PerformanceReviewFormat
  label: string
  description: string
  icon: typeof ClipboardList
}[] = [
  {
    value: "standard",
    label: "Standard Performance Review",
    description: "Manager or HR review of an employee. You cannot review yourself.",
    icon: ClipboardList,
  },
  {
    value: "self_assessment",
    label: "Self-Assessment",
    description: "Employee evaluates their own performance for the period.",
    icon: UserRound,
  },
]

export function AddReviewDialog({
  open,
  onOpenChange,
  employees = [],
  onReviewAdded,
  preselectedEmployeeId,
}: AddReviewDialogProps) {
  const { toast } = useToast()
  const { isSelf, loggedInEmployeeId } = useLoggedInHrEmployee()
  const [step, setStep] = useState<WizardStep>("format")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    ...EMPTY_FORM,
    employee_id: preselectedEmployeeId || "",
  })

  const isSelfAssessment = formData.review_format === "self_assessment"

  const selectableEmployees = useMemo(() => {
    if (isSelfAssessment) {
      if (!loggedInEmployeeId) return []
      return employees.filter((e) => e.id === loggedInEmployeeId)
    }
    return employees.filter((e) => !isSelf(e))
  }, [employees, isSelfAssessment, loggedInEmployeeId, isSelf])

  useEffect(() => {
    if (!open) {
      setStep("format")
      setFormData({
        ...EMPTY_FORM,
        employee_id: preselectedEmployeeId || "",
      })
      return
    }
    if (preselectedEmployeeId) {
      setFormData((prev) => ({ ...prev, employee_id: preselectedEmployeeId }))
    }
  }, [open, preselectedEmployeeId])

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setStep("format")
      setFormData({
        ...EMPTY_FORM,
        employee_id: preselectedEmployeeId || "",
      })
    }
    onOpenChange(next)
  }

  const selectReviewFormat = (format: PerformanceReviewFormat) => {
    if (format === "self_assessment") {
      if (!loggedInEmployeeId) {
        toast({
          title: "Cannot start self-assessment",
          description:
            "Your login is not linked to an HR employee record. Ask HR to add you with your work email.",
          variant: "destructive",
        })
        return
      }
      setFormData((prev) => ({
        ...prev,
        review_format: format,
        employee_id: loggedInEmployeeId,
      }))
    } else {
      setFormData((prev) => {
        const prevEmp = employees.find((e) => e.id === prev.employee_id)
        const preEmp = preselectedEmployeeId
          ? employees.find((e) => e.id === preselectedEmployeeId)
          : undefined
        let employee_id = ""
        if (prevEmp && !isSelf(prevEmp)) employee_id = prevEmp.id
        else if (preEmp && !isSelf(preEmp)) employee_id = preEmp.id
        return { ...prev, review_format: format, employee_id }
      })
    }
    setStep("details")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const selected = employees.find((e) => e.id === formData.employee_id)

    if (!formData.employee_id || !selected) {
      toast({
        title: "Error",
        description: "Please select an employee",
        variant: "destructive",
      })
      return
    }

    if (isSelfAssessment) {
      if (!loggedInEmployeeId || formData.employee_id !== loggedInEmployeeId) {
        toast({
          title: "Not allowed",
          description: "Self-assessments can only be submitted for yourself.",
          variant: "destructive",
        })
        return
      }
    } else if (isSelf(selected)) {
      toast({
        title: "Not allowed",
        description: "Standard performance reviews cannot be submitted for yourself. Use Self-Assessment instead.",
        variant: "destructive",
      })
      return
    }

    if (!formData.review_period) {
      toast({
        title: "Error",
        description: "Please enter a review period",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await createPerformanceReview({
        employee_id: formData.employee_id,
        review_format: formData.review_format,
        review_type: formData.review_type,
        review_period: formData.review_period,
        review_date: formData.review_date,
        collaboration: formData.collaboration,
        accountability: formData.accountability,
        trustworthy: formData.trustworthy,
        leadership: formData.leadership,
        strengths: formData.strengths || null,
        improvements: formData.improvements || null,
        goals: formData.goals || null,
        trend: formData.trend,
        status: formData.status,
        reviewer_id: isSelfAssessment ? loggedInEmployeeId : null,
      })

      if (result) {
        toast({
          title: "Success",
          description:
            formData.review_format === "self_assessment"
              ? "Self-assessment submitted successfully"
              : "Performance review added successfully",
        })
        handleOpenChange(false)
        onReviewAdded?.()
      } else {
        toast({
          title: "Error",
          description: "Failed to add performance review",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding review:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const employeeSelectLocked =
    isSelfAssessment || (!!preselectedEmployeeId && !isSelfAssessment && !!preselectedEmployeeId)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        {step === "format" ? (
          <>
            <DialogHeader>
              <DialogTitle>Add Performance Review</DialogTitle>
              <DialogDescription>What type of review is this?</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-4">
              {REVIEW_FORMAT_OPTIONS.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.value}
                    type="button"
                    className="flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-accent/50 hover:border-primary/40"
                    onClick={() => selectReviewFormat(option.value)}
                  >
                    <div className="rounded-md bg-primary/10 p-2 shrink-0">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{option.label}</p>
                      <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {isSelfAssessment ? "Self-Assessment" : "Standard Performance Review"}
              </DialogTitle>
              <DialogDescription>
                {isSelfAssessment
                  ? "Rate your performance and reflect on the review period"
                  : "Complete a performance review for a team member"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="capitalize">
                  {isSelfAssessment ? "Self-Assessment" : "Standard Review"}
                </Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 px-2"
                  onClick={() => setStep("format")}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Change type
                </Button>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="employee">Employee *</Label>
                <Select
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  disabled={employeeSelectLocked || selectableEmployees.length <= 1}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectableEmployees.length === 0 ? (
                      <SelectItem value="none" disabled>
                        {isSelfAssessment
                          ? "No employee profile linked to your account"
                          : "No employees available"}
                      </SelectItem>
                    ) : (
                      selectableEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="review_type">Review Cadence *</Label>
                  <Select
                    value={formData.review_type}
                    onValueChange={(value: typeof formData.review_type) =>
                      setFormData({ ...formData, review_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="probation">Probation</SelectItem>
                      <SelectItem value="promotion">Promotion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="review_period">Review Period *</Label>
                  <Input
                    id="review_period"
                    placeholder="e.g., Q4 2024"
                    value={formData.review_period}
                    onChange={(e) => setFormData({ ...formData, review_period: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="review_date">Review Date *</Label>
                <Input
                  id="review_date"
                  type="date"
                  value={formData.review_date}
                  onChange={(e) => setFormData({ ...formData, review_date: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-4 pt-2">
                <div className="grid gap-2">
                  <Label>Collaboration: {formData.collaboration}/5</Label>
                  <Slider
                    value={[formData.collaboration]}
                    onValueChange={(value) => setFormData({ ...formData, collaboration: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Accountability: {formData.accountability}/5</Label>
                  <Slider
                    value={[formData.accountability]}
                    onValueChange={(value) => setFormData({ ...formData, accountability: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Trustworthy: {formData.trustworthy}/5</Label>
                  <Slider
                    value={[formData.trustworthy]}
                    onValueChange={(value) => setFormData({ ...formData, trustworthy: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Leadership: {formData.leadership}/5</Label>
                  <Slider
                    value={[formData.leadership]}
                    onValueChange={(value) => setFormData({ ...formData, leadership: value[0] })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
              </div>

              {!isSelfAssessment && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="trend">Performance Trend</Label>
                    <Select
                      value={formData.trend}
                      onValueChange={(value: typeof formData.trend) =>
                        setFormData({ ...formData, trend: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="up">Improving</SelectItem>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="down">Declining</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="status">Review Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value: typeof formData.status) =>
                        setFormData({ ...formData, status: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on-time">On Time</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label htmlFor="strengths">
                  {isSelfAssessment ? "What went well?" : "Strengths"}
                </Label>
                <Textarea
                  id="strengths"
                  value={formData.strengths}
                  onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                  placeholder={
                    isSelfAssessment
                      ? "Accomplishments and strengths this period..."
                      : "Key strengths demonstrated during this period..."
                  }
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="improvements">
                  {isSelfAssessment ? "What could improve?" : "Areas for Improvement"}
                </Label>
                <Textarea
                  id="improvements"
                  value={formData.improvements}
                  onChange={(e) => setFormData({ ...formData, improvements: e.target.value })}
                  placeholder={
                    isSelfAssessment
                      ? "Areas you want to develop further..."
                      : "Areas where the employee can improve..."
                  }
                  rows={3}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="goals">Goals for Next Period</Label>
                <Textarea
                  id="goals"
                  value={formData.goals}
                  onChange={(e) => setFormData({ ...formData, goals: e.target.value })}
                  placeholder="Goals and objectives for the next review period..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("format")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Submitting..."
                  : isSelfAssessment
                    ? "Submit Self-Assessment"
                    : "Submit Review"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
