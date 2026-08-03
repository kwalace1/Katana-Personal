"use client"

import type React from "react"
import { useEffect, useState } from "react"
import * as hrApi from "@/lib/hr-api"
import type { TrainingCourse } from "@/lib/hr-api"
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
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, X } from "lucide-react"

interface ManageTrainingCoursesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCoursesChanged?: () => void
}

const emptyForm = () => ({
  title: "",
  description: "",
  category: "General",
  level: "intermediate" as TrainingCourse["level"],
  duration_hours: "4",
  skills: [] as string[],
  certifications: [] as string[],
})

export function ManageTrainingCoursesDialog({
  open,
  onOpenChange,
  onCoursesChanged,
}: ManageTrainingCoursesDialogProps) {
  const { toast } = useToast()
  const [courses, setCourses] = useState<TrainingCourse[]>([])
  const [loading, setLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [form, setForm] = useState(emptyForm())
  const [skillInput, setSkillInput] = useState("")
  const [certInput, setCertInput] = useState("")

  const loadCourses = async () => {
    setLoading(true)
    const data = await hrApi.getTrainingCourses(false)
    setCourses(data)
    setLoading(false)
  }

  useEffect(() => {
    if (open) {
      loadCourses()
      setForm(emptyForm())
      setSkillInput("")
      setCertInput("")
    }
  }, [open])

  const addTag = (field: "skills" | "certifications", value: string, clear: () => void) => {
    const tag = value.trim()
    if (!tag || form[field].includes(tag)) return
    setForm({ ...form, [field]: [...form[field], tag] })
    clear()
  }

  const removeTag = (field: "skills" | "certifications", tag: string) => {
    setForm({ ...form, [field]: form[field].filter((t) => t !== tag) })
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) {
      toast({ title: "Course title is required", variant: "destructive" })
      return
    }
    setIsSubmitting(true)
    try {
      const result = await hrApi.createTrainingCourse({
        title: form.title.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || "General",
        level: form.level,
        duration_hours: parseFloat(form.duration_hours) || 0,
        skills: form.skills,
        certifications: form.certifications,
      })
      if (!result) {
        toast({
          title: "Could not create course",
          description: "Run supabase-hr-training-courses-migration.sql in Supabase.",
          variant: "destructive",
        })
        return
      }
      toast({ title: "Course created", description: result.title })
      setForm(emptyForm())
      await loadCourses()
      onCoursesChanged?.()
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Delete course "${title}"? Existing assignments keep the course name.`)) return
    const ok = await hrApi.deleteTrainingCourse(id)
    if (ok) {
      toast({ title: "Course deleted" })
      await loadCourses()
      onCoursesChanged?.()
    } else {
      toast({ title: "Could not delete course", variant: "destructive" })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl">
        <DialogHeader className="shrink-0 space-y-1 border-b px-6 py-5 pr-12">
          <DialogTitle>Training course catalog</DialogTitle>
          <DialogDescription className="text-left">
            Create courses your organization can assign. Add skills and certifications employees earn when they finish each course.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:divide-x">
          <form
            onSubmit={handleCreate}
            className="flex min-h-0 flex-1 flex-col lg:max-w-md lg:flex-none lg:border-r"
          >
            <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
              <p className="text-sm font-semibold">Create course</p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 px-6 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="course-title">Title *</Label>
                  <Input
                    id="course-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Leadership Fundamentals"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="course-desc">Description</Label>
                  <Textarea
                    id="course-desc"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What employees will learn…"
                    rows={3}
                    className="resize-none"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Category</Label>
                    <Input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="General"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Level</Label>
                    <Select
                      value={form.level}
                      onValueChange={(v) => setForm({ ...form, level: v as TrainingCourse["level"] })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="beginner">Beginner</SelectItem>
                        <SelectItem value="intermediate">Intermediate</SelectItem>
                        <SelectItem value="advanced">Advanced</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-2 sm:max-w-[10rem]">
                  <Label>Duration (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.5}
                    value={form.duration_hours}
                    onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                  />
                </div>

                <TagField
                  label="Skills gained on completion"
                  placeholder="e.g. React"
                  input={skillInput}
                  onInputChange={setSkillInput}
                  tags={form.skills}
                  onAdd={() => addTag("skills", skillInput, () => setSkillInput(""))}
                  onRemove={(t) => removeTag("skills", t)}
                  variant="secondary"
                />

                <TagField
                  label="Certifications earned on completion"
                  placeholder="e.g. AWS Cloud Practitioner"
                  input={certInput}
                  onInputChange={setCertInput}
                  tags={form.certifications}
                  onAdd={() => addTag("certifications", certInput, () => setCertInput(""))}
                  onRemove={(t) => removeTag("certifications", t)}
                  variant="outline"
                />
              </div>
            </ScrollArea>
            <div className="shrink-0 border-t px-6 py-4">
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                <Plus className="mr-2 h-4 w-4" />
                {isSubmitting ? "Creating…" : "Add to catalog"}
              </Button>
            </div>
          </form>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="shrink-0 border-b bg-muted/30 px-6 py-3">
              <p className="text-sm font-semibold">Catalog ({courses.length})</p>
            </div>
            <ScrollArea className="min-h-0 flex-1">
              <div className="px-6 py-4">
                {loading ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">Loading courses…</p>
                ) : courses.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
                    No courses yet. Create your first course on the left to enable Assign Training.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {courses.map((c) => (
                      <div key={c.id} className="rounded-lg border bg-card p-4 text-sm shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium leading-snug">{c.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {c.category} · {c.level}
                              {c.duration_hours ? ` · ${c.duration_hours}h` : ""}
                            </p>
                            {c.description && (
                              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(c.id, c.title)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        {(c.skills.length > 0 || c.certifications.length > 0) && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {c.skills.map((s) => (
                              <Badge key={s} variant="secondary" className="text-xs font-normal">
                                {s}
                              </Badge>
                            ))}
                            {c.certifications.map((cert) => (
                              <Badge key={cert} variant="outline" className="text-xs font-normal">
                                {cert}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TagField({
  label,
  placeholder,
  input,
  onInputChange,
  tags,
  onAdd,
  onRemove,
  variant,
}: {
  label: string
  placeholder: string
  input: string
  onInputChange: (v: string) => void
  tags: string[]
  onAdd: () => void
  onRemove: (tag: string) => void
  variant: "secondary" | "outline"
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              onAdd()
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={onAdd}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {tags.map((t) => (
            <Badge key={t} variant={variant} className="gap-1 pr-1">
              {t}
              <button type="button" onClick={() => onRemove(t)} aria-label={`Remove ${t}`}>
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
