import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useCallback, useMemo } from 'react'
import * as recruitmentDb from '@/lib/recruitment-db'
import type { JobApplication } from '@/lib/recruitment-db'
import { useEmployeePortal } from '@/contexts/EmployeePortalContext'
import { EmployeePortalNoAccess } from '@/components/employee/EmployeePortalNoAccess'
import { EmployeePortalPageContent } from '@/components/employee/EmployeePortalPageContent'
import { LoadingState } from '@/components/ui/loading-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from 'sonner'
import {
  Briefcase,
  MapPin,
  DollarSign,
  Clock,
  Search,
  Bookmark,
  Send,
  CheckCircle2,
  AlertCircle,
  Calendar,
} from "lucide-react"
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  EMPLOYEE_MODULE_ID,
  getEmployeeSurfaceConfig,
} from '@/lib/employee/employee-widget-layout'

interface Job {
  id: string
  title: string
  department: string
  location: string
  type: "full-time" | "part-time" | "contract"
  level: "entry" | "mid" | "senior" | "lead"
  salary: string
  postedDate: string
  description: string
  requirements: string[]
}

interface PortalApplication {
  id: string
  jobId: string
  jobTitle: string
  department: string
  appliedDate: string
  status: ReturnType<typeof recruitmentDb.mapApplicationStatusForPortal>
  interviewDate?: string | null
}

function splitEmployeeName(fullName?: string | null): { firstName: string; lastName: string } {
  const parts = fullName?.trim().split(/\s+/).filter(Boolean) ?? []
  if (parts.length === 0) return { firstName: 'Employee', lastName: 'Applicant' }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ') || 'Applicant',
  }
}

function mapApplicationForPortal(app: JobApplication): PortalApplication {
  return {
    id: app.id ?? '',
    jobId: app.jobId,
    jobTitle: app.jobTitle ?? 'Role',
    department: app.department ?? '',
    appliedDate: app.appliedDate
      ? formatDateOnly(app.appliedDate)
      : '—',
    status: recruitmentDb.mapApplicationStatusForPortal(app.status),
    interviewDate: app.interviewDate,
  }
}

export default function JobApplicationsPage() {
  const { employee, loading: portalLoading, error: portalError } = useEmployeePortal()
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [jobs, setJobs] = useState<Job[]>([])
  const [myApplications, setMyApplications] = useState<PortalApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [applicationsLoading, setApplicationsLoading] = useState(true)
  const [applyJob, setApplyJob] = useState<Job | null>(null)
  const [coverLetter, setCoverLetter] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const surfaceConfig = getEmployeeSurfaceConfig('jobs')
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: EMPLOYEE_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })

  const savedJobs: { id: string; jobTitle: string; department: string }[] = []

  const loadApplications = useCallback(async () => {
    setApplicationsLoading(true)
    try {
      const apps = await recruitmentDb.getApplicationsForCurrentUser()
      setMyApplications(apps.map(mapApplicationForPortal).filter((a) => a.id))
    } catch {
      setMyApplications([])
    } finally {
      setApplicationsLoading(false)
    }
  }, [])

  useEffect(() => {
    recruitmentDb.getAllJobs().then((data) => {
      const mapped: Job[] = data
        .filter((j) => j.is_active !== false)
        .map((j) => ({
          id: j.id,
          title: j.title,
          department: j.department ?? "",
          location: j.location ?? "",
          type: j.type === "internship" ? "contract" : j.type,
          level: j.level,
          salary: j.salary ?? "",
          postedDate: j.postedDate ?? "",
          description: j.description ?? "",
          requirements: Array.isArray(j.qualifications) ? j.qualifications : [],
        }))
      setJobs(mapped)
    }).catch(() => setJobs([])).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    void loadApplications()
  }, [loadApplications])

  useEffect(() => {
    const onUpdated = () => {
      void loadApplications()
    }
    window.addEventListener('applicationUpdated', onUpdated)
    return () => window.removeEventListener('applicationUpdated', onUpdated)
  }, [loadApplications])

  const appliedJobIds = useMemo(
    () => new Set(myApplications.map((app) => app.jobId)),
    [myApplications]
  )

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesDepartment = departmentFilter === "all" || job.department === departmentFilter
    return matchesSearch && matchesDepartment
  })

  const getLevelColor = (level: string) => {
    switch (level) {
      case "entry": return "border-green-500 text-green-600 bg-green-500/10"
      case "mid": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "senior": return "border-purple-500 text-purple-600 bg-purple-500/10"
      case "lead": return "border-orange-500 text-orange-600 bg-orange-500/10"
      default: return ""
    }
  }

  const getStatusColor = (status: PortalApplication['status']) => {
    switch (status) {
      case "under-review": return "border-yellow-500 text-yellow-600 bg-yellow-500/10"
      case "interview": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "offer": return "border-green-500 text-green-600 bg-green-500/10"
      case "rejected": return "border-red-500 text-red-600 bg-red-500/10"
      default: return ""
    }
  }

  const getStatusLabel = (status: PortalApplication['status']) => {
    switch (status) {
      case "under-review": return "Under Review"
      case "interview": return "Interview Stage"
      case "offer": return "Offer"
      case "rejected": return "Not Selected"
      default: return status
    }
  }

  const handleApply = async () => {
    if (!applyJob || !employee) return

    const { firstName, lastName } = splitEmployeeName(employee.name)
    const email = employee.email?.trim()
    if (!email) {
      toast.error('Your employee profile needs an email before you can apply.')
      return
    }

    setSubmitting(true)
    try {
      const result = await recruitmentDb.submitEmployeeJobApplication({
        jobId: applyJob.id,
        jobTitle: applyJob.title,
        firstName,
        lastName,
        email,
        location: employee.department ?? '',
        coverLetter,
      })

      if (!result.ok) {
        if (result.reason === 'already_applied') {
          toast.message('You already applied to this role.')
        } else {
          toast.error('Could not submit your application. Please try again.')
        }
        return
      }

      toast.success('Application submitted', {
        description: `We'll notify you when HR updates your status for ${applyJob.title}.`,
      })
      setApplyJob(null)
      setCoverLetter('')
      await loadApplications()
    } finally {
      setSubmitting(false)
    }
  }

  if (portalLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <LoadingState message="Loading…" />
      </div>
    )
  }
  if (!employee) {
    return <EmployeePortalNoAccess error={portalError ?? undefined} />
  }
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-8">
        <LoadingState message="Loading jobs…" />
      </div>
    )
  }

  return (
    <EmployeePortalPageContent>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Internal Jobs</h1>
          <p className="text-muted-foreground">Explore new opportunities within the company</p>
        </div>
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
          dataTourCustomize="launchpad-jobs-customize"
        />
      </div>

      {isCustomizeMode ? (
        <div className="space-y-3 mb-4">
          <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
          <div className="flex flex-wrap items-center gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
          </div>
        </div>
      ) : null}

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={surfaceConfig.catalog}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        renderWidget={(widgetId) => {
          if (widgetId === 'jobs_summary') {
            return (
              <div className="h-full grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{jobs.length}</div>
                  </CardContent>
                </Card>
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">My Applications</CardTitle>
                    <Send className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{myApplications.length}</div>
                  </CardContent>
                </Card>
                <Card className="h-full overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Saved Jobs</CardTitle>
                    <Bookmark className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{savedJobs.length}</div>
                  </CardContent>
                </Card>
              </div>
            )
          }

          if (widgetId === 'browse_jobs') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Browse Jobs</CardTitle>
                  <CardDescription>Open roles with search and filters</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Search jobs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                      <SelectTrigger className="w-full md:w-[200px]">
                        <SelectValue placeholder="All Departments" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {Array.from(new Set(jobs.map((j) => j.department).filter(Boolean))).sort().map((dept) => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-4">
                    {filteredJobs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-12 text-center">
                        No open positions at the moment. Check back later for new opportunities.
                      </p>
                    ) : filteredJobs.map((job) => {
                      const alreadyApplied = appliedJobIds.has(job.id)
                      return (
                        <Card key={job.id} className="hover:shadow-lg transition-shadow">
                          <CardHeader>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <CardTitle>{job.title}</CardTitle>
                                  <Badge variant="outline" className={getLevelColor(job.level)}>
                                    {job.level}
                                  </Badge>
                                  <Badge variant="outline">{job.type}</Badge>
                                  {alreadyApplied && (
                                    <Badge variant="secondary">Applied</Badge>
                                  )}
                                </div>
                                <CardDescription>{job.department}</CardDescription>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">{job.description}</p>

                            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                {job.location}
                              </span>
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                {job.salary}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                Posted {job.postedDate}
                              </span>
                            </div>

                            {job.requirements.length > 0 && (
                              <div>
                                <h4 className="font-semibold text-sm mb-2">Requirements:</h4>
                                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                  {job.requirements.map((req, i) => (
                                    <li key={i}>{req}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <div className="flex gap-2 pt-2">
                              <Button
                                className="flex-1"
                                disabled={alreadyApplied}
                                onClick={() => {
                                  setCoverLetter('')
                                  setApplyJob(job)
                                }}
                              >
                                <Send className="w-4 h-4 mr-2" />
                                {alreadyApplied ? 'Already Applied' : 'Apply Now'}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'my_applications') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>My Applications</CardTitle>
                  <CardDescription>Submitted applications and status updates</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {applicationsLoading ? (
                    <LoadingState message="Loading your applications…" />
                  ) : myApplications.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      You haven&apos;t applied to any internal positions yet. Browse open jobs and click Apply to submit an application.
                    </p>
                  ) : myApplications.map((app) => (
                    <Card key={app.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <CardTitle>{app.jobTitle}</CardTitle>
                            <CardDescription>{app.department}</CardDescription>
                          </div>
                          <Badge variant="outline" className={getStatusColor(app.status)}>
                            {app.status === "under-review" ? (
                              <>
                                <AlertCircle className="w-3 h-3 mr-1" />
                                {getStatusLabel(app.status)}
                              </>
                            ) : app.status === "interview" ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                {getStatusLabel(app.status)}
                              </>
                            ) : (
                              getStatusLabel(app.status)
                            )}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            Applied {app.appliedDate}
                          </span>
                          {app.interviewDate && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              Interview {new Date(app.interviewDate).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'saved_jobs') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle>Saved Jobs</CardTitle>
                  <CardDescription>Bookmarked openings for later</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {savedJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">
                      No saved jobs. Save positions you&apos;re interested in to find them here.
                    </p>
                  ) : savedJobs.map((job) => (
                    <Card key={job.id}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle>{job.jobTitle}</CardTitle>
                            <CardDescription>{job.department}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                    </Card>
                  ))}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />

      <Dialog open={applyJob != null} onOpenChange={(open) => !open && setApplyJob(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for {applyJob?.title}</DialogTitle>
            <DialogDescription>
              Submit your internal application. HR will review it and you&apos;ll get updates in your employee feed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <label htmlFor="cover-letter" className="text-sm font-medium">
              Note to hiring team (optional)
            </label>
            <Textarea
              id="cover-letter"
              placeholder="Why are you interested in this role?"
              value={coverLetter}
              onChange={(e) => setCoverLetter(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyJob(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={() => void handleApply()} disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </EmployeePortalPageContent>
  )
}
