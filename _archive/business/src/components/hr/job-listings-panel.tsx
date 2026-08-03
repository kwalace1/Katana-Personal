import { getTodayDateKey } from '@/lib/due-date-utils'
import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/hooks/use-toast'
import { Briefcase, ExternalLink, Plus, Trash2 } from 'lucide-react'
import {
  createJob,
  deleteJob,
  getAllJobs,
  updateJobPostingRbac,
  type Job,
  type JobVisibility,
} from '@/lib/recruitment-db'

const EMPTY_JOB_FORM = {
  title: '',
  department: '',
  location: '',
  type: 'full-time' as const,
  level: 'mid' as const,
  salary: '',
  description: '',
  visibility: 'public' as JobVisibility,
  restrictedDepartments: '',
}

interface JobListingsPanelProps {
  onJobsChanged?: () => void
}

export function JobListingsPanel({ onJobsChanged }: JobListingsPanelProps) {
  const { toast } = useToast()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isAddJobOpen, setIsAddJobOpen] = useState(false)
  const [isSubmittingJob, setIsSubmittingJob] = useState(false)
  const [newJob, setNewJob] = useState({ ...EMPTY_JOB_FORM })
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null)
  const [isDeletingJob, setIsDeletingJob] = useState(false)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    try {
      const rows = await getAllJobs()
      setJobs(rows)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  const filteredJobs = jobs.filter((job) => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      job.title.toLowerCase().includes(q) ||
      job.department.toLowerCase().includes(q) ||
      job.location.toLowerCase().includes(q)
    )
  })

  const handleCreateJob = async () => {
    if (!newJob.title || !newJob.department) {
      toast({
        title: 'Error',
        description: 'Title and department are required',
        variant: 'destructive',
      })
      return
    }
    setIsSubmittingJob(true)
    try {
      const depts = newJob.restrictedDepartments
        .split(/[,;]/)
        .map((s) => s.trim())
        .filter(Boolean)
      const result = await createJob({
        title: newJob.title,
        department: newJob.department,
        location: newJob.location || 'Remote',
        type: newJob.type,
        level: newJob.level,
        salary: newJob.salary || 'Competitive',
        postedDate: getTodayDateKey(),
        description: newJob.description || '',
        responsibilities: [],
        qualifications: [],
        benefits: [],
        visibility: newJob.visibility,
        restricted_departments: newJob.visibility === 'restricted' ? depts : [],
      })
      if ('id' in result) {
        toast({ title: 'Success', description: 'Job listing created successfully!' })
        setIsAddJobOpen(false)
        setNewJob({ ...EMPTY_JOB_FORM })
        await loadJobs()
        onJobsChanged?.()
      } else if ('error' in result) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'An unexpected error occurred'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setIsSubmittingJob(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!jobToDelete) return
    setIsDeletingJob(true)
    try {
      const result = await deleteJob(jobToDelete.id)
      if ('ok' in result) {
        toast({ title: 'Listing deleted', description: `"${jobToDelete.title}" was removed.` })
        setJobToDelete(null)
        await loadJobs()
        onJobsChanged?.()
      } else {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Could not delete listing'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    } finally {
      setIsDeletingJob(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-1">Job Listings</h2>
          <p className="text-sm text-muted-foreground">
            Create and manage open roles shown on Careers and internal hiring
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddJobOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Job Listing
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Distribute to external job boards
          </CardTitle>
          <CardDescription>
            Open employer portals to repost roles. Point applicants to your public Careers page so they
            land in Recruitment.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="https://employers.indeed.com/hire" target="_blank" rel="noopener noreferrer">
              Open Indeed <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.linkedin.com/talent/post-a-job"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open LinkedIn Jobs <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="https://www.glassdoor.com/employers/" target="_blank" rel="noopener noreferrer">
              Open Glassdoor <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active listings</CardTitle>
          <CardDescription>
            Public jobs appear on Careers; internal and restricted listings stay in HR only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            placeholder="Search by title, department, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading job listings...</p>
          ) : filteredJobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {jobs.length === 0
                ? 'No job postings yet. Click New Job Listing to create your first role.'
                : 'No listings match your search.'}
            </p>
          ) : (
            <div className="space-y-3">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{job.title}</p>
                      <Badge variant="outline" className="text-xs capitalize">
                        {job.type.replace('-', ' ')}
                      </Badge>
                      <Badge variant="secondary" className="text-xs capitalize">
                        {(job.visibility ?? 'public').replace('-', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {job.department} · {job.location || 'Remote'}
                      {job.salary ? ` · ${job.salary}` : ''}
                    </p>
                    {job.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{job.description}</p>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Posted {job.postedDate}
                      {typeof job.applicationCount === 'number'
                        ? ` · ${job.applicationCount} application${job.applicationCount === 1 ? '' : 's'}`
                        : ''}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:items-end shrink-0">
                    <Select
                      value={(job.visibility ?? 'public') as JobVisibility}
                      onValueChange={async (v) => {
                        await updateJobPostingRbac(job.id, { visibility: v as JobVisibility })
                        await loadJobs()
                        onJobsChanged?.()
                      }}
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="internal">Internal only</SelectItem>
                        <SelectItem value="restricted">Department restricted</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!job.admin_visibility_override}
                        onChange={async (e) => {
                          await updateJobPostingRbac(job.id, {
                            admin_visibility_override: e.target.checked,
                          })
                          await loadJobs()
                          onJobsChanged?.()
                        }}
                      />
                      Admin override
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setJobToDelete(job)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!jobToDelete}
        onOpenChange={(open) => {
          if (!open && !isDeletingJob) setJobToDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete job listing?</AlertDialogTitle>
            <AlertDialogDescription>
              {jobToDelete
                ? `"${jobToDelete.title}" will be removed from Careers and active listings. Existing applications stay in Recruitment.`
                : 'This listing will be removed from Careers and active listings.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingJob}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeletingJob}
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmDelete()
              }}
            >
              {isDeletingJob ? 'Deleting…' : 'Delete listing'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isAddJobOpen} onOpenChange={setIsAddJobOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Job Listing</DialogTitle>
            <DialogDescription>Add a new position that will appear on the careers page.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Job Title *</Label>
              <Input
                placeholder="e.g. Senior Software Engineer"
                value={newJob.title}
                onChange={(e) => setNewJob({ ...newJob, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Department *</Label>
                <Input
                  placeholder="e.g. Engineering"
                  value={newJob.department}
                  onChange={(e) => setNewJob({ ...newJob, department: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Location</Label>
                <Input
                  placeholder="e.g. Remote"
                  value={newJob.location}
                  onChange={(e) => setNewJob({ ...newJob, location: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select
                  value={newJob.type}
                  onValueChange={(v) =>
                    setNewJob({ ...newJob, type: v as typeof newJob.type })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full-time">Full-time</SelectItem>
                    <SelectItem value="part-time">Part-time</SelectItem>
                    <SelectItem value="contract">Contract</SelectItem>
                    <SelectItem value="internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Level</Label>
                <Select
                  value={newJob.level}
                  onValueChange={(v) =>
                    setNewJob({ ...newJob, level: v as typeof newJob.level })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entry">Entry</SelectItem>
                    <SelectItem value="mid">Mid</SelectItem>
                    <SelectItem value="senior">Senior</SelectItem>
                    <SelectItem value="lead">Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Salary</Label>
                <Input
                  placeholder="e.g. $80k-$120k"
                  value={newJob.salary}
                  onChange={(e) => setNewJob({ ...newJob, salary: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Job description..."
                value={newJob.description}
                onChange={(e) => setNewJob({ ...newJob, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label>Visibility</Label>
              <Select
                value={newJob.visibility}
                onValueChange={(v) => setNewJob({ ...newJob, visibility: v as JobVisibility })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (Careers + internal)</SelectItem>
                  <SelectItem value="internal">Internal only</SelectItem>
                  <SelectItem value="restricted">Restricted by department</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Internal listings are hidden from the public Careers page.
              </p>
            </div>
            {newJob.visibility === 'restricted' && (
              <div className="grid gap-2">
                <Label>Departments (comma-separated)</Label>
                <Input
                  placeholder="e.g. Engineering, HR"
                  value={newJob.restrictedDepartments}
                  onChange={(e) =>
                    setNewJob({ ...newJob, restrictedDepartments: e.target.value })
                  }
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddJobOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateJob} disabled={isSubmittingJob}>
              {isSubmittingJob ? 'Creating...' : 'Create Listing'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
