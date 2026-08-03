"use client"

import type React from "react"
import { useState } from "react"
import * as hrApi from '@/lib/hr-api'
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
import { Textarea } from "@/components/ui/textarea"
import type { Employee } from "@/lib/hr-api"
import { useToast } from "@/hooks/use-toast"
import { X } from "lucide-react"

interface AddCareerPathDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employees: Employee[]
  onCareerPathAdded?: () => void
}

export function AddCareerPathDialog({ 
  open, 
  onOpenChange, 
  employees = [],
  onCareerPathAdded 
}: AddCareerPathDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    employee_id: "",
    current_role_name: "",
    next_role: "",
    time_to_promotion: "",
    readiness: 0,
    required_skills: [] as string[],
  })
  const [newSkill, setNewSkill] = useState("")

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

    if (!formData.current_role_name || !formData.next_role) {
      toast({
        title: "Error",
        description: "Please fill in current and next role",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    try {
      const result = await hrApi.createCareerPath({
        employee_id: formData.employee_id,
        current_role_name: formData.current_role_name,
        next_role: formData.next_role,
        time_to_promotion: formData.time_to_promotion,
        readiness: formData.readiness,
        required_skills: formData.required_skills,
      })

      if (result) {
        toast({
          title: "Success",
          description: "Career path added successfully",
        })
        onOpenChange(false)
        // Reset form
        setFormData({
          employee_id: "",
          current_role_name: "",
          next_role: "",
          time_to_promotion: "",
          readiness: 0,
          required_skills: [],
        })
        if (onCareerPathAdded) {
          onCareerPathAdded()
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to add career path",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error adding career path:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const addSkill = () => {
    if (newSkill.trim() && !formData.required_skills.includes(newSkill.trim())) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, newSkill.trim()],
      })
      setNewSkill("")
    }
  }

  const removeSkill = (skill: string) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter(s => s !== skill),
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Career Path</DialogTitle>
            <DialogDescription>
              Define a career progression plan for an employee
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

            <div className="grid gap-2">
              <Label htmlFor="current_role">Current Role *</Label>
              <Input
                id="current_role"
                value={formData.current_role_name}
                onChange={(e) => setFormData({ ...formData, current_role_name: e.target.value })}
                placeholder="e.g., Software Engineer"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="next_role">Next Role/Target Role *</Label>
              <Input
                id="next_role"
                value={formData.next_role}
                onChange={(e) => setFormData({ ...formData, next_role: e.target.value })}
                placeholder="e.g., Senior Software Engineer"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="time_to_promotion">Time to Promotion</Label>
              <Input
                id="time_to_promotion"
                value={formData.time_to_promotion}
                onChange={(e) => setFormData({ ...formData, time_to_promotion: e.target.value })}
                placeholder="e.g., 6-12 months"
              />
            </div>

            <div className="grid gap-2">
              <Label>Promotion Readiness: {formData.readiness}%</Label>
              <Slider
                value={[formData.readiness]}
                onValueChange={(value) => setFormData({ ...formData, readiness: value[0] })}
                min={0}
                max={100}
                step={1}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="required_skills">Required Skills</Label>
              <div className="flex gap-2">
                <Input
                  id="required_skills"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                  placeholder="Add a skill and press Enter"
                />
                <Button type="button" onClick={addSkill} variant="outline">
                  Add
                </Button>
              </div>
              {formData.required_skills.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.required_skills.map((skill, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-1 px-2 py-1 bg-secondary rounded-md text-sm"
                    >
                      <span>{skill}</span>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="ml-1 hover:bg-destructive/20 rounded p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              {isSubmitting ? "Adding..." : "Add Career Path"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}









