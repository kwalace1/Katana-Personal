import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { 
  Users,
  UserPlus,
  Eye,
  EyeOff,
  Calendar,
  FileText,
  Star,
  Mail,
  Phone,
  MapPin,
  Linkedin,
  Globe,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  UserX,
  Trash2,
  Sparkles,
  GraduationCap,
  Briefcase,
  Target,
  Loader2,
} from "lucide-react"
import {
  getAllApplications,
  getJobsForMatching,
  updateApplicationStatus,
  updateApplicationNotes,
  rateApplication as rateApp,
  revealApplicantInfo,
  deleteApplication,
  addApplicationToTalentPool,
  getTalentPoolApplicationIds,
  getResumeDisplayName,
  hasResumeAttachment,
  type Job,
  type JobApplication,
} from "@/lib/recruitment-db"
import {
  applyBlindViewToApplication,
  hasAnonymousProfile,
  mergeResumeProfile,
} from "@/lib/anonymous-resume-profile"
import { downloadResumeForApplication } from "@/lib/anonymized-resume-pdf"
import {
  getMatchedSkillsPreview,
  scoreApplication,
  sortApplicationsByMatch,
} from "@/lib/recruitment-matching"
import { JobMatchCriteriaDialog } from "@/components/hr/job-match-criteria-dialog"
import { supabase } from "@/lib/supabase"

type Application = JobApplication

export function RecruitmentDashboard() {
  const [applications, setApplications] = useState<Application[]>([])
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterJobId, setFilterJobId] = useState<string>("all")
  const [sortByMatch, setSortByMatch] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [jobs, setJobs] = useState<Job[]>([])
  const [criteriaJob, setCriteriaJob] = useState<Job | null>(null)
  const [criteriaDialogOpen, setCriteriaDialogOpen] = useState(false)
  const [resumeDownloadingId, setResumeDownloadingId] = useState<string | null>(null)
  const [talentPoolAppIds, setTalentPoolAppIds] = useState<Set<string>>(new Set())
  const [talentPoolSavingId, setTalentPoolSavingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    reviewing: 0,
    interviewScheduled: 0,
    interviewed: 0,
    offers: 0,
  })

  useEffect(() => {
    loadApplications()

    const handleUpdate = () => {
      loadApplications()
    }

    window.addEventListener('applicationSubmitted', handleUpdate)
    window.addEventListener('applicationUpdated', handleUpdate)
    window.addEventListener('talentPoolUpdated', handleUpdate)

    return () => {
      window.removeEventListener('applicationSubmitted', handleUpdate)
      window.removeEventListener('applicationUpdated', handleUpdate)
      window.removeEventListener('talentPoolUpdated', handleUpdate)
    }
  }, [])

  const loadApplications = async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const [allApps, jobRows, poolIds] = await Promise.all([
        getAllApplications(),
        getJobsForMatching(),
        getTalentPoolApplicationIds(),
      ])
      setApplications(allApps)
      setJobs(jobRows)
      setTalentPoolAppIds(poolIds)

      const calculatedStats = {
        total: allApps.length,
        new: allApps.filter(app => app.status === 'new').length,
        reviewing: allApps.filter(app => app.status === 'reviewing').length,
        interviewScheduled: allApps.filter(app => app.status === 'interview-scheduled').length,
        interviewed: allApps.filter(app => app.status === 'interviewed').length,
        offers: allApps.filter(app => app.status === 'offer').length,
      }
      setStats(calculatedStats)
    } catch (err) {
      console.error('Error loading applications:', err)
      setLoadError(err instanceof Error ? err.message : 'Failed to load applications')
      setApplications([])
      setJobs([])
    } finally {
      setLoading(false)
    }
  }

  const jobsById = new Map(jobs.map((j) => [j.id, j]))

  const filteredApplications = (() => {
    let list = applications.filter((app) => {
      const matchesStatus = filterStatus === "all" || app.status === filterStatus
      const matchesJob = filterJobId === "all" || app.jobId === filterJobId
      const matchesSearch =
        app.anonymousId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.jobTitle?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.department?.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesStatus && matchesJob && matchesSearch
    })
    if (sortByMatch) {
      list = sortApplicationsByMatch(list, jobsById)
    }
    return list
  })()

  const selectedJobForCriteria =
    filterJobId !== "all" ? jobsById.get(filterJobId) ?? null : null

  const getMatchScore = (app: Application): number | null =>
    scoreApplication(app, jobsById.get(app.jobId) ?? null)

  const renderAnonymousProfile = (app: Application) => {
    const profile = mergeResumeProfile(app.resumeProfile, app.coverLetter)
    if (!hasAnonymousProfile(profile)) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No parsed resume profile yet. Re-submit with a PDF resume or use Add Candidate with resume upload.
        </p>
      )
    }
    const job = jobsById.get(app.jobId)
    const matched = getMatchedSkillsPreview(app, job ?? null)
    const score = getMatchScore(app)
    return (
      <div className="space-y-3 text-sm">
        {score != null && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                score >= 75
                  ? "border-green-500 text-green-700 bg-green-500/10"
                  : score >= 50
                    ? "border-amber-500 text-amber-700 bg-amber-500/10"
                    : "border-muted-foreground/40"
              }
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {score}% match
            </Badge>
            {matched.length > 0 && (
              <span className="text-muted-foreground">
                Matches: {matched.join(", ")}
              </span>
            )}
          </div>
        )}
        {profile?.skills && (
          <div>
            <span className="font-medium text-foreground">Skills: </span>
            <span className="text-muted-foreground">{profile.skills}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-4 text-muted-foreground">
          {profile?.experience && (
            <span className="flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5" />
              {profile.experience} experience
            </span>
          )}
          {profile?.education && (
            <span className="flex items-center gap-1">
              <GraduationCap className="w-3.5 h-3.5" />
              {profile.education}
            </span>
          )}
          {profile?.position && (
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              {profile.position}
            </span>
          )}
        </div>
        {profile?.summary && (
          <p className="text-muted-foreground line-clamp-3 border-l-2 pl-3 border-primary/30">
            {profile.summary}
          </p>
        )}
      </div>
    )
  }

  const handleRevealInfo = async (app: Application) => {
    if (!app.id) return

    if (!canRevealIdentity(app)) {
      alert("Cannot reveal identity. Candidate must be in 'Interviewed' or 'Offer' status to view personal information.")
      return
    }

    const success = await revealApplicantInfo(app.id)

    if (!success) {
      alert("Failed to reveal identity. Please try again or check your permissions.")
      return
    }

    // Optimistic local update so the open dialog refreshes immediately
    if (selectedApplication?.id === app.id) {
      setSelectedApplication(
        applyBlindViewToApplication({ ...selectedApplication, isRevealed: true }),
      )
    }

    await loadApplications()
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
  }
  
  const canRevealIdentity = (app: Application): boolean => {
    return (
      app.status === 'interviewed' ||
      app.status === 'offer' ||
      app.status === 'rejected' ||
      app.status === 'withdrawn'
    )
  }

  const handleResumeDownload = async (app: Application) => {
    if (!app.id) return
    setResumeDownloadingId(app.id)
    try {
      await downloadResumeForApplication({
        applicationId: app.id,
        anonymousId: app.anonymousId ?? app.id,
        isRevealed: !!app.isRevealed,
        resumeProfile:
          app.resumeProfile ?? mergeResumeProfile(app.resumeProfile, app.coverLetter),
        resumeUrl: app.resumeUrl,
        resumeFileName: app.resumeFileName,
        coverLetter: app.coverLetter,
      })
    } catch (err) {
      console.error('Resume download failed:', err)
      const detail = err instanceof Error ? err.message : String(err)
      alert(
        `Could not prepare resume download. Please try again.\n\n${detail.slice(0, 200)}`,
      )
    } finally {
      setResumeDownloadingId(null)
    }
  }

  const handleDeleteClick = (app: Application) => {
    setApplicationToDelete(app)
    setIsDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async () => {
    if (!applicationToDelete) return

    const success = await deleteApplication(applicationToDelete.id || '')
    if (success) {
      setIsDeleteDialogOpen(false)
      setApplicationToDelete(null)
      loadApplications()
      
      // Close details dialog if the deleted app was being viewed
      if (selectedApplication?.id === applicationToDelete.id) {
        setIsDetailsOpen(false)
        setSelectedApplication(null)
      }
    }
  }

  const handleAddToTalentPool = async (app: Application) => {
    if (!app.id) return
    setTalentPoolSavingId(app.id)
    try {
      const result = await addApplicationToTalentPool(app.id)
      if (result.ok) {
        setTalentPoolAppIds((prev) => new Set([...prev, app.id!]))
        alert(
          result.alreadyExists
            ? 'This candidate is already in the talent pool.'
            : `${app.isRevealed ? `${app.firstName} ${app.lastName}` : app.anonymousId} saved to the talent pool for future roles.`,
        )
      } else {
        alert(result.error)
      }
    } finally {
      setTalentPoolSavingId(null)
    }
  }

  const handleStatusChange = async (appId: string, status: Application['status']) => {
    if (!status) return
    const app = applications.find(a => a.id === appId)
    const interviewedStages = ['interviewed', 'interview-scheduled']
    if (
      status === 'rejected' &&
      app?.status &&
      interviewedStages.includes(app.status) &&
      !talentPoolAppIds.has(appId)
    ) {
      const save = window.confirm(
        `${app.anonymousId ?? 'This candidate'} was interviewed but not selected for this role.\n\nSave them to the Talent Pool so you can consider them for future openings?`,
      )
      if (save) {
        await handleAddToTalentPool(app)
      }
    }

    const preInterviewStatuses = ['new', 'reviewing', 'interview-scheduled']
    const wasRevealed = app?.isRevealed

    await updateApplicationStatus(appId, status)

    if (wasRevealed && preInterviewStatuses.includes(status)) {
      alert(
        "Status changed to '" +
          status +
          "'. Identity has been hidden again for blind screening at this stage.",
      )
    }
    
    await loadApplications()
    
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
  }

  const handleRating = async (appId: string, rating: number) => {
    await rateApp(appId, rating)
    await loadApplications()
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
  }

  const handleScheduleInterview = async (appId: string, date: string, time?: string) => {
    const interviewDate = time ? `${date}T${time}` : date
    const { error } = await supabase
      .from('job_applications')
      .update({ 
        interview_date: interviewDate,
        status: 'interview-scheduled'
      })
      .eq('id', appId)
    
    if (!error) {
      await loadApplications()
      window.dispatchEvent(new CustomEvent('applicationUpdated'))
    }
  }

  const addApplicationNotes = async (appId: string, notes: string) => {
    await updateApplicationNotes(appId, notes)
    await loadApplications()
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
  }

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case "new": return "border-blue-500 text-blue-600 bg-blue-500/10"
      case "reviewing": return "border-yellow-500 text-yellow-600 bg-yellow-500/10"
      case "interview-scheduled": return "border-purple-500 text-purple-600 bg-purple-500/10"
      case "interviewed": return "border-indigo-500 text-indigo-600 bg-indigo-500/10"
      case "offer": return "border-green-500 text-green-600 bg-green-500/10"
      case "rejected": return "border-red-500 text-red-600 bg-red-500/10"
      case "withdrawn": return "border-gray-500 text-gray-600 bg-gray-500/10"
      default: return ""
    }
  }

  const getStatusIcon = (status: Application['status']) => {
    switch (status) {
      case "new": return <AlertCircle className="w-4 h-4" />
      case "reviewing": return <Clock className="w-4 h-4" />
      case "interview-scheduled": return <Calendar className="w-4 h-4" />
      case "interviewed": return <CheckCircle2 className="w-4 h-4" />
      case "offer": return <CheckCircle2 className="w-4 h-4" />
      case "rejected": return <XCircle className="w-4 h-4" />
      case "withdrawn": return <UserX className="w-4 h-4" />
      default: return null
    }
  }

  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Reviewing</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.reviewing}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interview</CardTitle>
            <Calendar className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.interviewScheduled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Interviewed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.interviewed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offers</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.offers}</div>
          </CardContent>
        </Card>
      </div>


      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Blind screening uses parsed resume data — identity and PDF filename stay hidden until reveal.
            </p>
            <div className="flex gap-2">
              <Button
                variant={sortByMatch ? "default" : "outline"}
                size="sm"
                onClick={() => setSortByMatch(!sortByMatch)}
              >
                Sort by match
              </Button>
              {selectedJobForCriteria && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCriteriaJob(selectedJobForCriteria)
                    setCriteriaDialogOpen(true)
                  }}
                >
                  <Target className="w-4 h-4 mr-1" />
                  Job criteria
                </Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Input
                placeholder="Search by ID, job title, or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div>
              <Select value={filterJobId} onValueChange={setFilterJobId}>
                <SelectTrigger>
                  <SelectValue placeholder="All jobs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All job postings</SelectItem>
                  {jobs.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.title} — {j.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="reviewing">Reviewing</SelectItem>
                  <SelectItem value="interview-scheduled">Interview Scheduled</SelectItem>
                  <SelectItem value="interviewed">Interviewed</SelectItem>
                  <SelectItem value="offer">Offer</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <JobMatchCriteriaDialog
        job={criteriaJob}
        open={criteriaDialogOpen}
        onOpenChange={setCriteriaDialogOpen}
        onSaved={loadApplications}
      />

      {/* Applications List */}
      <div className="space-y-4">
        {loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">Loading applications…</p>
            </CardContent>
          </Card>
        )}

        {!loading && loadError && (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <p className="font-medium mb-1">Couldn&apos;t load applications</p>
              <p className="text-sm text-muted-foreground mb-4">{loadError}</p>
              <Button variant="outline" onClick={() => void loadApplications()}>
                Try again
              </Button>
            </CardContent>
          </Card>
        )}

        {!loading && !loadError && filteredApplications.map((app) => (
          <Card key={app.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <CardTitle className="text-xl">
                      {app.isRevealed ? (
                        <span className="flex items-center gap-2">
                          <Eye className="w-5 h-5 text-green-500" />
                          {app.firstName} {app.lastName}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <EyeOff className="w-5 h-5 text-muted-foreground" />
                          {app.anonymousId}
                        </span>
                      )}
                    </CardTitle>
                    <Badge variant="outline" className={getStatusColor(app.status)}>
                      {getStatusIcon(app.status)}
                      <span className="ml-1">{app.status?.replace('-', ' ')}</span>
                    </Badge>
                    {app.rating && (
                      <div className="flex items-center gap-1">
                        {Array.from({ length: app.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        ))}
                      </div>
                    )}
                    {(() => {
                      const match = getMatchScore(app)
                      if (match == null) return null
                      return (
                        <Badge variant="secondary" className="gap-1">
                          <Sparkles className="w-3 h-3" />
                          {match}% fit
                        </Badge>
                      )
                    })()}
                  </div>
                  <CardDescription className="flex items-center gap-4 flex-wrap">
                    <span className="font-medium">{app.jobTitle}</span>
                    <span>•</span>
                    <span>{app.department}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Applied {app.appliedDate}
                    </span>
                    {app.interviewDate && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-purple-600">
                          <Calendar className="w-3 h-3" />
                          Interview: {app.interviewDate}
                        </span>
                      </>
                    )}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Anonymous professional profile (from parsed resume) */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/15">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Resume insights (anonymous)
                </div>
                {renderAnonymousProfile(app)}
              </div>

              {/* Show limited info for anonymous applicants */}
              {!app.isRevealed && (
                <div className="p-4 rounded-lg bg-muted/30 border border-dashed">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <EyeOff className="w-4 h-4" />
                    <span className="font-medium">Personal information hidden</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {canRevealIdentity(app) 
                      ? "Click 'Reveal Identity' to view name, contact details, and the original resume file."
                      : "Personal information will be available once the candidate reaches 'interviewed' status."}
                  </p>
                </div>
              )}

              {/* Show full info for revealed applicants */}
              {app.isRevealed && (() => {
                const isPlaceholderEmail =
                  !app.email ||
                  app.email === 'anonymous@redacted.com' ||
                  app.email === 'sealed@katana.blind'
                const isPlaceholderPhone = !app.phone || /XXX-XXXX/i.test(app.phone)
                const isPlaceholderLocation = !app.location || app.location === 'Location Redacted'
                const allPlaceholder = isPlaceholderEmail && isPlaceholderPhone && isPlaceholderLocation
                const revealerLabel = app.revealedByName || app.revealedBy || 'recruiter'
                return (
                  <div className="space-y-2 p-4 rounded-lg bg-green-500/5 border border-green-500/20">
                    {allPlaceholder && (
                      <div className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                        Identity is unlocked, but no real contact details were captured for this candidate. Open <strong>Edit</strong> to add their email, phone, and location.
                      </div>
                    )}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-muted-foreground" />
                          <span className={isPlaceholderEmail ? 'text-muted-foreground italic' : ''}>
                            {isPlaceholderEmail ? 'No email on file' : app.email}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-muted-foreground" />
                          <span className={isPlaceholderPhone ? 'text-muted-foreground italic' : ''}>
                            {isPlaceholderPhone ? 'No phone on file' : app.phone}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-muted-foreground" />
                          <span className={isPlaceholderLocation ? 'text-muted-foreground italic' : ''}>
                            {isPlaceholderLocation ? 'No location on file' : app.location}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Revealed by {revealerLabel} on {app.revealedAt ? new Date(app.revealedAt).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Professional info (always visible) */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  {hasResumeAttachment(app) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1"
                      disabled={resumeDownloadingId === app.id}
                      onClick={() => handleResumeDownload(app)}
                      title={
                        app.isRevealed
                          ? 'Download original resume'
                          : 'Download anonymized resume (identifiers removed)'
                      }
                    >
                      {resumeDownloadingId === app.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                      {app.isRevealed
                        ? getResumeDisplayName(app.resumeFileName, true)
                        : 'Anonymized resume (PDF)'}
                    </Button>
                  )}
                  {app.isRevealed && app.linkedin && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={app.linkedin} target="_blank" rel="noopener noreferrer">
                        <Linkedin className="w-4 h-4 mr-1" />
                        LinkedIn
                      </a>
                    </Button>
                  )}
                  {app.isRevealed && app.portfolio && (
                    <Button variant="ghost" size="sm" asChild>
                      <a href={app.portfolio} target="_blank" rel="noopener noreferrer">
                        <Globe className="w-4 h-4 mr-1" />
                        Portfolio
                      </a>
                    </Button>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedApplication(app)
                    setIsDetailsOpen(true)
                  }}
                >
                  View Details
                </Button>
                {!app.isRevealed && (
                  <Button
                    onClick={() => handleRevealInfo(app)}
                    disabled={!canRevealIdentity(app)}
                    className={canRevealIdentity(app) ? "bg-green-500 hover:bg-green-600" : ""}
                    title={canRevealIdentity(app) ? "Reveal identity" : "Candidate must be 'interviewed' or 'offer' status"}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Reveal Identity
                  </Button>
                )}
                {(app.status === 'interviewed' ||
                  app.status === 'interview-scheduled' ||
                  app.status === 'rejected') &&
                  app.id && (
                    <Button
                      variant="outline"
                      disabled={talentPoolAppIds.has(app.id) || talentPoolSavingId === app.id}
                      onClick={() => handleAddToTalentPool(app)}
                      title="Keep contact info and skills for future job openings"
                    >
                      {talentPoolSavingId === app.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {talentPoolAppIds.has(app.id) ? 'In talent pool' : 'Save to talent pool'}
                    </Button>
                  )}
                <Select
                  value={app.status}
                  onValueChange={(value) => handleStatusChange(app.id || '', value as Application['status'])}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="interview-scheduled">Interview Scheduled</SelectItem>
                    <SelectItem value="interviewed">Interviewed</SelectItem>
                    <SelectItem value="offer">Offer</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => handleDeleteClick(app)}
                  title="Delete application"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {!loading && !loadError && filteredApplications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No applications found</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Application Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent size="lg">
          {selectedApplication && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl flex items-center gap-2">
                  {selectedApplication.isRevealed ? (
                    <>
                      <Eye className="w-6 h-6 text-green-500" />
                      {selectedApplication.firstName} {selectedApplication.lastName}
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-6 h-6 text-muted-foreground" />
                      {selectedApplication.anonymousId}
                    </>
                  )}
                </DialogTitle>
                <DialogDescription>
                  {selectedApplication.jobTitle} • {selectedApplication.department}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="profile" className="mt-4">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="profile">Resume profile</TabsTrigger>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="cover-letter">Application</TabsTrigger>
                  <TabsTrigger value="notes">Notes & Rating</TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-primary" />
                        Anonymous resume profile
                      </CardTitle>
                      <CardDescription>
                        Parsed from resume without exposing identity. Match score uses job criteria.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {renderAnonymousProfile(selectedApplication)}
                      {hasResumeAttachment(selectedApplication) && (
                        <Button
                          variant="default"
                          className="w-full sm:w-auto"
                          disabled={resumeDownloadingId === selectedApplication.id}
                          onClick={() => handleResumeDownload(selectedApplication)}
                        >
                          {resumeDownloadingId === selectedApplication.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          {selectedApplication.isRevealed
                            ? 'Download original resume'
                            : 'Download anonymized resume (PDF)'}
                        </Button>
                      )}
                      {!selectedApplication.isRevealed && hasResumeAttachment(selectedApplication) && (
                        <p className="text-xs text-muted-foreground">
                          Names, contact info, gender, age, ethnicity, and similar identifiers are
                          removed or masked. Reveal identity to access the original file.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                  {selectedApplication && jobsById.get(selectedApplication.jobId) && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCriteriaJob(jobsById.get(selectedApplication.jobId)!)
                        setCriteriaDialogOpen(true)
                      }}
                    >
                      <Target className="w-4 h-4 mr-2" />
                      Edit match criteria for {jobsById.get(selectedApplication.jobId)?.title}
                    </Button>
                  )}
                </TabsContent>

                <TabsContent value="details" className="space-y-4">
                  {!selectedApplication.isRevealed ? (
                    <div className="p-6 rounded-lg bg-muted/30 border border-dashed text-center">
                      <EyeOff className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <h3 className="font-semibold mb-2">Identity Hidden</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {canRevealIdentity(selectedApplication)
                          ? "Personal information is hidden. You can now reveal the identity to view contact details."
                          : "Personal information is hidden until the candidate reaches 'interviewed' status. Update the candidate status to 'interviewed' or 'offer' to reveal identity."}
                      </p>
                      {canRevealIdentity(selectedApplication) ? (
                        <Button onClick={() => handleRevealInfo(selectedApplication)} className="bg-green-500 hover:bg-green-600">
                          <Eye className="w-4 h-4 mr-2" />
                          Reveal Identity
                        </Button>
                      ) : (
                        <Button disabled className="opacity-50">
                          <Eye className="w-4 h-4 mr-2" />
                          Reveal Identity (Requires Interviewed Status)
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-muted-foreground">First Name</Label>
                              <p className="font-medium">{selectedApplication.firstName}</p>
                            </div>
                            <div>
                              <Label className="text-xs text-muted-foreground">Last Name</Label>
                              <p className="font-medium">{selectedApplication.lastName}</p>
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Email</Label>
                            <p className="font-medium">{selectedApplication.email}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Phone</Label>
                            <p className="font-medium">{selectedApplication.phone}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground">Location</Label>
                            <p className="font-medium">{selectedApplication.location}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Professional Links</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedApplication.isRevealed && selectedApplication.linkedin && (
                        <Button variant="outline" className="w-full justify-start" asChild>
                          <a href={selectedApplication.linkedin} target="_blank" rel="noopener noreferrer">
                            <Linkedin className="w-4 h-4 mr-2" />
                            LinkedIn Profile
                          </a>
                        </Button>
                      )}
                      {selectedApplication.isRevealed && selectedApplication.portfolio && (
                        <Button variant="outline" className="w-full justify-start" asChild>
                          <a href={selectedApplication.portfolio} target="_blank" rel="noopener noreferrer">
                            <Globe className="w-4 h-4 mr-2" />
                            Portfolio Website
                          </a>
                        </Button>
                      )}
                      {hasResumeAttachment(selectedApplication) && (
                        <Button
                          variant="outline"
                          className="w-full justify-start"
                          disabled={resumeDownloadingId === selectedApplication.id}
                          onClick={() => handleResumeDownload(selectedApplication)}
                        >
                          {resumeDownloadingId === selectedApplication.id ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Download className="w-4 h-4 mr-2" />
                          )}
                          {selectedApplication.isRevealed
                            ? getResumeDisplayName(selectedApplication.resumeFileName, true)
                            : 'Download anonymized resume (PDF)'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="cover-letter">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Application text</CardTitle>
                      {!selectedApplication.isRevealed && (
                        <CardDescription>
                          Personal identifiers are removed until you reveal identity after interview.
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <p className="whitespace-pre-wrap text-sm">
                        {selectedApplication.coverLetter}
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="notes" className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Rating</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Button
                            key={rating}
                            variant="outline"
                            size="icon"
                            onClick={() => handleRating(selectedApplication.id || '', rating)}
                          >
                            <Star
                              className={`w-5 h-5 ${
                                rating <= (selectedApplication.rating || 0)
                                  ? 'fill-yellow-500 text-yellow-500'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Recruiter Notes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        placeholder="Add notes about this candidate..."
                        value={selectedApplication.notes || ''}
                        onChange={(e) => addApplicationNotes(selectedApplication.id || '', e.target.value)}
                        rows={6}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Schedule Interview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label>Interview Date</Label>
                          <Input
                            type="date"
                            value={(selectedApplication.interviewDate || '').slice(0, 10)}
                            onChange={(e) => {
                              const currentTime = (selectedApplication.interviewDate || '').includes('T')
                                ? (selectedApplication.interviewDate || '').split('T')[1]?.slice(0, 5)
                                : undefined
                              handleScheduleInterview(selectedApplication.id || '', e.target.value, currentTime)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Interview Time</Label>
                          <Input
                            type="time"
                            value={(selectedApplication.interviewDate || '').includes('T')
                              ? (selectedApplication.interviewDate || '').split('T')[1]?.slice(0, 5) || ''
                              : ''}
                            onChange={(e) => {
                              const datePart = (selectedApplication.interviewDate || '').slice(0, 10)
                              if (datePart) {
                                handleScheduleInterview(selectedApplication.id || '', datePart, e.target.value)
                              }
                            }}
                            disabled={!(selectedApplication.interviewDate || '').slice(0, 10)}
                          />
                        </div>
                      </div>
                      {selectedApplication.interviewDate && (
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                          <p className="text-sm text-purple-600 font-medium">
                            Interview scheduled for{' '}
                            {selectedApplication.interviewDate.includes('T')
                              ? new Date(selectedApplication.interviewDate).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
                              : selectedApplication.interviewDate}
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="w-5 h-5" />
              Delete Application?
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this application? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {applicationToDelete && (
            <div className="my-4 p-4 rounded-lg bg-muted">
              <p className="font-medium">
                {applicationToDelete.isRevealed 
                  ? `${applicationToDelete.firstName} ${applicationToDelete.lastName}`
                  : applicationToDelete.anonymousId}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {applicationToDelete.jobTitle} • {applicationToDelete.department}
              </p>
              <p className="text-sm text-muted-foreground">
                Applied: {applicationToDelete.appliedDate}
              </p>
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Application
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

