import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProfileEditDialog({ open, onOpenChange }: ProfileEditDialogProps) {
  const { profile, refreshProfile } = useAuth()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    department: '',
    job_title: '',
    avatar_url: '',
  })

  useEffect(() => {
    if (open && profile) {
      setFormData({
        full_name: profile.full_name || '',
        department: profile.department || '',
        job_title: profile.job_title || '',
        avatar_url: profile.avatar_url || '',
      })
    }
  }, [open, profile])

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const path = `profile-photos/${profile!.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('employee-photos').upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      })
      if (error) throw error

      const { data: urlData } = supabase.storage.from('employee-photos').getPublicUrl(path)
      setFormData((prev) => ({ ...prev, avatar_url: urlData.publicUrl }))
      toast.success('Photo uploaded')
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload photo')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!profile) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          full_name: formData.full_name.trim() || null,
          department: formData.department || null,
          job_title: formData.job_title.trim() || null,
          avatar_url: formData.avatar_url.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      toast.success('Profile updated')
      onOpenChange(false)
    } catch (err) {
      console.error('Save error:', err)
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const initials = formData.full_name
    ? formData.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || 'U'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
          <DialogDescription>
            Update your profile information visible to your team.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={formData.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-1">
              <Label htmlFor="avatar-upload" className="text-sm font-medium">
                Profile Photo
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  disabled={uploading}
                  onClick={() => document.getElementById('avatar-upload')?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Upload className="h-3 w-3" />
                  )}
                  {uploading ? 'Uploading...' : 'Upload'}
                </Button>
                {formData.avatar_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData((prev) => ({ ...prev, avatar_url: '' }))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-name">Full Name</Label>
            <Input
              id="profile-name"
              placeholder="Your full name"
              value={formData.full_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-title">Job Title</Label>
            <Input
              id="profile-title"
              placeholder="e.g. Software Engineer"
              value={formData.job_title}
              onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="profile-dept">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(v) => setFormData((prev) => ({ ...prev, department: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                <SelectItem value="Engineering">Engineering</SelectItem>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Human Resources">Human Resources</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Operations">Operations</SelectItem>
                <SelectItem value="Product">Product</SelectItem>
                <SelectItem value="Design">Design</SelectItem>
                <SelectItem value="Support">Support</SelectItem>
                <SelectItem value="Executive">Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <p className="text-xs text-muted-foreground">
            Email: {profile?.email} (managed by your identity provider)
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
