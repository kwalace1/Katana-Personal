"use client"

import type React from "react"

import { useState } from "react"
import * as hrApi from '@/lib/hr-api'
import { supabase } from '@/lib/supabase'
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { Plus, Upload, X, Image as ImageIcon } from "lucide-react"
import { useAuth } from "@/contexts/AuthContext"
import { getSmartDefault, recordSmartDefault } from "@/lib/profile-completeness"
import { ModuleAccessFields } from "@/components/hr/module-access-fields"
import { sanitizeFullModuleAccess } from "@/lib/module-access-permissions"

export function AddEmployeeDialog() {
  const { hasRole } = useAuth()
  const canManageModuleAccess = hasRole(['owner', 'admin'])
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const todayStr = new Date().toISOString().slice(0, 10)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    position: "",
    department: getSmartDefault('lastDepartment') || "",
    supervisor: "",
    startDate: todayStr,
    photoUrl: "",
    notes: "",
    moduleAccess: [] as string[],
  })
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file (JPEG, PNG, etc.)')
        return
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        alert('Image file size must be less than 5MB')
        return
      }
      
      setSelectedPhoto(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removePhoto = () => {
    setSelectedPhoto(null)
    setPhotoPreview(null)
    setFormData({ ...formData, photoUrl: "" })
  }

  const uploadPhoto = async (): Promise<string | null> => {
    if (!selectedPhoto) return null

    setUploadingPhoto(true)
    try {
      const fileExt = selectedPhoto.name.split('.').pop()
      const fileName = `employee-photos/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      
      const { data, error } = await supabase.storage
        .from('employee-photos')
        .upload(fileName, selectedPhoto, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Error uploading photo:', error)
        alert('Failed to upload photo. Please try again.')
        return null
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('employee-photos')
        .getPublicUrl(data.path)

      return urlData.publicUrl
    } catch (err) {
      console.error('Error uploading photo:', err)
      alert('Failed to upload photo. Please try again.')
      return null
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Upload photo first if one is selected
      let photoUrl = formData.photoUrl
      if (selectedPhoto) {
        const uploadedUrl = await uploadPhoto()
        if (uploadedUrl) {
          photoUrl = uploadedUrl
        } else {
          setSubmitting(false)
          return
        }
      }
      
      const employeeData = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        position: formData.position,
        department: formData.department,
        status: 'Active' as const,
        phone: '', // Add phone field later if needed
        hire_date: formData.startDate,
        photo_url: photoUrl || null,
        module_access:
          formData.moduleAccess.length > 0 ? sanitizeFullModuleAccess(formData.moduleAccess) : [],
      }
      
      const newEmployee = await hrApi.createEmployee(employeeData)
      
      if (newEmployee) {
        if (formData.department) recordSmartDefault('lastDepartment', formData.department)
        void hrApi.logEmployeeAdded(newEmployee.name, newEmployee.id)
        toast.success(`${newEmployee.name} has been added to the directory.`)
        window.dispatchEvent(new CustomEvent('employeeAdded', { detail: newEmployee }))
        setOpen(false)
        setFormData({
          name: "",
          email: "",
          position: "",
          department: "",
          supervisor: "",
          startDate: "",
          photoUrl: "",
          notes: "",
          moduleAccess: [],
        })
        setSelectedPhoto(null)
        setPhotoPreview(null)
      } else {
        toast.error("Could not create the employee. Please try again.")
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong."
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Employee
        </Button>
      </DialogTrigger>
      <DialogContent size="lg" className="flex h-[min(560px,80vh)] flex-col overflow-hidden p-0 min-h-0">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
            <DialogTitle>Add New Employee</DialogTitle>
            <DialogDescription>Enter the employee details below to add them to the system.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4 px-6 overflow-y-auto min-h-0 flex-1">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="john.doe@company.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="position">Job Title *</Label>
              <Input
                id="position"
                value={formData.position}
                onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                placeholder="Software Engineer"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="department">Department *</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => setFormData({ ...formData, department: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Engineering">Engineering</SelectItem>
                  <SelectItem value="Sales">Sales</SelectItem>
                  <SelectItem value="Marketing">Marketing</SelectItem>
                  <SelectItem value="Human Resources">Human Resources</SelectItem>
                  <SelectItem value="Finance">Finance</SelectItem>
                  <SelectItem value="Operations">Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="supervisor">Supervisor</Label>
              <Input
                id="supervisor"
                value={formData.supervisor}
                onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="photo">Employee Photo</Label>
              
              {photoPreview ? (
                <div className="relative">
                  <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-border">
                    <img 
                      src={photoPreview} 
                      alt="Preview" 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-0 right-0"
                    onClick={removePhoto}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      id="photo"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      onChange={handlePhotoSelect}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Upload a photo file (JPEG, PNG - max 5MB)
                    </p>
                  </div>
                </div>
              )}
              
              {/* Alternative: URL input */}
              {!photoPreview && (
                <div className="mt-2">
                  <Label htmlFor="photoUrl" className="text-xs text-muted-foreground">
                    Or enter photo URL:
                  </Label>
                  <Input
                    id="photoUrl"
                    type="url"
                    value={formData.photoUrl}
                    onChange={(e) => setFormData({ ...formData, photoUrl: e.target.value })}
                    placeholder="https://your-employee-portal.com/photos/employee.jpg"
                    className="mt-1"
                  />
                </div>
              )}
            </div>
            {canManageModuleAccess && (
            <div className="grid gap-2">
              <Label>System access</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Choose which parts of the system this employee can access. They will only see these modules in the app.
              </p>
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                Note: users with the <span className="font-semibold">owner</span> or <span className="font-semibold">admin</span> role
                always see every module regardless of these checkboxes. To restrict access, the user must have the <span className="font-semibold">member</span> role.
              </p>
              <ModuleAccessFields
                value={formData.moduleAccess}
                onChange={(moduleAccess) => setFormData((prev) => ({ ...prev, moduleAccess }))}
              />
            </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-4 shrink-0 border-t">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={uploadingPhoto || submitting}
              onClick={(e) => {
                e.preventDefault()
                handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>)
              }}
            >
              {uploadingPhoto ? 'Uploading Photo...' : submitting ? 'Adding...' : 'Add Employee'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
