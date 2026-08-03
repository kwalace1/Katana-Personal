import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import * as ProjectData from '@/lib/project-data-supabase'
import {
  getQuickCreateModuleId,
  quickCreateHubItem,
  type HubQuickCreateType,
} from '@/lib/hub-quick-create'
import type { ModuleId } from '@/lib/module-access'

interface HubQuickCreateDialogProps {
  allowedModules: ModuleId[]
  onCreated?: () => void
  trigger?: React.ReactNode
}

const CREATE_OPTIONS: { value: HubQuickCreateType; label: string; description: string }[] = [
  { value: 'project', label: 'Project', description: 'New Katana PM project' },
  { value: 'task', label: 'Task', description: 'Add a task to an existing project' },
  { value: 'client', label: 'Customer', description: 'New customer success account' },
  { value: 'inventory', label: 'Inventory Item', description: 'New inventory SKU (defaults applied)' },
  { value: 'job', label: 'Workforce Job', description: 'New field service job' },
  { value: 'employee', label: 'Employee', description: 'Add someone to HR' },
]

export function HubQuickCreateDialog({ allowedModules, onCreated, trigger }: HubQuickCreateDialogProps) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [createType, setCreateType] = useState<HubQuickCreateType | ''>('')
  const [title, setTitle] = useState('')
  const [email, setEmail] = useState('')
  const [sku, setSku] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const availableOptions = useMemo(
    () =>
      CREATE_OPTIONS.filter((option) =>
        allowedModules.includes(getQuickCreateModuleId(option.value))
      ),
    [allowedModules]
  )

  useEffect(() => {
    if (!open) {
      setCreateType('')
      setTitle('')
      setEmail('')
      setSku('')
      setProjectId('')
      return
    }
    if (availableOptions.length === 1) {
      setCreateType(availableOptions[0].value)
    }
  }, [open, availableOptions])

  useEffect(() => {
    if (!open || createType !== 'task') return
    setLoadingProjects(true)
    ProjectData.getAllProjects()
      .then((items) => setProjects(items.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProjects([]))
      .finally(() => setLoadingProjects(false))
  }, [open, createType])

  const selectedOption = availableOptions.find((option) => option.value === createType)

  const handleCreate = async () => {
    if (!createType) {
      toast.error('Select what you want to create.')
      return
    }
    if (!title.trim()) {
      toast.error('Enter a title or name.')
      return
    }
    if (createType === 'employee' && !email.trim()) {
      toast.error('Employee email is required.')
      return
    }
    if (createType === 'task' && !projectId) {
      toast.error('Select a project for the task.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await quickCreateHubItem({
        type: createType,
        title: title.trim(),
        email: email.trim() || undefined,
        sku: sku.trim() || undefined,
        projectId: projectId || undefined,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
      onCreated?.()
      navigate(result.href)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (availableOptions.length === 0) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Quick Create
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quick Create</DialogTitle>
          <DialogDescription>
            Create a record in any module you have access to. You can add more details in the module afterward.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="hub-create-type">Type</Label>
            <Select
              value={createType}
              onValueChange={(value) => setCreateType(value as HubQuickCreateType)}
            >
              <SelectTrigger id="hub-create-type">
                <SelectValue placeholder="Select what to create" />
              </SelectTrigger>
              <SelectContent>
                {availableOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedOption ? (
              <p className="mt-1 text-xs text-muted-foreground">{selectedOption.description}</p>
            ) : null}
          </div>

          {createType === 'task' ? (
            <div>
              <Label htmlFor="hub-create-project">Project</Label>
              <Select value={projectId} onValueChange={setProjectId} disabled={loadingProjects}>
                <SelectTrigger id="hub-create-project">
                  <SelectValue placeholder={loadingProjects ? 'Loading projects…' : 'Select project'} />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div>
            <Label htmlFor="hub-create-title">
              {createType === 'employee' ? 'Full name' : 'Title / Name'}
            </Label>
            <Input
              id="hub-create-title"
              placeholder="Enter title or name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {createType === 'employee' ? (
            <div>
              <Label htmlFor="hub-create-email">Email</Label>
              <Input
                id="hub-create-email"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          ) : null}

          {createType === 'inventory' ? (
            <div>
              <Label htmlFor="hub-create-sku">SKU (optional)</Label>
              <Input
                id="hub-create-sku"
                placeholder="Auto-generated if left blank"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
              />
            </div>
          ) : null}

          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => void handleCreate()} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating…
                </>
              ) : (
                'Create'
              )}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
