import { getTodayDateKey, formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { MotionPage } from '@/components/motion-page'
import { useSearchParams } from 'react-router-dom'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { calculateKatanaMatchScore, defaultJobRequirements } from "@/lib/katana-matching"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import * as hrApi from '@/lib/hr-api'
import type { Employee, PerformanceReview, Goal, Feedback360, Mentorship, Recognition, LearningPath, CareerPath, TimeOffRequest, TrainingCourse } from '@/lib/hr-api'
import {
  buildHrDashboardActivities,
  mergeHrDashboardActivities,
  type HrDashboardActivityItem,
} from '@/lib/hr-dashboard-activity'
import { getAllCSMUsers, type CSMUser } from '@/lib/customer-success-api'
import { useToast } from "@/hooks/use-toast"
import { useLoggedInHrEmployee } from "@/hooks/use-logged-in-hr-employee"
import { useAuth } from "@/contexts/AuthContext"
import { toast as sonnerToast } from "sonner"
import {
  Users,
  Star,
  Briefcase,
  Search,
  Plus,
  BarChart3,
  Calendar,
  FileText,
  Target,
  Download,
  X,
  ArrowRight,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertCircle,
  Brain,
  Award,
  UserPlus,
  MessageSquare,
  Sparkles,
  Shield,
  Heart,
  BookOpen,
  Filter,
  FileCheck,
  AlertTriangle,
  ThumbsUp,
  Lightbulb,
  Rocket,
  GraduationCap,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  UserCog,
  Mail,
  Phone,
  Building,
  User,
  Activity,
  Eye,
  Trash2,
  ExternalLink,
  Ticket,
  Copy,
  Check,
} from "lucide-react"
import { AddEmployeeDialog } from "@/components/hr/add-employee-dialog"
import { AddReviewDialog } from "@/components/hr/add-review-dialog"
import { AddGoalDialog } from "@/components/hr/add-goal-dialog"
import { AddCandidateDialog } from "@/components/hr/add-candidate-dialog"
import { AddLearningPathDialog } from "@/components/hr/add-learning-path-dialog"
import { AssignTrainingDialog } from "@/components/hr/assign-training-dialog"
import { ManageTrainingCoursesDialog } from "@/components/hr/manage-training-courses-dialog"
import { AddCareerPathDialog } from "@/components/hr/add-career-path-dialog"
import { RecruitmentDashboard } from "@/components/hr/recruitment-dashboard"
import { TalentPoolPanel } from "@/components/hr/talent-pool-panel"
import { HrRecentActivityCard } from "@/components/hr/hr-recent-activity-card"
import { JobListingsPanel } from "@/components/hr/job-listings-panel"
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import { InterviewCalendar } from "@/components/hr/interview-calendar"
import { HrEmployeeCalendar } from "@/components/hr/hr-employee-calendar"
import {
  buildMemberCalendarEvents,
  computeMemberPerformanceStats,
} from "@/lib/hr-member-scoped"
import {
  getAllApplications,
  scheduleInterview,
  cancelInterview,
  getAllJobs,
} from "@/lib/recruitment-db"
import {
  parseLocalInterviewDateTime,
  buildInterviewIcs,
  buildInterviewMailtoHref,
  downloadIcsFile,
} from '@/lib/interview-calendar'
import { getOrCreateInviteForEmployee } from "@/lib/tenant-context"
import { isPilotModeEnabled } from "@/lib/pilot-access"
import { ModuleAccessBadges, ModuleAccessFields } from "@/components/hr/module-access-fields"
import { ModuleDiscussion } from "@/components/comms/ModuleDiscussion"
import { HrMemberTimeOffTab } from "@/components/hr/hr-member-time-off-tab"
import { useModuleAccess } from "@/contexts/ModuleAccessContext"
import { ModuleCustomizeControls, ModuleCustomizeHint } from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  HR_MODULE_ID,
  getHrTabSurfaceConfig,
  type HrRecruitmentSection,
  type HrTabLayoutProps,
} from '@/lib/hr/hr-widget-layout'
import {
  getHrEmployeesTabLabel,
  getVisibleHrMainTabs,
  HR_TAB_LABELS,
  isHrMainTabVisible,
  type HrMainTabId,
} from "@/lib/hr-access"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const HR_MAIN_TABS = new Set<string>([
  'dashboard',
  'recruitment',
  'job-listings',
  'calendar',
  'time-off',
  'employees',
  'performance',
  'goals',
  'analytics',
  'development',
])

/**
 * The schedule-interview save path stores notes in the format:
 *   "Interview Type: Technical\nTime: 14:30\n\n<free-form notes>"
 * Parse that back when entering edit mode so the form fields round-trip
 * cleanly. Anything we can't parse is treated as the free-form notes body.
 */
function parseStoredInterviewNotes(raw: string): {
  type: string
  time: string
  notes: string
} {
  if (!raw) return { type: '', time: '', notes: '' }
  const lines = raw.replace(/\r\n?/g, '\n').split('\n')
  let type = ''
  let time = ''
  let bodyStart = 0
  for (let i = 0; i < Math.min(lines.length, 4); i++) {
    const l = lines[i].trim()
    const typeMatch = l.match(/^Interview Type:\s*(.+)$/i)
    const timeMatch = l.match(/^Time:\s*(.+)$/i)
    if (typeMatch) {
      const v = typeMatch[1].trim()
      if (v && v.toLowerCase() !== 'not specified') type = v.toLowerCase()
      bodyStart = i + 1
      continue
    }
    if (timeMatch) {
      const v = timeMatch[1].trim()
      // Accept HH:MM (24h). Skip "Not specified".
      if (/^\d{2}:\d{2}$/.test(v)) time = v
      bodyStart = i + 1
      continue
    }
    break
  }
  // Skip a single blank separator line if present.
  if (lines[bodyStart] === '') bodyStart += 1
  const notes = lines.slice(bodyStart).join('\n').trim()
  return { type, time, notes }
}

export default function HRPage() {
  useModuleTour('hr')
  const { toast } = useToast()
  const { hasRole } = useAuth()
  const { hasHrAdminAccess } = useModuleAccess()
  const { isSelf: isLoggedInUsersEmployee, loggedInEmployeeId } = useLoggedInHrEmployee()
  const canManageHrAdmin = hasHrAdminAccess
  const canManageModuleAccess = hasRole(['owner', 'admin'])
  const visibleHrTabs = useMemo(() => getVisibleHrMainTabs(canManageHrAdmin), [canManageHrAdmin])
  const scopeHrToSelf = !canManageHrAdmin && !!loggedInEmployeeId
  const [searchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState("dashboard")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [riskFilter, setRiskFilter] = useState("all")
  const [candidateStageFilter, setCandidateStageFilter] = useState("All")
  const [pipelineJobFilter, setPipelineJobFilter] = useState("all")
  const [pipelineDepartmentFilter, setPipelineDepartmentFilter] = useState("all")
  const [editingGoal, setEditingGoal] = useState<string | null>(null)
  const [goalProgress, setGoalProgress] = useState<number>(0)
  
  // Performance tab filters
  const [performanceSort, setPerformanceSort] = useState<"rating" | "date" | "name">("date")
  const [performanceDeptFilter, setPerformanceDeptFilter] = useState("all")
  const [performanceTypeFilter, setPerformanceTypeFilter] = useState("all")
  const [performanceStatusFilter, setPerformanceStatusFilter] = useState("all")
  const [performanceSearchQuery, setPerformanceSearchQuery] = useState("")
  
  // Goals tab filters
  const [goalStatusFilter, setGoalStatusFilter] = useState("all")
  const [goalDeptFilter, setGoalDeptFilter] = useState("all")
  const [goalSort, setGoalSort] = useState<"progress" | "dueDate" | "name">("dueDate")
  const [goalCategoryFilter, setGoalCategoryFilter] = useState("all")
  const [goalSearchQuery, setGoalSearchQuery] = useState("")
  
  // Analytics date range
  const [analyticsDateRange, setAnalyticsDateRange] = useState("all")
  // Development tab section
  const [developmentSection, setDevelopmentSection] = useState<"career" | "mentorship" | "learning" | "recognition">("career")
  // Recruitment tab section
  const [recruitmentSection, setRecruitmentSection] = useState<HrRecruitmentSection>('pipeline')

  const surfaceConfig = getHrTabSurfaceConfig(activeTab, {
    recruitmentSection,
    developmentSection,
    isAdmin: canManageHrAdmin,
  })
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
    moduleId: HR_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })
  const tabLayout: HrTabLayoutProps = {
    widgets: layout.widgets,
    catalog: surfaceConfig.catalog,
    customizeMode: isCustomizeMode,
    onLayoutChange,
    onRemoveWidget: removeWidget,
  }
  const customizeChrome = isCustomizeMode ? (
    <div className="space-y-3 mb-4">
      <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
      <div className="flex flex-wrap items-center gap-2">
        <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
        <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
          Reset layout
        </Button>
      </div>
    </div>
  ) : null
  
  // Data state
  const [employees, setEmployees] = useState<Employee[]>([])
  const [performanceReviews, setPerformanceReviews] = useState<PerformanceReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [feedback360, setFeedback360] = useState<Feedback360[]>([])
  const [mentorships, setMentorships] = useState<Mentorship[]>([])
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [trainingCourses, setTrainingCourses] = useState<TrainingCourse[]>([])
  const [careerPaths, setCareerPaths] = useState<CareerPath[]>([])
  const [csmUsers, setCSMUsers] = useState<CSMUser[]>([])
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    avgPerformanceScore: 0,
    totalGoals: 0,
    onTrackGoals: 0,
    behindGoals: 0,
    completeGoals: 0,
    upcomingReviews: 0,
    overdueReviews: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [recentActivities, setRecentActivities] = useState<HrDashboardActivityItem[]>([])
  
  // Recruitment data
  const [applications, setApplications] = useState<any[]>([])
  const [openPositions, setOpenPositions] = useState<number>(0)
  const [applicationStats, setApplicationStats] = useState({
    total: 0,
    new: 0,
    reviewing: 0,
    interviewed: 0,
    offers: 0
  })

  const effectiveGoals = useMemo(
    () =>
      scopeHrToSelf
        ? goals.filter((g) => g.employee_id === loggedInEmployeeId)
        : goals,
    [goals, scopeHrToSelf, loggedInEmployeeId]
  )
  const effectivePerformanceReviews = useMemo(
    () =>
      scopeHrToSelf
        ? performanceReviews.filter((r) => r.employee_id === loggedInEmployeeId)
        : performanceReviews,
    [performanceReviews, scopeHrToSelf, loggedInEmployeeId]
  )
  const effectiveMentorships = useMemo(() => {
    if (!scopeHrToSelf || !loggedInEmployeeId) return mentorships
    return mentorships.filter(
      (m) => m.mentor_id === loggedInEmployeeId || m.mentee_id === loggedInEmployeeId
    )
  }, [mentorships, scopeHrToSelf, loggedInEmployeeId])
  const effectiveRecognitions = useMemo(() => {
    if (!scopeHrToSelf || !loggedInEmployeeId) return recognitions
    return recognitions.filter(
      (r) => r.from_id === loggedInEmployeeId || r.to_id === loggedInEmployeeId
    )
  }, [recognitions, scopeHrToSelf, loggedInEmployeeId])
  const effectiveLearningPaths = useMemo(() => {
    if (!scopeHrToSelf || !loggedInEmployeeId) return learningPaths
    return learningPaths.filter((lp) => lp.employee_id === loggedInEmployeeId)
  }, [learningPaths, scopeHrToSelf, loggedInEmployeeId])
  const effectiveCareerPaths = useMemo(() => {
    if (!scopeHrToSelf || !loggedInEmployeeId) return careerPaths
    return careerPaths.filter((cp) => cp.employee_id === loggedInEmployeeId)
  }, [careerPaths, scopeHrToSelf, loggedInEmployeeId])
  const effectiveFeedback360 = useMemo(() => {
    if (!scopeHrToSelf || !loggedInEmployeeId) return feedback360
    return feedback360.filter((f) => f.employee_id === loggedInEmployeeId)
  }, [feedback360, scopeHrToSelf, loggedInEmployeeId])

  const [myTimeOffRequests, setMyTimeOffRequests] = useState<TimeOffRequest[]>([])

  useEffect(() => {
    if (!loggedInEmployeeId) {
      setMyTimeOffRequests([])
      return
    }
    let cancelled = false
    void hrApi.getTimeOffRequestsByEmployeeId(loggedInEmployeeId).then((rows) => {
      if (!cancelled) setMyTimeOffRequests(rows)
    })
    return () => {
      cancelled = true
    }
  }, [loggedInEmployeeId])

  const loggedInEmployee = useMemo(
    () => employees.find((e) => e.id === loggedInEmployeeId) ?? null,
    [employees, loggedInEmployeeId]
  )

  const memberPerformanceStats = useMemo(
    () => computeMemberPerformanceStats(effectivePerformanceReviews, loggedInEmployee),
    [effectivePerformanceReviews, loggedInEmployee]
  )

  const memberCalendarEvents = useMemo(
    () =>
      buildMemberCalendarEvents({
        reviews: effectivePerformanceReviews,
        goals: effectiveGoals,
        timeOffRequests: myTimeOffRequests,
        employee: loggedInEmployee,
      }),
    [effectivePerformanceReviews, effectiveGoals, myTimeOffRequests, loggedInEmployee]
  )

  const displayAvgPerformanceScore = scopeHrToSelf
    ? memberPerformanceStats.avgPerformanceScore
    : stats.avgPerformanceScore
  const displayCompletedReviews = scopeHrToSelf
    ? memberPerformanceStats.completedReviews
    : effectivePerformanceReviews.filter((r) => r.status === "on-time").length
  const displayOverdueReviews = scopeHrToSelf
    ? memberPerformanceStats.overdueReviews
    : stats.overdueReviews
  const displayUpcomingReviews = scopeHrToSelf
    ? memberPerformanceStats.upcomingReviews
    : stats.upcomingReviews
  
  // Employee management state
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null)
  const [isProfileDialogOpen, setIsProfileDialogOpen] = useState(false)
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false)
  const [isGoalsDialogOpen, setIsGoalsDialogOpen] = useState(false)
  
  // Performance review dialogs state
  const [selectedReview, setSelectedReview] = useState<PerformanceReview | null>(null)
  const [isReviewDetailsOpen, setIsReviewDetailsOpen] = useState(false)
  const [isAddReviewDialogOpen, setIsAddReviewDialogOpen] = useState(false)
  const [isReviewHistoryOpen, setIsReviewHistoryOpen] = useState(false)
  
  // Goal dialogs state
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null)
  const [isGoalDetailsOpen, setIsGoalDetailsOpen] = useState(false)
  const [isAddGoalDialogOpen, setIsAddGoalDialogOpen] = useState(false)
  const [isAddCommentOpen, setIsAddCommentOpen] = useState(false)
  const [goalComment, setGoalComment] = useState('')
  
  // Development tab state
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false)
  const [isGiveRecognitionOpen, setIsGiveRecognitionOpen] = useState(false)
  const [isAddLearningPathDialogOpen, setIsAddLearningPathDialogOpen] = useState(false)
  const [isAddCareerPathDialogOpen, setIsAddCareerPathDialogOpen] = useState(false)
  
  // Selection state for deletion
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())
  const [selectedGoals, setSelectedGoals] = useState<Set<string>>(new Set())
  const [selectedMentorships, setSelectedMentorships] = useState<Set<string>>(new Set())
  const [selectedRecognitions, setSelectedRecognitions] = useState<Set<string>>(new Set())
  const [selectedLearningPaths, setSelectedLearningPaths] = useState<Set<string>>(new Set())
  const [selectedCareerPaths, setSelectedCareerPaths] = useState<Set<string>>(new Set())
  const [mentorshipForm, setMentorshipForm] = useState({
    mentor_id: "",
    mentee_id: "",
    focus: "",
    match_score: 85,
    start_date: getTodayDateKey(),
    status: "active" as "active" | "completed" | "cancelled",
  })
  const [recognitionForm, setRecognitionForm] = useState({
    from_id: "",
    to_id: "",
    type: "peer" as "peer" | "manager",
    category: "",
    message: "",
    recognition_date: getTodayDateKey(),
  })
  const [isSubmittingMentorship, setIsSubmittingMentorship] = useState(false)
  const [isSubmittingRecognition, setIsSubmittingRecognition] = useState(false)
  
  // Quick Actions state
  const [isScheduleInterviewOpen, setIsScheduleInterviewOpen] = useState(false)
  const [isSend360FeedbackOpen, setIsSend360FeedbackOpen] = useState(false)
  const [isApproveTimeOffOpen, setIsApproveTimeOffOpen] = useState(false)
  const [isAssignTrainingOpen, setIsAssignTrainingOpen] = useState(false)
  const [isManageCoursesOpen, setIsManageCoursesOpen] = useState(false)

  // Time off (Approve Time Off dialog) state
  const [pendingTimeOff, setPendingTimeOff] = useState<TimeOffRequest[]>([])
  const [timeOffLoading, setTimeOffLoading] = useState(false)
  const [timeOffNotes, setTimeOffNotes] = useState<Record<string, string>>({})
  const [timeOffWorkingId, setTimeOffWorkingId] = useState<string | null>(null)

  // Schedule Interview opt-in side effects (default OFF so the user is not surprised)
  const [interviewDownloadIcs, setInterviewDownloadIcs] = useState(false)
  const [interviewEmailCandidate, setInterviewEmailCandidate] = useState(false)
  
  // Employee selection and deletion state
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([])
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [bulkDeleteTarget, setBulkDeleteTarget] = useState<
    'reviews' | 'goals' | 'mentorships' | 'recognitions' | 'learningPaths' | 'careerPaths' | null
  >(null)

  // Invite code for selected employee (HR "Generate invite code")
  const [employeeInviteCode, setEmployeeInviteCode] = useState<{ email: string; code: string; inviteLink: string } | null>(null)
  const [inviteCodeLoading, setInviteCodeLoading] = useState(false)
  const [inviteCodeCopied, setInviteCodeCopied] = useState(false)

  // Module access editing in employee dialog (synced from selectedEmployee when dialog opens)
  const [editableModuleAccess, setEditableModuleAccess] = useState<string[]>([])
  const [moduleAccessSaving, setModuleAccessSaving] = useState(false)

  useEffect(() => {
    if (isProfileDialogOpen && selectedEmployee) {
      const list = selectedEmployee.module_access
      setEditableModuleAccess(Array.isArray(list) ? [...list] : [])
    }
  }, [isProfileDialogOpen, selectedEmployee?.id])

  // Interview scheduling state
  const [interviewCandidate, setInterviewCandidate] = useState<string>('')
  const [interviewDate, setInterviewDate] = useState<string>('')
  const [interviewTime, setInterviewTime] = useState<string>('')
  const [interviewType, setInterviewType] = useState<string>('')
  const [interviewNotes, setInterviewNotes] = useState<string>('')
  // When set, the schedule-interview dialog is in "edit existing" mode for
  // the application with this id (chip-click from the calendar).
  const [interviewEditingId, setInterviewEditingId] = useState<string | null>(null)
  
  // Candidate details state
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)
  const [isCandidateDetailsOpen, setIsCandidateDetailsOpen] = useState(false)

  // Load all data from Supabase
  useEffect(() => {
    loadData()
    
    // Listen for employee added events
    const handleEmployeeAdded = () => {
      loadData()
    }
    
    const handleApplicationUpdated = async () => {
      // Refresh recruitment data when applications change
      const recruitmentApps = await getAllApplications()
      setApplications(recruitmentApps)
      
      // Calculate application stats
      const recruitmentStats = {
        total: recruitmentApps.length,
        new: recruitmentApps.filter(app => app.status === 'new').length,
        reviewing: recruitmentApps.filter(app => app.status === 'reviewing').length,
        interviewed: recruitmentApps.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
        offers: recruitmentApps.filter(app => app.status === 'offer').length,
      }
      setApplicationStats(recruitmentStats)
    }
    
    window.addEventListener('employeeAdded', handleEmployeeAdded)
    window.addEventListener('applicationSubmitted', handleApplicationUpdated)
    window.addEventListener('applicationUpdated', handleApplicationUpdated)
    
    return () => {
      window.removeEventListener('employeeAdded', handleEmployeeAdded)
      window.removeEventListener('applicationSubmitted', handleApplicationUpdated)
      window.removeEventListener('applicationUpdated', handleApplicationUpdated)
    }
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && isHrMainTabVisible(tab, canManageHrAdmin)) {
      setActiveTab(tab)
    }
  }, [searchParams, canManageHrAdmin])

  useEffect(() => {
    if (!isHrMainTabVisible(activeTab, canManageHrAdmin)) {
      setActiveTab(visibleHrTabs[0] ?? 'dashboard')
    }
  }, [activeTab, canManageHrAdmin, visibleHrTabs])

  // Reload pending time-off requests whenever the Approve dialog opens
  useEffect(() => {
    if (!isApproveTimeOffOpen) return
    let cancelled = false
    const load = async () => {
      setTimeOffLoading(true)
      try {
        const rows = await hrApi.getPendingTimeOffRequests()
        if (!cancelled) {
          setPendingTimeOff(rows)
          setTimeOffNotes({})
        }
      } finally {
        if (!cancelled) setTimeOffLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [isApproveTimeOffOpen])

  const loadData = async () => {
    try {
      setIsLoading(true)
      
      // Fetch all data in parallel
      const [
        employeesData,
        reviewsData,
        goalsData,
        feedback360Data,
        mentorshipsData,
        recognitionsData,
        learningPathsData,
        careerPathsData,
        statsData,
        csmUsersData,
        trainingCoursesData,
        loggedActivitiesData,
      ] = await Promise.all([
        hrApi.getAllEmployees(),
        hrApi.getAllPerformanceReviews(),
        hrApi.getAllGoals(),
        hrApi.getAll360Feedback(),
        hrApi.getAllMentorships(),
        hrApi.getAllRecognitions(),
        hrApi.getAllLearningPaths(),
        hrApi.getAllCareerPaths(),
        hrApi.getHRStats(),
        getAllCSMUsers(),
        hrApi.getTrainingCourses(false),
        hrApi.getRecentActivities(50),
      ])

      setEmployees(employeesData)
      setPerformanceReviews(reviewsData)
      setGoals(goalsData)
      setFeedback360(feedback360Data)
      setMentorships(mentorshipsData)
      setRecognitions(recognitionsData)
      setLearningPaths(learningPathsData)
      setTrainingCourses(trainingCoursesData)
      setCareerPaths(careerPathsData)
      setStats(statsData)
      setCSMUsers(csmUsersData)
      
      // Load recruitment data from database
      const recruitmentApps = await getAllApplications()
      setApplications(recruitmentApps)
      
      // Load open positions (only count active ones)
      const jobPostings = await getAllJobs()
      // Handle TRUE as string from database
      const activeJobsCount = jobPostings.filter(j => 
        j.is_active === true || j.is_active === 'TRUE' || j.is_active === 'true'
      ).length
      setOpenPositions(activeJobsCount)
      
      // Calculate application stats
      const recruitmentStats = {
        total: recruitmentApps.length,
        new: recruitmentApps.filter(app => app.status === 'new').length,
        reviewing: recruitmentApps.filter(app => app.status === 'reviewing').length,
        interviewed: recruitmentApps.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
        offers: recruitmentApps.filter(app => app.status === 'offer').length,
      }
      setApplicationStats(recruitmentStats)

      const synthesized = buildHrDashboardActivities({
        employees: employeesData,
        reviews: reviewsData,
        goals: goalsData,
        applications: recruitmentApps,
        recognitions: recognitionsData,
        learningPaths: learningPathsData,
        mentorships: mentorshipsData,
      })
      setRecentActivities(mergeHrDashboardActivities(loggedActivitiesData, synthesized, 100))
    } catch (error) {
      console.error('Error loading HR data:', error)
      sonnerToast.error("Couldn't load HR data. Please try refreshing.")
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate days until/since review
  const getDaysUntilReview = (reviewDate: string | null | undefined) => {
    if (!reviewDate) return "Not scheduled"
    const today = new Date()
    const review = new Date(reviewDate)
    const diffTime = review.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `In ${diffDays} days`
    } else if (diffDays === 0) {
      return "Today"
    } else {
      return `${Math.abs(diffDays)} days overdue`
    }
  }

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active":
        return "default"
      case "Inactive":
        return "outline"
      default:
        return "default"
    }
  }

  // Get stage badge variant
  const getStageVariant = (stage: string) => {
    switch (stage) {
      case "Applied":
        return "secondary"
      case "Reviewed":
        return "default"
      case "Interviewed":
        return "outline"
      case "Offered":
        return "default"
      default:
        return "secondary"
    }
  }

  // Get stage color
  const getStageColor = (stage: string) => {
    switch (stage) {
      case "Applied":
        return "text-blue-500"
      case "Reviewed":
        return "text-yellow-500"
      case "Interviewed":
        return "text-orange-500"
      case "Offered":
        return "text-green-500"
      default:
        return "text-gray-500"
    }
  }

  // Filter employees based on search (members only see their own HR record)
  const filteredEmployees = useMemo(() => {
    const roster = scopeHrToSelf && loggedInEmployeeId
      ? employees.filter((e) => e.id === loggedInEmployeeId)
      : employees
    const q = searchQuery.toLowerCase()
    return roster.filter(
      (emp) =>
        emp.name.toLowerCase().includes(q) ||
        emp.position.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q)
    )
  }, [employees, scopeHrToSelf, loggedInEmployeeId, searchQuery])

  // Handler for selecting/deselecting individual employees
  const handleToggleEmployee = (employeeId: string) => {
    setSelectedEmployees((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId]
    )
  }

  // Handler for select all/deselect all
  const handleToggleAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([])
    } else {
      setSelectedEmployees(filteredEmployees.map((emp) => emp.id))
    }
  }

  // Handler for deleting selected employees
  // Delete handlers for different tabs
  const handleDeleteSelectedReviews = async () => {
    try {
      for (const reviewId of selectedReviews) {
        await hrApi.deletePerformanceReview(reviewId)
      }
      setSelectedReviews(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedReviews.size} review(s)`,
      })
    } catch (error) {
      console.error('Error deleting reviews:', error)
      toast({
        title: "Error",
        description: "Failed to delete reviews",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedGoals = async () => {
    try {
      for (const goalId of selectedGoals) {
        await hrApi.deleteGoal(goalId)
      }
      setSelectedGoals(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedGoals.size} goal(s)`,
      })
    } catch (error) {
      console.error('Error deleting goals:', error)
      toast({
        title: "Error",
        description: "Failed to delete goals",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedMentorships = async () => {
    try {
      for (const mentorshipId of selectedMentorships) {
        await hrApi.deleteMentorship(mentorshipId)
      }
      setSelectedMentorships(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedMentorships.size} mentorship(s)`,
      })
    } catch (error) {
      console.error('Error deleting mentorships:', error)
      toast({
        title: "Error",
        description: "Failed to delete mentorships",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedRecognitions = async () => {
    try {
      for (const recognitionId of selectedRecognitions) {
        await hrApi.deleteRecognition(recognitionId)
      }
      setSelectedRecognitions(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedRecognitions.size} recognition(s)`,
      })
    } catch (error) {
      console.error('Error deleting recognitions:', error)
      toast({
        title: "Error",
        description: "Failed to delete recognitions",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedLearningPaths = async () => {
    try {
      for (const learningPathId of selectedLearningPaths) {
        await hrApi.deleteLearningPath(learningPathId)
      }
      setSelectedLearningPaths(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedLearningPaths.size} learning path(s)`,
      })
    } catch (error) {
      console.error('Error deleting learning paths:', error)
      toast({
        title: "Error",
        description: "Failed to delete learning paths",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelectedCareerPaths = async () => {
    try {
      for (const careerPathId of selectedCareerPaths) {
        await hrApi.deleteCareerPath(careerPathId)
      }
      setSelectedCareerPaths(new Set())
      await loadData()
      toast({
        title: "Success",
        description: `Deleted ${selectedCareerPaths.size} career path(s)`,
      })
    } catch (error) {
      console.error('Error deleting career paths:', error)
      toast({
        title: "Error",
        description: "Failed to delete career paths",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSelected = async () => {
    try {
      // Delete employees from database
      for (const employeeId of selectedEmployees) {
        await hrApi.deleteEmployee(employeeId)
      }
      // Refresh data
      await loadData()
      setSelectedEmployees([])
      setShowDeleteDialog(false)
    } catch (error) {
      console.error('Error deleting employees:', error)
      alert('Failed to delete employees. Please try again.')
    }
  }

  // Helper function to calculate overall rating
  const calculateOverallRating = (review: PerformanceReview) => {
    return ((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4).toFixed(1)
  }

  // Helper function to get rating color
  const getRatingColor = (rating: number) => {
    if (rating >= 4) return "text-green-500"
    if (rating >= 3) return "text-yellow-500"
    return "text-red-500"
  }

  // Helper function to get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "up":
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case "down":
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-500" />
    }
  }

  // Helper function to get review status badge
  const getReviewStatusBadge = (status: string) => {
    switch (status) {
      case "on-time":
        return <Badge variant="default">On Time</Badge>
      case "overdue":
        return <Badge variant="destructive">Overdue</Badge>
      case "upcoming":
        return <Badge variant="secondary">Upcoming</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  // Helper function to get date threshold based on analytics date range
  const getDateThreshold = () => {
    if (analyticsDateRange === "all") return null
    const days = parseInt(analyticsDateRange)
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - days)
    return threshold
  }

  // Filter data based on analytics date range
  const getFilteredReviews = () => {
    const threshold = getDateThreshold()
    if (!threshold) return effectivePerformanceReviews
    return effectivePerformanceReviews.filter(review => {
      const reviewDate = new Date(review.review_date)
      return reviewDate >= threshold
    })
  }

  const getFilteredGoals = () => {
    const threshold = getDateThreshold()
    if (!threshold) return effectiveGoals
    return effectiveGoals.filter(goal => {
      const createdDate = new Date(goal.created_date)
      return createdDate >= threshold
    })
  }

  const getFilteredApplications = () => {
    const threshold = getDateThreshold()
    if (!threshold) return applications
    return applications.filter(app => {
      const createdDate = app.created_at ? new Date(app.created_at) : new Date(app.applied_date || 0)
      return createdDate >= threshold
    })
  }

  // Pipeline view: filter by stage + job + department
  const getPipelineFilteredApplications = () => {
    return applications.filter(app => {
      const stageMatch = candidateStageFilter === "All" ||
        (candidateStageFilter === "Applied" && app.status === 'new') ||
        (candidateStageFilter === "Reviewed" && app.status === 'reviewing') ||
        (candidateStageFilter === "Interviewed" && (app.status === 'interviewed' || app.status === 'interview-scheduled')) ||
        (candidateStageFilter === "Offered" && app.status === 'offer')
      const jobMatch = pipelineJobFilter === "all" || (app.jobTitle && app.jobTitle === pipelineJobFilter)
      const deptMatch = pipelineDepartmentFilter === "all" || (app.department && app.department === pipelineDepartmentFilter)
      return stageMatch && jobMatch && deptMatch
    })
  }

  const handleExportPipelineCsv = () => {
    const rows = getPipelineFilteredApplications()
    const headers = ['Anonymous ID', 'Status', 'Job Title', 'Department', 'Applied Date', 'Rating']
    const csvData = [
      headers.join(','),
      ...rows.map(app => [
        `"${(app.anonymousId || app.id || '').toString().replace(/"/g, '""')}"`,
        `"${(app.status || '').replace(/"/g, '""')}"`,
        `"${(app.jobTitle || '').replace(/"/g, '""')}"`,
        `"${(app.department || '').replace(/"/g, '""')}"`,
        app.appliedDate ? formatDateOnly(app.appliedDate) : '',
        app.rating != null ? app.rating : ''
      ].join(','))
    ].join('\n')
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `recruitment-pipeline-${getTodayDateKey()}.csv`
    link.click()
    URL.revokeObjectURL(link.href)
    toast({ title: 'Exported', description: `${rows.length} candidate(s) exported to CSV.` })
  }

  const getFilteredEmployees = () => {
    const threshold = getDateThreshold()
    if (!threshold) return employees
    // Filter by hire_date for new hires in the period
    return employees.filter(emp => {
      const hireDate = new Date(emp.hire_date)
      return hireDate >= threshold
    })
  }

  // Memoized analytics data (avoids recalculating in every Analytics card)
  const analyticsFiltered = useMemo(() => {
    const threshold = getDateThreshold()
    const filteredReviews = !threshold
      ? performanceReviews
      : performanceReviews.filter(r => new Date(r.review_date) >= threshold)
    const filteredGoals = !threshold
      ? goals
      : goals.filter(g => new Date(g.created_date) >= threshold)
    const filteredApplications = !threshold
      ? applications
      : applications.filter(app => {
          const d = app.created_at ? new Date(app.created_at) : new Date(app.applied_date || 0)
          return d >= threshold
        })
    const filteredEmployees = !threshold
      ? employees
      : employees.filter(emp => new Date(emp.hire_date) >= threshold)
    return {
      filteredReviews,
      filteredGoals,
      filteredApplications,
      filteredEmployees,
      employeesToUse: analyticsDateRange === "all" ? employees : filteredEmployees,
    }
  }, [analyticsDateRange, performanceReviews, goals, applications, employees])

  // Handler for creating mentorship match
  const handleCreateMentorship = async () => {
    if (!mentorshipForm.mentor_id || !mentorshipForm.mentee_id) {
      toast({
        title: "Error",
        description: "Please select both mentor and mentee",
        variant: "destructive",
      })
      return
    }

    if (!mentorshipForm.focus) {
      toast({
        title: "Error",
        description: "Please select a focus area",
        variant: "destructive",
      })
      return
    }

    if (mentorshipForm.mentor_id === mentorshipForm.mentee_id) {
      toast({
        title: "Error",
        description: "Mentor and mentee cannot be the same person",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingMentorship(true)

    try {
      const result = await hrApi.createMentorship({
        mentor_id: mentorshipForm.mentor_id,
        mentee_id: mentorshipForm.mentee_id,
        focus: mentorshipForm.focus,
        match_score: mentorshipForm.match_score,
        start_date: mentorshipForm.start_date,
        status: mentorshipForm.status,
      })

      if (result) {
        toast({
          title: "Success",
          description: "Mentorship match created successfully!",
        })
        setIsCreateMatchOpen(false)
        // Reset form
        setMentorshipForm({
          mentor_id: "",
          mentee_id: "",
          focus: "",
          match_score: 85,
          start_date: getTodayDateKey(),
          status: "active",
        })
        // Refresh data
        await loadData()
      } else {
        toast({
          title: "Error",
          description: "Failed to create mentorship match",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating mentorship:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      setIsSubmittingMentorship(false)
    }
  }

  // Handler for creating recognition
  const handleCreateRecognition = async () => {
    if (!recognitionForm.from_id || !recognitionForm.to_id) {
      toast({
        title: "Error",
        description: "Please select both sender and recipient",
        variant: "destructive",
      })
      return
    }

    if (!recognitionForm.category || !recognitionForm.message) {
      toast({
        title: "Error",
        description: "Please fill in category and message",
        variant: "destructive",
      })
      return
    }

    // Get names from employees/users
    const fromEmployee = employees.find(e => e.id === recognitionForm.from_id)
    const toEmployee = employees.find(e => e.id === recognitionForm.to_id)
    const fromName = fromEmployee?.name || csmUsers.find(u => u.id === recognitionForm.from_id)?.name || "Unknown"
    const toName = toEmployee?.name || "Unknown"

    if (!toEmployee) {
      toast({
        title: "Error",
        description: "Recipient not found",
        variant: "destructive",
      })
      return
    }

    if (recognitionForm.from_id === recognitionForm.to_id) {
      toast({
        title: "Not allowed",
        description: "You cannot give recognition to yourself.",
        variant: "destructive",
      })
      return
    }

    if (isLoggedInUsersEmployee(toEmployee)) {
      toast({
        title: "Not allowed",
        description: "You cannot give recognition to yourself.",
        variant: "destructive",
      })
      return
    }

    setIsSubmittingRecognition(true)

    try {
      const result = await hrApi.createRecognition({
        from_id: recognitionForm.from_id || null,
        from_name: fromName,
        to_id: recognitionForm.to_id,
        to_name: toName,
        type: recognitionForm.type === "peer" ? "Peer Recognition" : "Manager Recognition",
        category: recognitionForm.category,
        message: recognitionForm.message,
        recognition_date: recognitionForm.recognition_date,
      })

      if (result) {
        toast({
          title: "Success",
          description: "Recognition sent successfully!",
        })
        setIsGiveRecognitionOpen(false)
        // Reset form
        setRecognitionForm({
          from_id: "",
          to_id: "",
          type: "peer",
          category: "",
          message: "",
          recognition_date: getTodayDateKey(),
        })
        // Refresh data
        await loadData()
      } else {
        toast({
          title: "Error",
          description: "Failed to send recognition",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error creating recognition:", error)
      const msg = error instanceof Error ? error.message : "An unexpected error occurred"
      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      })
    } finally {
      setIsSubmittingRecognition(false)
    }
  }

  // Helper function to get goal status color
  const getGoalStatusColor = (status: string) => {
    switch (status) {
      case "On Track":
        return "bg-green-500/10 text-green-600 border-green-500/20"
      case "Behind":
        return "bg-red-500/10 text-red-600 border-red-500/20"
      case "Complete":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20"
      default:
        return "bg-gray-500/10 text-gray-600 border-gray-500/20"
    }
  }

  // Helper function to get goal status icon
  const getGoalStatusIcon = (status: string) => {
    switch (status) {
      case "On Track":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "Behind":
        return <AlertCircle className="h-4 w-4 text-red-500" />
      case "Complete":
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />
      default:
        return null
    }
  }

  // Helper function to calculate days until due date
  const getDaysUntilDue = (dueDate: string) => {
    const today = new Date()
    const due = new Date(dueDate)
    const diffTime = due.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays > 0) {
      return `${diffDays} days left`
    } else if (diffDays === 0) {
      return "Due today"
    } else {
      return `${Math.abs(diffDays)} days overdue`
    }
  }

  // Goal statistics (scoped to self for non-admin HR users)
  const scopedGoalStats = useMemo(
    () => ({
      total: effectiveGoals.length,
      onTrack: effectiveGoals.filter((g) => g.status === 'On Track').length,
      behind: effectiveGoals.filter((g) => g.status === 'Behind').length,
      complete: effectiveGoals.filter((g) => g.status === 'Complete').length,
    }),
    [effectiveGoals]
  )
  const totalGoals = scopeHrToSelf ? scopedGoalStats.total : stats.totalGoals
  const onTrackGoals = scopeHrToSelf ? scopedGoalStats.onTrack : stats.onTrackGoals
  const behindGoals = scopeHrToSelf ? scopedGoalStats.behind : stats.behindGoals
  const completeGoals = scopeHrToSelf ? scopedGoalStats.complete : stats.completeGoals

  return (
    <MotionPage subtle className="min-h-screen bg-background p-6 min-w-0 overflow-x-hidden">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 -mx-6 px-6 mb-6" data-tour="hr-header">
        <div className="py-6">
          <div className="flex items-center justify-between">
            <div>
              {/* Breadcrumb */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <span className="hover:text-foreground cursor-pointer transition-colors">Home</span>
                <ChevronRight className="h-4 w-4" />
                <span className="text-foreground">Katana HR</span>
              </div>
              
              {/* Title with Icon */}
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-lg">
                  <UserCog className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-3xl font-bold">Katana HR</h1>
                <ModuleHelpButton moduleId="hr" />
              </div>
              
              <p className="text-muted-foreground mt-2">
                {canManageHrAdmin
                  ? 'Human capital management'
                  : 'Your HR information — performance, goals, and development'}
              </p>
            </div>
            <ModuleCustomizeControls
              customizeMode={isCustomizeMode}
              onEnterCustomize={enterCustomize}
              onDone={() => void saveAndExit()}
              dataTourCustomize="hr-customize"
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="min-w-0 border-none border-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
          <TabsList fluid className="mb-6" data-tour="hr-tabs">
            {visibleHrTabs.map((tabId) => (
              <TabsTrigger
                key={tabId}
                value={tabId}
                data-tour={
                  tabId === 'recruitment'
                    ? 'hr-recruitment'
                    : tabId === 'job-listings'
                      ? 'hr-job-listings'
                      : tabId === 'employees'
                        ? 'hr-tab-employees'
                        : tabId === 'performance'
                          ? 'hr-tab-performance'
                          : tabId === 'goals'
                            ? 'hr-tab-goals'
                          : tabId === 'development'
                            ? 'hr-tab-learning'
                              : undefined
                }
              >
                {tabId === 'employees'
                  ? getHrEmployeesTabLabel(canManageHrAdmin)
                  : HR_TAB_LABELS[tabId as HrMainTabId]}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="dashboard">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId === 'stats_quick_links') {
                  return (
                    <Card className="h-full overflow-auto" data-tour="hr-dashboard-stats">
                      <CardContent className="pt-6">
                        <div className="grid min-w-0 grid-cols-1 gap-4 border-b pb-6 md:grid-cols-2 lg:grid-cols-4">
                          <div className="flex min-w-0 items-center gap-4">
                            <Users className="h-8 w-8 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">Active Employees</p>
                              <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                              <p className="text-xs text-muted-foreground">Total active staff</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-4">
                            <AlertTriangle className="h-8 w-8 shrink-0 text-yellow-500" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">Retention Risk</p>
                              <p className="text-2xl font-bold text-yellow-500">{stats.overdueReviews}</p>
                              <p className="text-xs text-muted-foreground">Reviews overdue</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-4">
                            <Star className="h-8 w-8 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">Avg Performance</p>
                              <p className="text-2xl font-bold">{stats.avgPerformanceScore.toFixed(2)}/5</p>
                              <p className="text-xs text-muted-foreground">Across {stats.totalEmployees} employees</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-center gap-4">
                            <Briefcase className="h-8 w-8 shrink-0 text-muted-foreground" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-muted-foreground">Open Positions</p>
                              <p className="text-2xl font-bold">{openPositions}</p>
                              <p className="text-xs text-muted-foreground">
                                {applicationStats.total > 0 ? `${applicationStats.total} applications` : 'Actively hiring'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="pt-6 min-w-0" data-tour="hr-quick-links">
                          <p className="text-sm font-semibold mb-2">Quick links</p>
                          <p className="text-xs text-muted-foreground mb-4">Shortcuts to common HR dialogs (same actions are available from the Recruitment tab)</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-2 min-w-0">
                            <Button className="w-full min-w-0 justify-start bg-transparent overflow-hidden" variant="outline" onClick={() => setIsScheduleInterviewOpen(true)}>
                              <UserPlus className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Schedule Interview</span>
                            </Button>
                            <Button className="w-full min-w-0 justify-start bg-transparent overflow-hidden" variant="outline" onClick={() => setIsSend360FeedbackOpen(true)}>
                              <MessageSquare className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Send 360° Feedback</span>
                            </Button>
                            <Button className="w-full min-w-0 justify-start bg-transparent overflow-hidden" variant="outline" onClick={() => setIsGiveRecognitionOpen(true)}>
                              <Award className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Give Recognition</span>
                            </Button>
                            <Button className="w-full min-w-0 justify-start bg-transparent overflow-hidden" variant="outline" onClick={() => setIsApproveTimeOffOpen(true)}>
                              <FileCheck className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Approve Time Off</span>
                            </Button>
                            <Button className="w-full min-w-0 justify-start bg-transparent overflow-hidden" variant="outline" onClick={() => setIsAssignTrainingOpen(true)}>
                              <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                              <span className="truncate">Assign Training</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }

                if (widgetId === 'directory') {
                  return (
                    <Card className="h-full overflow-auto" data-tour="hr-directory">
                      <CardHeader>
                        <div className="fluid-toolbar">
                          <CardTitle>Employee Directory</CardTitle>
                          <div className="relative w-full sm:max-w-xs">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search employees..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-8"
                            />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {filteredEmployees.map((employee) => (
                            <div
                              key={employee.id}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                setSelectedEmployee(employee)
                                setIsProfileDialogOpen(true)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault()
                                  setSelectedEmployee(employee)
                                  setIsProfileDialogOpen(true)
                                }
                              }}
                              className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="font-semibold">{employee.name}</h3>
                                  <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {employee.position} • {employee.department}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  <Calendar className="inline h-3 w-3 mr-1" />
                                  Next Review: {getDaysUntilReview(employee.next_review_date)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )
                }

                if (widgetId === 'training_assignments') {
                  return (
                    <Card className="h-full overflow-auto">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-base">Training assignments</CardTitle>
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setActiveTab("development")}>
                            View all
                          </Button>
                        </div>
                        <CardDescription>
                          {learningPaths.filter((l) => l.status !== "completed").length} active · {trainingCourses.length} courses in catalog
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                      {effectiveLearningPaths.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground mb-3">No training assigned yet</p>
                          <Button size="sm" variant="outline" onClick={() => setIsAssignTrainingOpen(true)}>
                              <BookOpen className="mr-2 h-4 w-4" />
                              Assign Training
                            </Button>
                          </div>
                        ) : (
                          <>
                            {learningPaths.slice(0, 5).map((lp) => (
                              <div key={lp.id} className="flex items-start justify-between gap-2 p-2 rounded-md border text-sm">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">{lp.course}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {lp.employee?.name ?? "Employee"} · Due{" "}
                                    {lp.due_date ? formatDateOnly(lp.due_date) : "—"}
                                  </p>
                                </div>
                                <Badge
                                  variant={lp.priority === "high" ? "destructive" : lp.priority === "low" ? "outline" : "secondary"}
                                  className="shrink-0 text-xs capitalize"
                                >
                                  {lp.priority ?? "medium"}
                                </Badge>
                              </div>
                            ))}
                            <Button size="sm" className="w-full mt-2" variant="outline" onClick={() => setIsAssignTrainingOpen(true)}>
                              Assign more
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  )
                }

                if (widgetId === 'recent_activity') {
                  return <HrRecentActivityCard activities={recentActivities} isLoading={isLoading} />
                }

                if (widgetId === 'my_overview') {
                  return (
                    <Card className="h-full overflow-auto">
                      <CardHeader>
                        <CardTitle>My HR overview</CardTitle>
                        <CardDescription>
                          View your performance, goals, and development. Organization-wide HR administration is only available to owners and admins.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="rounded-lg border p-4">
                            <p className="text-sm text-muted-foreground">My goals</p>
                            <p className="text-2xl font-bold">{totalGoals}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-sm text-muted-foreground">On track</p>
                            <p className="text-2xl font-bold text-green-600">{onTrackGoals}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-sm text-muted-foreground">Reviews</p>
                            <p className="text-2xl font-bold">{effectivePerformanceReviews.length}</p>
                          </div>
                          <div className="rounded-lg border p-4">
                            <p className="text-sm text-muted-foreground">Learning paths</p>
                            <p className="text-2xl font-bold">{effectiveLearningPaths.length}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('time-off')}>Time off</Button>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('performance')}>My performance</Button>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('goals')}>My goals</Button>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('development')}>My development</Button>
                          <Button variant="outline" size="sm" onClick={() => setIsGiveRecognitionOpen(true)}>Give recognition</Button>
                          <Button variant="outline" size="sm" onClick={() => setActiveTab('employees')}>My profile</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                }

                return (
                  <Card className="h-full">
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      This widget isn't available in your current dashboard view.
                    </CardContent>
                  </Card>
                )
              }}
            />
          </TabsContent>

          <TabsContent value="time-off">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'time_off') return null
                return loggedInEmployeeId ? (
                  <HrMemberTimeOffTab employeeId={loggedInEmployeeId} />
                ) : (
                  <Card className="h-full">
                    <CardContent className="py-10 text-center text-muted-foreground text-sm">
                      Link your account to an HR employee record (matching email) to request time off.
                    </CardContent>
                  </Card>
                )
              }}
            />
          </TabsContent>

          {canManageHrAdmin && (
          <TabsContent value="recruitment">
            {/* Sub-tabs for different recruitment views */}
            <Tabs
              value={recruitmentSection}
              onValueChange={(v) => setRecruitmentSection(v as HrRecruitmentSection)}
              className="space-y-6"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold mb-1">Recruitment Management</h2>
                  <p className="text-sm text-muted-foreground">
                    Candidate pipeline and job applications — manage listings under Job Listings
                  </p>
                </div>
              </div>

              <TabsList>
                <TabsTrigger value="pipeline">Candidate Pipeline</TabsTrigger>
                <TabsTrigger value="applications">Job Applications</TabsTrigger>
                <TabsTrigger value="talent-pool">Talent Pool</TabsTrigger>
              </TabsList>

              {customizeChrome}

              {/* Original Recruitment Pipeline */}
              <TabsContent value="pipeline">
                <ModuleWidgetCanvas
                  widgets={tabLayout.widgets}
                  catalog={tabLayout.catalog}
                  customizeMode={tabLayout.customizeMode}
                  onLayoutChange={tabLayout.onLayoutChange}
                  onRemoveWidget={tabLayout.onRemoveWidget}
                  rowHeight={36}
                  renderWidget={(widgetId) => {
                    if (widgetId !== 'pipeline') return null
                    return (
                      <div className="h-full overflow-auto">
                        {/* Quick Action Bar */}
                        <div className="mb-6 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                          <div>
                            <h3 className="text-xl font-bold mb-1">Recruitment Pipeline</h3>
                            <p className="text-sm text-muted-foreground">
                              Anonymous, bias-free hiring with Katana-powered matching
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm">
                              <Filter className="mr-2 h-4 w-4" />
                              Filter
                            </Button>
                            <Button variant="outline" size="sm">
                              <Download className="mr-2 h-4 w-4" />
                              Export
                            </Button>
                            <AddCandidateDialog />
                          </div>
                        </div>

                        {/* Anonymous Info Badge - Compact */}
                        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                          <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                          <p className="text-sm text-blue-700 dark:text-blue-300">
                            <strong>Anonymous Mode:</strong> All candidates identified by ID only. No personal information displayed.
                          </p>
                        </div>

                        <Card className="mb-6">
                          <CardContent className="pt-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-6 border-b">
                              <div className="flex items-center gap-4">
                                <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                                  <p className="text-2xl font-bold">{applicationStats.total}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {applicationStats.new > 0 && (
                                      <>
                                        <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
                                        {applicationStats.new} new
                                      </>
                                    )}
                                    {applicationStats.new === 0 && 'No new applications'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <Calendar className="h-8 w-8 text-muted-foreground shrink-0" />
                                <div>
                                  <p className="text-sm font-medium text-muted-foreground">Interviews Scheduled</p>
                                  <p className="text-2xl font-bold">{applicationStats.interviewed}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {applicationStats.interviewed > 0 ? 'Candidates interviewed' : 'No interviews yet'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="pt-6">
                              <div className="mb-4">
                                <h3 className="text-lg font-semibold">All Candidates by Stage</h3>
                                <p className="text-sm text-muted-foreground">View and manage candidates at each hiring stage</p>
                              </div>
                            {/* Stage Tabs/Filters */}
                            <div className="flex gap-2 mb-6 flex-wrap">
                              <Button 
                                variant={candidateStageFilter === "All" ? "default" : "outline"} 
                                size="sm" 
                                className="flex items-center gap-2"
                                onClick={() => setCandidateStageFilter("All")}
                              >
                                All Candidates
                                <Badge variant="secondary" className="ml-1">{applicationStats.total}</Badge>
                              </Button>
                              <Button 
                                variant={candidateStageFilter === "Applied" ? "default" : "outline"} 
                                size="sm" 
                                className="flex items-center gap-2"
                                onClick={() => setCandidateStageFilter("Applied")}
                              >
                                Applied
                                <Badge variant="secondary" className="ml-1">{applicationStats.new}</Badge>
                              </Button>
                              <Button 
                                variant={candidateStageFilter === "Reviewed" ? "default" : "outline"} 
                                size="sm" 
                                className="flex items-center gap-2"
                                onClick={() => setCandidateStageFilter("Reviewed")}
                              >
                                Reviewed
                                <Badge variant="secondary" className="ml-1">{applicationStats.reviewing}</Badge>
                              </Button>
                              <Button 
                                variant={candidateStageFilter === "Interviewed" ? "default" : "outline"} 
                                size="sm" 
                                className="flex items-center gap-2"
                                onClick={() => setCandidateStageFilter("Interviewed")}
                              >
                                Interviewed
                                <Badge variant="secondary" className="ml-1">{applicationStats.interviewed}</Badge>
                              </Button>
                              <Button 
                                variant={candidateStageFilter === "Offered" ? "default" : "outline"} 
                                size="sm" 
                                className="flex items-center gap-2"
                                onClick={() => setCandidateStageFilter("Offered")}
                              >
                                Offered
                                <Badge variant="secondary" className="ml-1">{applicationStats.offers}</Badge>
                              </Button>
                            </div>

                            {/* Candidate List */}
                            <div className="space-y-3">
                              {getPipelineFilteredApplications().length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                  <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                                  <p className="text-lg font-medium mb-1">No candidates in this stage</p>
                                  <p className="text-sm">
                                    {applications.length === 0 
                                      ? 'Candidates will appear here once applications are received'
                                      : 'Try selecting a different stage or filter'}
                                  </p>
                                </div>
                              ) : (
                                getPipelineFilteredApplications()
                                  .map((app) => (
                                    <div key={app.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                                      <div className="flex items-start justify-between mb-3">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-2">
                                            <h3 className="font-semibold">
                                              {app.isRevealed
                                                ? `${app.firstName} ${app.lastName}`.trim() || app.anonymousId
                                                : app.anonymousId}
                                            </h3>
                                            <Badge variant={
                                              app.status === 'new' ? 'secondary' :
                                              app.status === 'reviewing' ? 'default' :
                                              app.status === 'interviewed' ? 'outline' :
                                              app.status === 'offer' ? 'default' :
                                              'secondary'
                                            }>
                                              {app.status.replace('-', ' ')}
                                            </Badge>
                                            {app.rating && (
                                              <div className="flex items-center gap-1">
                                                {Array.from({ length: app.rating }).map((_, i) => (
                                                  <Star key={i} className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                          <p className="text-sm text-muted-foreground">
                                            {app.jobTitle} • {app.department}
                                          </p>
                                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                            <span>
                                              <Calendar className="inline h-3 w-3 mr-1" />
                                              Applied: {formatDateOnly(app.appliedDate)}
                                            </span>
                                            {app.isRevealed && (
                                              <Badge variant="outline" className="text-xs">
                                                <Eye className="w-3 h-3 mr-1" />
                                                Revealed
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        <div className="flex gap-2">
                                          <Button 
                                            variant="outline" 
                                            size="sm"
                                            onClick={() => {
                                              setSelectedCandidate(app)
                                              setIsCandidateDetailsOpen(true)
                                            }}
                                          >
                                            View Details
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  ))
                              )}
                            </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    )
                  }}
                />
              </TabsContent>

              {/* New Job Applications System */}
              <TabsContent value="applications">
                <ModuleWidgetCanvas
                  widgets={tabLayout.widgets}
                  catalog={tabLayout.catalog}
                  customizeMode={tabLayout.customizeMode}
                  onLayoutChange={tabLayout.onLayoutChange}
                  onRemoveWidget={tabLayout.onRemoveWidget}
                  rowHeight={36}
                  renderWidget={(widgetId) => {
                    if (widgetId !== 'applications') return null
                    return (
                      <div className="h-full overflow-auto">
                        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                          <Shield className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                          <p className="text-sm text-green-700 dark:text-green-300">
                            <strong>External Applications:</strong> Applications from public careers page. Personal info hidden until revealed.
                          </p>
                        </div>
                        <RecruitmentDashboard />
                      </div>
                    )
                  }}
                />
              </TabsContent>

              <TabsContent value="talent-pool">
                <ModuleWidgetCanvas
                  widgets={tabLayout.widgets}
                  catalog={tabLayout.catalog}
                  customizeMode={tabLayout.customizeMode}
                  onLayoutChange={tabLayout.onLayoutChange}
                  onRemoveWidget={tabLayout.onRemoveWidget}
                  rowHeight={36}
                  renderWidget={(widgetId) => {
                    if (widgetId !== 'talent_pool') return null
                    return (
                      <div className="h-full overflow-auto">
                        <div className="mb-6 flex items-center gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950 border border-violet-200 dark:border-violet-800">
                          <Users className="h-4 w-4 text-violet-600 dark:text-violet-400 flex-shrink-0" />
                          <p className="text-sm text-violet-700 dark:text-violet-300">
                            <strong>Future pipeline:</strong> Interviewed candidates not hired for one role — saved here with contact details and skills for upcoming openings.
                          </p>
                        </div>
                        <TalentPoolPanel />
                      </div>
                    )
                  }}
                />
              </TabsContent>
            </Tabs>
          </TabsContent>
          )}

          {canManageHrAdmin && (
          <TabsContent value="job-listings">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'job_listings') return null
                return <JobListingsPanel onJobsChanged={loadData} />
              }}
            />
          </TabsContent>
          )}

          <TabsContent value="calendar">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'calendar') return null
                return canManageHrAdmin ? (
                  <InterviewCalendar
                    applications={applications}
                    onScheduleNew={(dateISO) => {
                      setInterviewEditingId(null)
                      setInterviewCandidate("")
                      setInterviewDate(dateISO)
                      setInterviewTime("")
                      setInterviewType("")
                      setInterviewNotes("")
                      setInterviewDownloadIcs(false)
                      setInterviewEmailCandidate(false)
                      setIsScheduleInterviewOpen(true)
                    }}
                    onEditInterview={(app) => {
                      if (!app.id) return
                      const parsed = parseStoredInterviewNotes(app.notes ?? "")
                      const dt = app.interviewDate ? new Date(app.interviewDate) : null
                      const dateISO = dt && !Number.isNaN(dt.getTime())
                        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
                        : ""
                      const timeStr = dt && !Number.isNaN(dt.getTime()) && /T\d{2}:\d{2}/.test(app.interviewDate ?? "")
                        ? `${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`
                        : parsed.time
                      setInterviewEditingId(app.id)
                      setInterviewCandidate(app.id)
                      setInterviewDate(dateISO)
                      setInterviewTime(timeStr)
                      setInterviewType(parsed.type)
                      setInterviewNotes(parsed.notes)
                      setInterviewDownloadIcs(false)
                      setInterviewEmailCandidate(false)
                      setIsScheduleInterviewOpen(true)
                    }}
                    onViewCandidate={(app) => {
                      setSelectedCandidate(app)
                    }}
                    onRefresh={async () => {
                      const recruitmentApps = await getAllApplications()
                      setApplications(recruitmentApps)
                    }}
                  />
                ) : (
                  <HrEmployeeCalendar events={memberCalendarEvents} />
                )
              }}
            />
          </TabsContent>

          <TabsContent value="employees">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'employees') return null
                return (
            <div className="h-full overflow-auto">
            <div className="mb-6 flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employees..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                Filters
              </Button>
              {canManageHrAdmin && (
              <div data-tour="hr-add-employee">
                <AddEmployeeDialog />
              </div>
              )}
            </div>

            <Card className="mb-6">
              <CardContent className="pt-6">
                {canManageHrAdmin && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <Users className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Employees</p>
                      <p className="text-2xl font-bold">{stats.totalEmployees}</p>
                      <p className="text-xs text-muted-foreground">Across {new Set(employees.map(e => e.department)).size} departments</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <UserPlus className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Active Staff</p>
                      <p className="text-2xl font-bold">{stats.activeEmployees}</p>
                      <p className="text-xs text-muted-foreground">Currently employed</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Avg Tenure</p>
                      <p className="text-2xl font-bold">
                        {employees.length > 0 
                          ? `${(employees.reduce((acc, emp) => {
                              const years = new Date().getFullYear() - new Date(emp.hire_date).getFullYear();
                              return acc + years;
                            }, 0) / employees.length).toFixed(1)} yrs`
                          : '0 yrs'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">Company average</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Heart className="h-8 w-8 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Engagement</p>
                      <p className="text-2xl font-bold">
                        {employees.length > 0 && stats.avgPerformanceScore > 0 
                          ? `${stats.avgPerformanceScore.toFixed(1)}/5`
                          : 'N/A'
                        }
                      </p>
                      <p className="text-xs text-muted-foreground">Avg performance score</p>
                    </div>
                  </div>
                </div>
                )}
                <div className={canManageHrAdmin ? 'pt-6' : ''}>
                  <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {canManageHrAdmin ? 'Employee Directory' : 'My profile'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {canManageHrAdmin
                            ? 'Comprehensive employee information and management'
                            : 'Your employee record in Katana HR'}
                        </p>
                      </div>
                      {canManageHrAdmin && (
                      <div className="flex items-center gap-4">
                        {filteredEmployees.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={selectedEmployees.length === filteredEmployees.length && filteredEmployees.length > 0}
                              onCheckedChange={handleToggleAll}
                            />
                            <span className="text-sm text-muted-foreground">
                              Select All ({selectedEmployees.length} selected)
                            </span>
                          </div>
                        )}
                        {selectedEmployees.length > 0 && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setShowDeleteDialog(true)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Selected ({selectedEmployees.length})
                          </Button>
                        )}
                      </div>
                      )}
                    </div>
                  </div>
                <div className="space-y-4">
                  {filteredEmployees.map((employee) => (
                    <div
                      key={employee.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedEmployee(employee)
                        setIsProfileDialogOpen(true)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedEmployee(employee)
                          setIsProfileDialogOpen(true)
                        }
                      }}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedEmployees.includes(employee.id)}
                          onCheckedChange={() => handleToggleEmployee(employee.id)}
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold">{employee.name}</h3>
                          <Badge variant={getStatusVariant(employee.status)}>{employee.status}</Badge>
                          {employee.performance_score && employee.performance_score >= 4.5 && (
                            <Badge variant="outline" className="gap-1 text-yellow-500 border-yellow-500">
                              <Star className="h-3 w-3 fill-yellow-500" />
                              Top Performer
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {employee.position} • {employee.department}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            <Calendar className="inline h-3 w-3 mr-1" />
                            Next Review: {getDaysUntilReview(employee.next_review_date)}
                          </span>
                          {employee.performance_score && (
                            <span>
                              <Star className="inline h-3 w-3 mr-1" />
                              Score: {employee.performance_score.toFixed(1)}/5.0
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        {!isLoggedInUsersEmployee(employee) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(employee)
                              setIsFeedbackDialogOpen(true)
                            }}
                          >
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Feedback
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsGoalsDialogOpen(true)
                          }}
                        >
                          <Target className="mr-2 h-4 w-4" />
                          Goals
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedEmployee(employee)
                            setIsProfileDialogOpen(true)
                          }}
                        >
                          View Profile
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </CardContent>
            </Card>
            </div>
                )
              }}
            />
          </TabsContent>

          <TabsContent value="performance">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'performance') return null
                return (
            <div className="h-full overflow-auto">
            {/* Performance KPIs - one rectangle, no inner bubbles */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center gap-4">
                    <Star className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Average Review Score</p>
                      <p className="text-2xl font-bold">{displayAvgPerformanceScore.toFixed(1)}/5</p>
                      <p className="text-xs text-muted-foreground">
                        {scopeHrToSelf ? "Your completed reviews" : "Across all employees"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Completed Reviews</p>
                      <p className="text-2xl font-bold">{displayCompletedReviews}</p>
                      <p className="text-xs text-muted-foreground">
                        {scopeHrToSelf ? "On time" : "This period"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Calendar className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reviews Overdue</p>
                      <p className="text-2xl font-bold">{displayOverdueReviews}</p>
                      <p className="text-xs text-muted-foreground">Need attention</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Clock className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Upcoming Reviews</p>
                      <p className="text-2xl font-bold">{displayUpcomingReviews}</p>
                      <p className="text-xs text-muted-foreground">
                        {scopeHrToSelf ? "Scheduled for you" : "Next 30 days"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Performance Distribution Charts - one rectangle */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className={`grid grid-cols-1 ${scopeHrToSelf ? "" : "md:grid-cols-2"} gap-6`}>
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Rating Distribution</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      {scopeHrToSelf ? "Your review scores" : "Performance scores across all reviews"}
                    </p>
                    <div className="space-y-3">
                      {[5, 4, 3, 2, 1].map((rating) => {
                        const count = effectivePerformanceReviews.filter(r => {
                          const overall = Number(calculateOverallRating(r))
                          return overall >= rating && overall < rating + 1
                        }).length
                        const percentage = effectivePerformanceReviews.length > 0
                          ? (count / effectivePerformanceReviews.length) * 100
                          : 0
                        return (
                          <div key={rating} className="flex items-center gap-3">
                            <div className="flex items-center gap-1 w-16">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">{rating}</span>
                            </div>
                            <Progress value={percentage} className="flex-1 h-2" />
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {count} ({Math.round(percentage)}%)
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {!scopeHrToSelf && (
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Department Performance</h3>
                    <p className="text-xs text-muted-foreground mb-4">Average scores by department</p>
                    <div className="space-y-3">
                      {(() => {
                        const deptScores = effectivePerformanceReviews.reduce((acc, review) => {
                          const dept = review.employee?.department || 'Unknown'
                          if (!acc[dept]) {
                            acc[dept] = { total: 0, count: 0 }
                          }
                          acc[dept].total += Number(calculateOverallRating(review))
                          acc[dept].count += 1
                          return acc
                        }, {} as Record<string, { total: number; count: number }>)
                        
                        return Object.entries(deptScores)
                          .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                          .slice(0, 5)
                          .map(([dept, { total, count }]) => {
                            const avg = total / count
                            const percentage = (avg / 5) * 100
                            return (
                              <div key={dept} className="flex items-center gap-3">
                                <div className="w-32 text-sm font-medium truncate" title={dept}>
                                  {dept}
                                </div>
                                <Progress value={percentage} className="flex-1 h-2" />
                                <span className={`text-sm font-semibold w-12 text-right ${getRatingColor(avg)}`}>
                                  {avg.toFixed(1)}
                                </span>
                              </div>
                            )
                          })
                      })()}
                      {effectivePerformanceReviews.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No reviews available
                        </p>
                      )}
                    </div>
                  </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Performance Reviews Table with Filters */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{scopeHrToSelf ? "My Performance Reviews" : "Employee Performance Reviews"}</CardTitle>
                      <CardDescription>
                        {scopeHrToSelf
                          ? "Your completed, overdue, and upcoming reviews"
                          : "Track and manage employee performance ratings"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {canManageHrAdmin && selectedReviews.size > 0 && (
                        <Button 
                          variant="destructive" 
                          onClick={() => setBulkDeleteTarget('reviews')}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete ({selectedReviews.size})
                        </Button>
                      )}
                      {canManageHrAdmin && (
                      <Button onClick={() => setIsAddReviewDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Review
                      </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={scopeHrToSelf ? "Search reviews..." : "Search by employee name..."}
                        value={performanceSearchQuery}
                        onChange={(e) => setPerformanceSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {!scopeHrToSelf && (
                    <Select value={performanceDeptFilter} onValueChange={setPerformanceDeptFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {Array.from(new Set(employees.map(e => e.department))).map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                    <Select value={performanceTypeFilter} onValueChange={setPerformanceTypeFilter}>
                      <SelectTrigger className="w-full sm:w-[160px]">
                        <SelectValue placeholder="Review Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                        <SelectItem value="probation">Probation</SelectItem>
                        <SelectItem value="promotion">Promotion</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={performanceStatusFilter} onValueChange={setPerformanceStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="on-time">On Time</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                        <SelectItem value="upcoming">Upcoming</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={performanceSort} onValueChange={(value: any) => setPerformanceSort(value)}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="date">Sort by Date</SelectItem>
                        <SelectItem value="rating">Sort by Rating</SelectItem>
                        <SelectItem value="name">Sort by Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Apply filters
                    let filteredReviews = effectivePerformanceReviews.filter(review => {
                      const matchesSearch = !performanceSearchQuery || 
                        review.employee?.name?.toLowerCase().includes(performanceSearchQuery.toLowerCase())
                      const matchesDept = performanceDeptFilter === "all" || 
                        review.employee?.department === performanceDeptFilter
                      const matchesType = performanceTypeFilter === "all" || 
                        review.review_type === performanceTypeFilter
                      const matchesStatus = performanceStatusFilter === "all" || 
                        review.status === performanceStatusFilter
                      
                      return matchesSearch && matchesDept && matchesType && matchesStatus
                    })

                    // Apply sorting
                    filteredReviews = filteredReviews.sort((a, b) => {
                      if (performanceSort === "rating") {
                        return Number(calculateOverallRating(b)) - Number(calculateOverallRating(a))
                      } else if (performanceSort === "name") {
                        return (a.employee?.name || '').localeCompare(b.employee?.name || '')
                      } else {
                        return new Date(b.review_date).getTime() - new Date(a.review_date).getTime()
                      }
                    })

                    if (filteredReviews.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-medium mb-1">No reviews found</p>
                          <p className="text-sm text-muted-foreground">
                            {performanceSearchQuery || performanceDeptFilter !== "all" || performanceTypeFilter !== "all" || performanceStatusFilter !== "all"
                              ? "Try adjusting your filters"
                              : "Get started by adding a performance review"}
                          </p>
                        </div>
                      )
                    }

                    return filteredReviews.map((review) => {
                      const overallRating = calculateOverallRating(review)
                      const isSelected = selectedReviews.has(review.id)
                      return (
                        <div key={review.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                          <div className="flex items-start justify-between mb-4">
                            {canManageHrAdmin && (
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedReviews)
                                if (checked) {
                                  newSelected.add(review.id)
                                } else {
                                  newSelected.delete(review.id)
                                }
                                setSelectedReviews(newSelected)
                              }}
                              className="mr-3 mt-1"
                            />
                            )}
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h3 className="font-semibold">{review.employee?.name || 'Unknown Employee'}</h3>
                                {getReviewStatusBadge(review.status)}
                                {getTrendIcon(review.trend)}
                                {review.review_format === 'self_assessment' && (
                                  <Badge variant="secondary">Self-Assessment</Badge>
                                )}
                                <Badge variant="outline" className="capitalize">{review.review_type}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{review.employee?.department || 'N/A'} • {review.employee?.position || 'N/A'}</p>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${getRatingColor(Number(overallRating))}`}>
                                {overallRating}
                              </div>
                              <p className="text-xs text-muted-foreground">Overall Rating</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Collaboration</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.collaboration)}`}>
                                  {review.collaboration}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Accountability</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.accountability)}`}>
                                  {review.accountability}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Trustworthy</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.trustworthy)}`}>
                                  {review.trustworthy}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Leadership</p>
                              <div className="flex items-center gap-2">
                                <div className={`text-lg font-semibold ${getRatingColor(review.leadership)}`}>
                                  {review.leadership}
                                </div>
                                <div className="text-xs text-muted-foreground">/5</div>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
                            <span>Review Date: {formatDateOnly(review.review_date)}</span>
                            <span>Period: {review.review_period}</span>
                            {review.reviewer && <span>Reviewer: {review.reviewer.name}</span>}
                          </div>

                          {(review.strengths || review.improvements || review.goals) && (
                            <div className="mb-4 p-3 bg-muted/50 rounded-md space-y-2">
                              {review.strengths && (
                                <div>
                                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" /> Strengths
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{review.strengths}</p>
                                </div>
                              )}
                              {review.improvements && (
                                <div>
                                  <p className="text-xs font-medium mb-1 flex items-center gap-1">
                                    <Target className="h-3 w-3" /> Areas for Improvement
                                  </p>
                                  <p className="text-xs text-muted-foreground line-clamp-2">{review.improvements}</p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex gap-2 flex-wrap">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsReviewDetailsOpen(true)
                              }}
                            >
                              <Eye className="mr-1 h-3 w-3" />
                              View Details
                            </Button>
                            {canManageHrAdmin && (
                            <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsAddReviewDialogOpen(true)
                              }}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              Add Review
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setSelectedReview(review)
                                setIsReviewHistoryOpen(true)
                              }}
                            >
                              <Clock className="mr-1 h-3 w-3" />
                              View History
                            </Button>
                            </>
                            )}
                          </div>
                        </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>
            </div>
                )
              }}
            />
          </TabsContent>

          <TabsContent value="goals">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'goals') return null
                return (
            <div className="h-full overflow-auto">
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <Target className="h-8 w-8 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Goals</p>
                      <p className="text-2xl font-bold">{totalGoals}</p>
                      <p className="text-xs text-muted-foreground">
                        {scopeHrToSelf ? "Your goals" : "Active employee goals"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">On Track</p>
                      <p className="text-2xl font-bold text-green-500">
                        {onTrackGoals} ({totalGoals > 0 ? Math.round((onTrackGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Progressing well</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Behind</p>
                      <p className="text-2xl font-bold text-red-500">
                        {behindGoals} ({totalGoals > 0 ? Math.round((behindGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Need attention</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <CheckCircle2 className="h-8 w-8 text-blue-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Complete</p>
                      <p className="text-2xl font-bold text-blue-500">
                        {completeGoals} ({totalGoals > 0 ? Math.round((completeGoals / totalGoals) * 100) : 0}%)
                      </p>
                      <p className="text-xs text-muted-foreground">Achieved goals</p>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Progress by Category</h3>
                    <p className="text-xs text-muted-foreground mb-4">Average completion rate by goal category</p>
                    <div className="space-y-3">
                      {(() => {
                        const categoryProgress = effectiveGoals.reduce((acc, goal) => {
                          if (!acc[goal.category]) {
                            acc[goal.category] = { total: 0, count: 0 }
                          }
                          acc[goal.category].total += goal.progress
                          acc[goal.category].count += 1
                          return acc
                        }, {} as Record<string, { total: number; count: number }>)
                        
                        return Object.entries(categoryProgress)
                          .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                          .map(([category, { total, count }]) => {
                            const avg = Math.round(total / count)
                            return (
                              <div key={category} className="flex items-center gap-3">
                                <div className="w-36 text-sm font-medium truncate" title={category}>
                                  {category}
                                </div>
                                <Progress value={avg} className="flex-1 h-2" />
                                <span className="text-sm font-semibold w-12 text-right">
                                  {avg}%
                                </span>
                              </div>
                            )
                          })
                      })()}
                      {effectiveGoals.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No goals available
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="text-base font-semibold mb-1">Goal Status Distribution</h3>
                    <p className="text-xs text-muted-foreground mb-4">Breakdown of goals by status</p>
                    <div className="space-y-3">
                      {['On Track', 'Behind', 'Complete', 'Cancelled'].map((status) => {
                        const count = effectiveGoals.filter(g => g.status === status).length
                        const percentage = effectiveGoals.length > 0 ? (count / effectiveGoals.length) * 100 : 0
                        const colors = {
                          'On Track': 'bg-green-500',
                          'Behind': 'bg-red-500',
                          'Complete': 'bg-blue-500',
                          'Cancelled': 'bg-gray-500',
                      }
                      return (
                        <div key={status} className="flex items-center gap-3">
                          <div className="flex items-center gap-2 w-28">
                            <div className={`h-3 w-3 rounded-full ${colors[status as keyof typeof colors]}`} />
                            <span className="text-sm font-medium">{status}</span>
                          </div>
                          <Progress value={percentage} className="flex-1 h-2" />
                          <span className="text-sm text-muted-foreground w-16 text-right">
                            {count} ({Math.round(percentage)}%)
                          </span>
                        </div>
                      )
                    })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Goals List with Filters */}
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{scopeHrToSelf ? "My Goals" : "Employee Goals"}</CardTitle>
                      <CardDescription>
                        {scopeHrToSelf
                          ? "Track your goals and progress"
                          : "Track and manage employee goals and progress"}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      {canManageHrAdmin && selectedGoals.size > 0 && (
                        <Button 
                          variant="destructive" 
                          onClick={() => setBulkDeleteTarget('goals')}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete ({selectedGoals.size})
                        </Button>
                      )}
                      <Button onClick={() => setIsAddGoalDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        {scopeHrToSelf ? 'Add my goal' : 'Add Goal'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={scopeHrToSelf ? "Search goals..." : "Search goals or employees..."}
                        value={goalSearchQuery}
                        onChange={(e) => setGoalSearchQuery(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {!scopeHrToSelf && (
                    <Select value={goalDeptFilter} onValueChange={setGoalDeptFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Departments</SelectItem>
                        {Array.from(new Set(employees.map(e => e.department))).map(dept => (
                          <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    )}
                    <Select value={goalCategoryFilter} onValueChange={setGoalCategoryFilter}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {Array.from(new Set(effectiveGoals.map(g => g.category))).map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={goalStatusFilter} onValueChange={setGoalStatusFilter}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="On Track">On Track</SelectItem>
                        <SelectItem value="Behind">Behind</SelectItem>
                        <SelectItem value="Complete">Complete</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={goalSort} onValueChange={(value: any) => setGoalSort(value)}>
                      <SelectTrigger className="w-full sm:w-[150px]">
                        <SelectValue placeholder="Sort by" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dueDate">Sort by Due Date</SelectItem>
                        <SelectItem value="progress">Sort by Progress</SelectItem>
                        <SelectItem value="name">Sort by Employee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(() => {
                    // Apply filters
                    let filteredGoals = effectiveGoals.filter(goal => {
                      const matchesSearch = !goalSearchQuery || 
                        goal.goal?.toLowerCase().includes(goalSearchQuery.toLowerCase()) ||
                        goal.employee?.name?.toLowerCase().includes(goalSearchQuery.toLowerCase())
                      const matchesDept = goalDeptFilter === "all" || 
                        goal.employee?.department === goalDeptFilter
                      const matchesCategory = goalCategoryFilter === "all" || 
                        goal.category === goalCategoryFilter
                      const matchesStatus = goalStatusFilter === "all" || 
                        goal.status === goalStatusFilter
                      
                      return matchesSearch && matchesDept && matchesCategory && matchesStatus
                    })

                    // Apply sorting
                    filteredGoals = filteredGoals.sort((a, b) => {
                      if (goalSort === "progress") {
                        return b.progress - a.progress
                      } else if (goalSort === "name") {
                        return (a.employee?.name || '').localeCompare(b.employee?.name || '')
                      } else {
                        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
                      }
                    })

                    if (filteredGoals.length === 0) {
                      return (
                        <div className="text-center py-12">
                          <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                          <p className="text-lg font-medium mb-1">No goals found</p>
                          <p className="text-sm text-muted-foreground">
                            {goalSearchQuery || goalDeptFilter !== "all" || goalCategoryFilter !== "all" || goalStatusFilter !== "all"
                              ? "Try adjusting your filters"
                              : "Get started by adding an employee goal"}
                          </p>
                        </div>
                      )
                    }

                    return filteredGoals.map((goal) => {
                      const isSelected = selectedGoals.has(goal.id)
                      return (
                      <div key={goal.id} className="p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          {canManageHrAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedGoals)
                              if (checked) {
                                newSelected.add(goal.id)
                              } else {
                                newSelected.delete(goal.id)
                              }
                              setSelectedGoals(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="font-semibold">{goal.goal}</h3>
                              <Badge className={getGoalStatusColor(goal.status)}>
                                {getGoalStatusIcon(goal.status)}
                                <span className="ml-1">{goal.status}</span>
                              </Badge>
                              <Badge variant="outline" className="capitalize">
                                {goal.category}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                              {scopeHrToSelf ? (
                                <span>Due {goal.due_date ? formatDateOnly(goal.due_date) : 'N/A'}</span>
                              ) : (
                                <>
                              <span className="font-medium">{goal.employee?.name || 'Unknown'}</span>
                              <span>•</span>
                              <span>{goal.employee?.department || 'N/A'}</span>
                              <span>•</span>
                              <span>{goal.employee?.position || 'N/A'}</span>
                                </>
                              )}
                            </div>
                            {goal.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                                {goal.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right ml-4">
                            <div className="text-2xl font-bold">{goal.progress}%</div>
                            <p className="text-xs text-muted-foreground">Progress</p>
                          </div>
                        </div>

                        <div className="mb-3">
                          <Progress value={goal.progress} className="h-2" />
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                          <span className={`flex items-center gap-1 ${
                            new Date(goal.due_date) < new Date() && goal.status !== 'Complete' 
                              ? 'text-red-500 font-medium' 
                              : ''
                          }`}>
                            <Calendar className="h-3 w-3" />
                            Due: {formatDateOnly(goal.due_date)} ({getDaysUntilDue(goal.due_date)})
                          </span>
                          <span>Created: {formatDateOnly(goal.created_date)}</span>
                        </div>

                        <div className="flex gap-2 flex-wrap">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setEditingGoal(goal.id)
                              setGoalProgress(goal.progress)
                            }}
                          >
                            <Activity className="mr-1 h-3 w-3" />
                            Update Progress
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedGoal(goal)
                              setGoalComment('')
                              setIsAddCommentOpen(true)
                            }}
                          >
                            <MessageSquare className="mr-1 h-3 w-3" />
                            Add Comment
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedGoal(goal)
                              setIsGoalDetailsOpen(true)
                            }}
                          >
                            <Eye className="mr-1 h-3 w-3" />
                            View Details
                          </Button>
                        </div>
                      </div>
                      )
                    })
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Update Progress Dialog */}
            <Dialog open={editingGoal !== null} onOpenChange={(open) => !open && setEditingGoal(null)}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Goal Progress</DialogTitle>
                  <DialogDescription>
                    {editingGoal && goals.find(g => g.id === editingGoal)?.goal}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="progress">Progress</Label>
                      <span className="text-2xl font-bold text-primary">{goalProgress}%</span>
                    </div>
                    <Slider
                      id="progress"
                      value={[goalProgress]}
                      onValueChange={(value) => setGoalProgress(value[0])}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Progress Bar Preview */}
                  <div className="space-y-2">
                    <Label>Progress Preview</Label>
                    <Progress value={goalProgress} className="h-3" />
                  </div>

                  {/* Status Based on Progress */}
                  <div className="p-3 bg-accent rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">New Status:</span>
                      {goalProgress === 100 ? (
                        <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Complete
                        </Badge>
                      ) : goalProgress >= 70 ? (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          On Track
                        </Badge>
                      ) : (
                        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Needs Attention
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingGoal(null)}>
                    Cancel
                  </Button>
                  <Button onClick={() => {
                    if (editingGoal) {
                      hrApi.updateGoal(editingGoal, { progress: goalProgress }).then(() => {
                        loadData()
                        setEditingGoal(null)
                      })
                    }
                  }}>
                    Save Progress
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
                )
              }}
            />
          </TabsContent>

          {canManageHrAdmin && (
          <TabsContent value="analytics">
            {customizeChrome}
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'analytics') return null
                return (
            <div className="h-full overflow-auto space-y-6">
              {/* Analytics Overview - one rectangle with date filter + 4 metrics */}
              {(() => {
                const { filteredReviews, filteredGoals, filteredEmployees } = analyticsFiltered
                const totalEmployees = analyticsDateRange === "all" ? stats.totalEmployees : filteredEmployees.length
                const inactiveInPeriod = filteredEmployees.filter(e => e.status === 'Inactive').length
                const completeGoalsInPeriod = filteredGoals.filter(g => g.status === 'Complete').length
                const totalGoalsInPeriod = filteredGoals.length
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                          <CardTitle>Katana HR Analytics</CardTitle>
                          <CardDescription>Comprehensive workforce insights and metrics</CardDescription>
                        </div>
                        <Select value={analyticsDateRange} onValueChange={setAnalyticsDateRange}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Date Range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="30">Last 30 Days</SelectItem>
                            <SelectItem value="90">Last 90 Days</SelectItem>
                            <SelectItem value="365">Last Year</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="flex items-center gap-4">
                          <Users className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {analyticsDateRange === "all" ? "Total Headcount" : "New Hires"}
                            </p>
                            <p className="text-2xl font-bold">{totalEmployees}</p>
                            <p className="text-xs text-muted-foreground">
                              {analyticsDateRange === "all" ? "Active employees" : `Hired in ${analyticsDateRange} days`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <TrendingDown className="h-8 w-8 text-green-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">
                              {analyticsDateRange === "all" ? "Turnover Rate" : "Turnover (Period)"}
                            </p>
                            <p className="text-2xl font-bold">
                              {totalEmployees > 0 && inactiveInPeriod > 0 
                                ? `${((inactiveInPeriod / totalEmployees) * 100).toFixed(1)}%`
                                : '0%'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {inactiveInPeriod === 0 ? 'No turnover' : `${inactiveInPeriod} inactive`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Reviews</p>
                            <p className="text-2xl font-bold">{filteredReviews.length}</p>
                            <p className="text-xs text-muted-foreground">
                              {analyticsDateRange === "all" ? "Total reviews" : "Reviews in period"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Target className="h-8 w-8 text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-muted-foreground">Goal Completion</p>
                            <p className="text-2xl font-bold">
                              {totalGoalsInPeriod > 0 
                                ? `${Math.round((completeGoalsInPeriod / totalGoalsInPeriod) * 100)}%`
                                : '0%'
                              }
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {completeGoalsInPeriod} of {totalGoalsInPeriod} goals completed
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Department & Performance Overview */}
              {(() => {
                const { filteredReviews, employeesToUse } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <CardTitle>Department & Performance Overview</CardTitle>
                      </div>
                      <CardDescription>
                        {analyticsDateRange === "all" 
                          ? "Headcount by department and performance ratings by team"
                          : `Department and performance metrics for the last ${analyticsDateRange} days`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h3 className="text-sm font-semibold mb-3">
                            {analyticsDateRange === "all" ? "Department Distribution" : "New Hires by Department"}
                          </h3>
                          <div className="space-y-3">
                            {(() => {
                              const deptCounts = employeesToUse.reduce((acc, emp) => {
                                const dept = emp.department || 'Unknown'
                                acc[dept] = (acc[dept] || 0) + 1
                                return acc
                              }, {} as Record<string, number>)
                          
                          const total = employeesToUse.length
                          const entries = Object.entries(deptCounts)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 5)
                          
                          if (entries.length === 0) {
                            return (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                No department data available
                              </p>
                            )
                          }
                          
                          return entries.map(([dept, count]) => {
                            const percentage = total > 0 ? (count / total) * 100 : 0
                            return (
                              <div key={dept} className="group">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-sm">{dept}</span>
                                  <span className="text-sm font-medium">{count} ({Math.round(percentage)}%)</span>
                                </div>
                                <Progress value={percentage} className="h-2 transition-[width] duration-300" />
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-3">Performance by Department</h3>
                      <div className="space-y-4">
                        {(() => {
                          const deptPerformance = filteredReviews.reduce((acc, review) => {
                            const dept = review.employee?.department || 'Unknown'
                            if (!acc[dept]) {
                              acc[dept] = { total: 0, count: 0 }
                            }
                            const overall = Number(calculateOverallRating(review))
                            acc[dept].total += overall
                            acc[dept].count += 1
                            return acc
                          }, {} as Record<string, { total: number; count: number }>)
                          
                          const entries = Object.entries(deptPerformance)
                            .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                            .slice(0, 4)
                          
                          if (entries.length === 0) {
                            return (
                              <div className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm">Average Performance</span>
                                  <span className="text-lg font-bold text-muted-foreground">N/A</span>
                                </div>
                                <Progress value={0} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-2">No performance data available</p>
                              </div>
                            )
                          }
                          
                          return entries.map(([dept, { total, count }]) => {
                            const avg = total / count
                            const percentage = (avg / 5) * 100
                            return (
                              <div key={dept} className="p-3 border rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-sm">{dept}</span>
                                  <span className={`text-lg font-bold ${getRatingColor(avg)}`}>
                                    {avg.toFixed(1)}/5
                                  </span>
                                </div>
                                <Progress value={percentage} className="h-2" />
                                <p className="text-xs text-muted-foreground mt-1">{count} reviews</p>
                              </div>
                            )
                          })
                        })()}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
                )
              })()}

              {/* Recruitment Analytics */}
              {(() => {
                const { filteredApplications } = analyticsFiltered
                const periodStats = {
                  total: filteredApplications.length,
                  new: filteredApplications.filter(app => app.status === 'new').length,
                  reviewing: filteredApplications.filter(app => app.status === 'reviewing').length,
                  interviewed: filteredApplications.filter(app => app.status === 'interviewed' || app.status === 'interview-scheduled').length,
                  offers: filteredApplications.filter(app => app.status === 'offer').length,
                }
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Recruitment Analytics</CardTitle>
                      <CardDescription>
                        {analyticsDateRange === "all" 
                          ? "Hiring trends and source effectiveness"
                          : `Applications received in the last ${analyticsDateRange} days`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Total Applications</p>
                            <p className="text-2xl font-bold">{periodStats.total}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">New</p>
                            <p className="text-2xl font-bold text-blue-500">{periodStats.new}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Reviewing</p>
                            <p className="text-2xl font-bold text-yellow-500">{periodStats.reviewing}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Interviewed</p>
                            <p className="text-2xl font-bold text-purple-500">{periodStats.interviewed}</p>
                          </div>
                          <div className="p-3 border rounded-lg text-center transition-colors duration-200 hover:bg-muted/50">
                            <p className="text-xs text-muted-foreground mb-1">Offers</p>
                            <p className="text-2xl font-bold text-green-500">{periodStats.offers}</p>
                          </div>
                        </div>

                        {/* Application Status Distribution */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Application Status Distribution</h3>
                          {filteredApplications.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No application data available</p>
                          <p className="text-xs mt-1">Data will appear here as applications are received</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {(() => {
                            const statusCounts = filteredApplications.reduce((acc, app) => {
                              const status = app.status || 'unknown'
                              acc[status] = (acc[status] || 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                            
                            const total = filteredApplications.length
                            const statusLabels: Record<string, string> = {
                              'new': 'New',
                              'reviewing': 'Reviewing',
                              'interview-scheduled': 'Interview Scheduled',
                              'interviewed': 'Interviewed',
                              'offer': 'Offer',
                              'accepted': 'Accepted',
                              'rejected': 'Rejected',
                            }
                            
                            return Object.entries(statusCounts)
                              .sort((a, b) => (b[1] as number) - (a[1] as number))
                              .map(([status, count]) => {
                                const countNum = count as number
                                const percentage = total > 0 ? (countNum / total) * 100 : 0
                                const label = statusLabels[status] || status
                                return (
                                  <div key={status}>
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-sm capitalize">{label}</span>
                                      <span className="text-sm font-medium">{countNum} ({Math.round(percentage)}%)</span>
                                    </div>
                                    <Progress value={percentage} className="h-2 transition-[width] duration-300" />
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Application Sources */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Application Sources</h3>
                          {filteredApplications.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No application source data available</p>
                              <p className="text-xs mt-1">Data will appear here as applications are received</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {(() => {
                                const sourceCounts = filteredApplications.reduce((acc, app) => {
                              const source = app.source || 'Direct'
                              acc[source] = (acc[source] || 0) + 1
                              return acc
                            }, {} as Record<string, number>)
                            
                            const total = filteredApplications.length
                            
                            return Object.entries(sourceCounts)
                              .sort((a, b) => (b[1] as number) - (a[1] as number))
                              .map(([source, count]) => {
                                const countNum = count as number
                                const percentage = total > 0 ? (countNum / total) * 100 : 0
                                return (
                                  <div key={source} className="p-3 border rounded-lg text-center">
                                    <p className="text-xs text-muted-foreground mb-1">{source}</p>
                                    <p className="text-2xl font-bold">{countNum}</p>
                                    <p className="text-xs text-muted-foreground">{Math.round(percentage)}%</p>
                                  </div>
                                )
                              })
                          })()}
                        </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Performance Analytics */}
              {(() => {
                const { filteredReviews } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Analytics</CardTitle>
                      <CardDescription>Employee performance trends and department comparisons</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Average Performance Score by Department</h3>
                        {filteredReviews.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Star className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No performance data available</p>
                            <p className="text-xs mt-1">Department performance will appear here as reviews are completed</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(() => {
                              const deptScores = filteredReviews.reduce((acc, review) => {
                              const dept = review.employee?.department || 'Unknown'
                              if (!acc[dept]) {
                                acc[dept] = { total: 0, count: 0 }
                              }
                              const overall = Number(calculateOverallRating(review))
                              acc[dept].total += overall
                              acc[dept].count += 1
                              return acc
                            }, {} as Record<string, { total: number; count: number }>)
                            
                            return Object.entries(deptScores)
                              .sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count))
                              .map(([dept, { total, count }]) => {
                                const avg = total / count
                                const percentage = (avg / 5) * 100
                                return (
                                  <div key={dept} className="flex items-center gap-3">
                                    <div className="w-40 text-sm font-medium truncate" title={dept}>
                                      {dept}
                                    </div>
                                    <Progress value={percentage} className="flex-1 h-2 transition-[width] duration-300" />
                                    <span className={`text-sm font-semibold w-16 text-right ${getRatingColor(avg)}`}>
                                      {avg.toFixed(1)}/5
                                    </span>
                                    <span className="text-xs text-muted-foreground w-12">
                                      ({count} reviews)
                                    </span>
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Review Statistics */}
                        {(() => {
                          const avgScore = filteredReviews.length > 0
                            ? filteredReviews.reduce((sum, r) => sum + Number(calculateOverallRating(r)), 0) / filteredReviews.length
                            : 0
                          
                          return (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Total Reviews</p>
                                <p className="text-2xl font-bold">{filteredReviews.length}</p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                                <p className={`text-2xl font-bold ${getRatingColor(avgScore)}`}>
                                  {avgScore > 0 ? avgScore.toFixed(1) : '0.0'}/5
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">On Time</p>
                                <p className="text-2xl font-bold text-green-500">
                                  {filteredReviews.filter(r => r.status === 'on-time').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">Overdue</p>
                                <p className="text-2xl font-bold text-red-500">
                                  {filteredReviews.filter(r => r.status === 'overdue').length}
                                </p>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Performance Trends */}
                        <div>
                          <h3 className="text-sm font-semibold mb-3">Performance Trends</h3>
                          {filteredReviews.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p className="text-sm">No performance trend data available</p>
                              <p className="text-xs mt-1">Performance trends will appear here as review data accumulates</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                  <p className="text-xs text-muted-foreground">Improving</p>
                                </div>
                                <p className="text-2xl font-bold text-green-500">
                                  {filteredReviews.filter(r => r.trend === 'up').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <Minus className="h-4 w-4 text-gray-500" />
                                  <p className="text-xs text-muted-foreground">Stable</p>
                                </div>
                                <p className="text-2xl font-bold text-gray-500">
                                  {filteredReviews.filter(r => r.trend === 'stable').length}
                                </p>
                              </div>
                              <div className="p-3 border rounded-lg text-center">
                                <div className="flex items-center justify-center gap-1 mb-1">
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  <p className="text-xs text-muted-foreground">Declining</p>
                                </div>
                                <p className="text-2xl font-bold text-red-500">
                                  {filteredReviews.filter(r => r.trend === 'down').length}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Employee Analytics */}
              {(() => {
                const { filteredEmployees, filteredGoals, employeesToUse } = analyticsFiltered
                return (
                  <Card>
                    <CardHeader>
                      <CardTitle>Employee Analytics</CardTitle>
                      <CardDescription>Workforce composition and engagement metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                      {/* Headcount by Department */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">
                          {analyticsDateRange === "all" ? "Headcount by Department" : "New Hires by Department"}
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          {new Set(employeesToUse.map(e => e.department)).size > 0 ? (
                            Array.from(new Set(employeesToUse.map(e => e.department))).map(dept => {
                              const deptCount = employeesToUse.filter(e => e.department === dept).length;
                              const percentage = ((deptCount / employeesToUse.length) * 100).toFixed(0);
                            return (
                              <div key={dept} className="p-3 border rounded-lg">
                                <p className="text-xs text-muted-foreground mb-1">{dept}</p>
                                <p className="text-2xl font-bold">{deptCount}</p>
                                <p className="text-xs text-muted-foreground">{percentage}%</p>
                              </div>
                            );
                          })
                        ) : (
                          <div className="col-span-full text-center py-8 text-muted-foreground">
                            <Building className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No department data available</p>
                            <p className="text-xs mt-1">Department breakdown will appear here as employees are added</p>
                          </div>
                        )}
                      </div>

                      {/* Tenure Distribution */}
                      <div>
                        <h3 className="text-sm font-semibold mb-3">Tenure Distribution</h3>
                        {employeesToUse.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No tenure data available</p>
                            <p className="text-xs mt-1">Tenure distribution will appear here as employees are added</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(() => {
                              const tenureBuckets = {
                                '< 1 year': 0,
                                '1-2 years': 0,
                                '2-5 years': 0,
                                '5-10 years': 0,
                                '10+ years': 0,
                              }
                              
                              employeesToUse.forEach(emp => {
                              const years = (new Date().getTime() - new Date(emp.hire_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
                              if (years < 1) tenureBuckets['< 1 year']++
                              else if (years < 2) tenureBuckets['1-2 years']++
                              else if (years < 5) tenureBuckets['2-5 years']++
                              else if (years < 10) tenureBuckets['5-10 years']++
                              else tenureBuckets['10+ years']++
                            })
                            
                            const total = employeesToUse.length
                            
                            return Object.entries(tenureBuckets).map(([bucket, count]) => {
                              const percentage = total > 0 ? (count / total) * 100 : 0
                              return (
                                <div key={bucket}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-sm">{bucket}</span>
                                    <span className="text-sm font-medium">{count} ({Math.round(percentage)}%)</span>
                                  </div>
                                  <Progress value={percentage} className="h-2" />
                                </div>
                              )
                            })
                          })()}
                        </div>
                      )}
                    </div>

                        {/* Engagement Metrics */}
                        {(() => {
                          const { filteredReviews, filteredGoals } = analyticsFiltered
                          const completeGoalsInPeriod = filteredGoals.filter(g => g.status === 'Complete').length
                          const totalGoalsInPeriod = filteredGoals.length
                          const avgPerformance = filteredReviews.length > 0
                            ? filteredReviews.reduce((sum, r) => sum + Number(calculateOverallRating(r)), 0) / filteredReviews.length
                            : 0
                          
                          return (
                            <div>
                              <h3 className="text-sm font-semibold mb-3">Engagement Metrics</h3>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Goal Completion</p>
                                  <p className="text-2xl font-bold text-green-500">
                                    {totalGoalsInPeriod > 0 ? `${Math.round((completeGoalsInPeriod / totalGoalsInPeriod) * 100)}%` : '0%'}
                                  </p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Avg Performance</p>
                                  <p className={`text-2xl font-bold ${getRatingColor(avgPerformance)}`}>
                                    {avgPerformance > 0 ? avgPerformance.toFixed(1) : 'N/A'}
                                  </p>
                                </div>
                                <div className="p-3 border rounded-lg">
                                  <p className="text-xs text-muted-foreground mb-1">Learning Paths</p>
                                  <p className="text-2xl font-bold">{learningPaths.length}</p>
                                </div>
                              </div>
                            </div>
                          )
                        })()}
                      </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })()}

              {/* Export Options */}
              <div className="flex justify-end gap-2">
                <Button variant="outline">
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV
                </Button>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            </div>
                )
              }}
            />
          </TabsContent>
          )}

          <TabsContent value="development">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle>Development Studio</CardTitle>
                    <CardDescription>
                      {scopeHrToSelf
                        ? "Your career path, mentorship, training, and recognition"
                        : "Career paths, mentorship, learning, and recognition in one place"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={developmentSection} onValueChange={(v) => setDevelopmentSection(v as typeof developmentSection)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1 bg-muted/50 mb-4">
                    <TabsTrigger value="career" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Rocket className="h-4 w-4 shrink-0" />
                      Career Paths
                    </TabsTrigger>
                    <TabsTrigger value="mentorship" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Users className="h-4 w-4 shrink-0" />
                      Mentorship
                    </TabsTrigger>
                    <TabsTrigger value="learning" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <GraduationCap className="h-4 w-4 shrink-0" />
                      Learning
                    </TabsTrigger>
                    <TabsTrigger value="recognition" className="text-xs sm:text-sm py-2.5 gap-1.5">
                      <Award className="h-4 w-4 shrink-0" />
                      Recognition
                    </TabsTrigger>
                  </TabsList>

                  {customizeChrome}

                  <TabsContent value="career" className="mt-0">
                    <ModuleWidgetCanvas
                      widgets={tabLayout.widgets}
                      catalog={tabLayout.catalog}
                      customizeMode={tabLayout.customizeMode}
                      onLayoutChange={tabLayout.onLayoutChange}
                      onRemoveWidget={tabLayout.onRemoveWidget}
                      rowHeight={36}
                      renderWidget={(widgetId) => {
                        if (widgetId !== 'career_paths') return null
                        return (
                    <div className="h-full overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">
                            {scopeHrToSelf
                              ? "Career paths assigned to you by HR"
                              : "Employee career progression and development tracking"}
                          </p>
                          {canManageHrAdmin && (
                          <div className="flex gap-2">
                            {selectedCareerPaths.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteTarget('careerPaths')}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedCareerPaths.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsAddCareerPathDialogOpen(true)} size="sm">
                              <Plus className="mr-2 h-4 w-4" />
                              Add Career Path
                            </Button>
                          </div>
                          )}
                        </div>
                        {effectiveCareerPaths.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Rocket className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No career paths defined</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {scopeHrToSelf
                          ? "Your HR team has not assigned a career path yet"
                          : "Career paths will appear here as employees are assigned development plans"}
                      </p>
                      {canManageHrAdmin && (
                      <Button onClick={() => setIsAddCareerPathDialogOpen(true)} variant="outline">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Career Path
                      </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3 px-6">
                      {effectiveCareerPaths.map((path) => {
                        const isSelected = selectedCareerPaths.has(path.id)
                        return (
                      <div key={path.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          {canManageHrAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedCareerPaths)
                              if (checked) {
                                newSelected.add(path.id)
                              } else {
                                newSelected.delete(path.id)
                              }
                              setSelectedCareerPaths(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          )}
                          <div>
                            <h3 className="font-semibold text-sm mb-1">{path.employee?.name || 'Unknown'}</h3>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <span>{path.current_role_name}</span>
                              <ArrowRight className="h-3 w-3" />
                              <span className="font-medium text-foreground">{path.next_role}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-xs">{path.time_to_promotion}</Badge>
                        </div>

                        <div className="mb-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">Promotion Readiness</span>
                            <span className="text-xs font-bold">{path.readiness}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, path.readiness || 0))} className="h-1.5" />
                        </div>

                        <div>
                          <p className="text-xs text-muted-foreground mb-2">Required Skills:</p>
                          <div className="flex flex-wrap gap-2">
                            {Array.isArray(path.required_skills) && path.required_skills.length > 0 ? (
                              path.required_skills.map((skill, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {skill}
                                </Badge>
                              ))
                            ) : (
                              <p className="text-xs text-muted-foreground italic">No skills specified</p>
                            )}
                          </div>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                    </div>
                        )
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="mentorship" className="mt-0">
                    <ModuleWidgetCanvas
                      widgets={tabLayout.widgets}
                      catalog={tabLayout.catalog}
                      customizeMode={tabLayout.customizeMode}
                      onLayoutChange={tabLayout.onLayoutChange}
                      onRemoveWidget={tabLayout.onRemoveWidget}
                      rowHeight={36}
                      renderWidget={(widgetId) => {
                        if (widgetId !== 'mentorship') return null
                        return (
                    <div className="h-full overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">
                            {scopeHrToSelf
                              ? "Mentorship matches assigned to you"
                              : "Katana-powered mentor-mentee matching"}
                          </p>
                          {canManageHrAdmin && (
                          <div className="flex gap-2">
                            {selectedMentorships.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteTarget('mentorships')}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedMentorships.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsCreateMatchOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Create Match
                            </Button>
                          </div>
                          )}
                        </div>
                  {effectiveMentorships.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No mentorship matches yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {scopeHrToSelf
                          ? "HR has not assigned a mentorship match yet"
                          : "Create mentorship matches to connect mentors with mentees"}
                      </p>
                      {canManageHrAdmin && (
                      <Button onClick={() => setIsCreateMatchOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Create Your First Match
                      </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {effectiveMentorships.map((match) => {
                        const isSelected = selectedMentorships.has(match.id)
                        return (
                      <div key={match.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          {canManageHrAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedMentorships)
                              if (checked) {
                                newSelected.add(match.id)
                              } else {
                                newSelected.delete(match.id)
                              }
                              setSelectedMentorships(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          )}
                          <div className="flex-1">
                            <div className="flex items-center gap-1.5 mb-1">
                              <h4 className="font-semibold text-sm">{match.mentor?.name || 'Unknown'}</h4>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <h4 className="font-semibold text-sm">{match.mentee?.name || 'Unknown'}</h4>
                            </div>
                            <p className="text-xs text-muted-foreground">Focus: {match.focus}</p>
                          </div>
                          <div className="text-right ml-2">
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Sparkles className="h-3 w-3" />
                              {match.match_score}%
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Started: {match.start_date ? formatDateOnly(match.start_date) : 'N/A'}</span>
                          <Badge variant="secondary" className="text-xs">{match.status}</Badge>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                    </div>
                        )
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="learning" className="mt-0">
                    <ModuleWidgetCanvas
                      widgets={tabLayout.widgets}
                      catalog={tabLayout.catalog}
                      customizeMode={tabLayout.customizeMode}
                      onLayoutChange={tabLayout.onLayoutChange}
                      onRemoveWidget={tabLayout.onRemoveWidget}
                      rowHeight={36}
                      renderWidget={(widgetId) => {
                        if (widgetId !== 'learning') return null
                        return (
                    <div className="h-full overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">
                            {scopeHrToSelf
                              ? `${effectiveLearningPaths.length} training assignment${effectiveLearningPaths.length === 1 ? "" : "s"} assigned to you`
                              : `${effectiveLearningPaths.length} assignment${effectiveLearningPaths.length === 1 ? "" : "s"} · ${trainingCourses.length} catalog course${trainingCourses.length === 1 ? "" : "s"}`}
                          </p>
                          {canManageHrAdmin && (
                          <div className="flex flex-wrap gap-2">
                            {selectedLearningPaths.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteTarget('learningPaths')}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedLearningPaths.size})
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => setIsManageCoursesOpen(true)}>
                              Manage courses
                            </Button>
                            <Button size="sm" onClick={() => setIsAssignTrainingOpen(true)}>
                              <BookOpen className="mr-2 h-4 w-4" />
                              Assign Training
                            </Button>
                          </div>
                          )}
                        </div>
                  {effectiveLearningPaths.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <GraduationCap className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No training assigned</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        {scopeHrToSelf
                          ? "HR has not assigned training yet"
                          : "Create courses in the catalog, then assign them to employees"}
                      </p>
                      {canManageHrAdmin && (
                      <div className="flex flex-wrap justify-center gap-2">
                        <Button onClick={() => setIsManageCoursesOpen(true)} variant="outline">
                          Manage courses
                        </Button>
                        <Button onClick={() => setIsAssignTrainingOpen(true)}>
                          <BookOpen className="mr-2 h-4 w-4" />
                          Assign Training
                        </Button>
                      </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2 px-6">
                      {effectiveLearningPaths.map((learning) => {
                        const isSelected = selectedLearningPaths.has(learning.id)
                        return (
                      <div key={learning.id} className="p-3 border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          {canManageHrAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedLearningPaths)
                              if (checked) {
                                newSelected.add(learning.id)
                              } else {
                                newSelected.delete(learning.id)
                              }
                              setSelectedLearningPaths(newSelected)
                            }}
                            className="mr-3 mt-1"
                          />
                          )}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm mb-0.5">
                              {scopeHrToSelf ? learning.course : (learning.employee?.name || 'Unknown')}
                            </h4>
                            {!scopeHrToSelf && (
                            <p className="text-xs text-muted-foreground truncate">{learning.course}</p>
                            )}
                            {learning.notes && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2 italic">{learning.notes}</p>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <Badge variant={learning.status === "completed" ? "secondary" : "default"} className="text-xs">
                              {learning.status === "completed" ? (
                                <>
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Done
                                </>
                              ) : learning.status === "not-started" ? (
                                "Not started"
                              ) : (
                                "In progress"
                              )}
                            </Badge>
                            {learning.priority && (
                              <Badge
                                variant={learning.priority === "high" ? "destructive" : "outline"}
                                className="text-xs capitalize"
                              >
                                {learning.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="mb-1.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs">Progress</span>
                            <span className="text-xs font-bold">{learning.progress}%</span>
                          </div>
                          <Progress value={Math.max(0, Math.min(100, learning.progress || 0))} className="h-1.5" />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Due: {learning.due_date ? formatDateOnly(learning.due_date) : 'N/A'}
                        </p>
                      </div>
                        )
                      })}
                    </div>
                  )}
                    </div>
                        )
                      }}
                    />
                  </TabsContent>

                  <TabsContent value="recognition" className="mt-0">
                    <ModuleWidgetCanvas
                      widgets={tabLayout.widgets}
                      catalog={tabLayout.catalog}
                      customizeMode={tabLayout.customizeMode}
                      onLayoutChange={tabLayout.onLayoutChange}
                      onRemoveWidget={tabLayout.onRemoveWidget}
                      rowHeight={36}
                      renderWidget={(widgetId) => {
                        if (widgetId !== 'recognition') return null
                        return (
                    <div className="h-full overflow-auto">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 px-6">
                          <p className="text-sm text-muted-foreground">
                            {scopeHrToSelf
                              ? "Recognition you have received or given"
                              : "Peer and manager recognition tracking"}
                          </p>
                          <div className="flex gap-2">
                            {canManageHrAdmin && selectedRecognitions.size > 0 && (
                              <Button variant="destructive" size="sm" onClick={() => setBulkDeleteTarget('recognitions')}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete ({selectedRecognitions.size})
                              </Button>
                            )}
                            <Button onClick={() => setIsGiveRecognitionOpen(true)}>
                              <Plus className="mr-2 h-4 w-4" />
                              Give Recognition
                            </Button>
                          </div>
                        </div>
                  {effectiveRecognitions.length === 0 ? (
                    <div className="text-center py-12 px-6">
                      <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium mb-1">No recognitions yet</p>
                      <p className="text-sm text-muted-foreground mb-4">
                        Recognize team members for their contributions and achievements
                      </p>
                      <Button onClick={() => setIsGiveRecognitionOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Give Your First Recognition
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 px-6">
                      {effectiveRecognitions.map((recognition) => {
                        const isSelected = selectedRecognitions.has(recognition.id)
                        return (
                      <div key={recognition.id} className="p-3 border rounded-lg bg-accent/30">
                        <div className="flex items-start gap-2">
                          {canManageHrAdmin && (
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedRecognitions)
                              if (checked) {
                                newSelected.add(recognition.id)
                              } else {
                                newSelected.delete(recognition.id)
                              }
                              setSelectedRecognitions(newSelected)
                            }}
                            className="mr-2 mt-1"
                          />
                          )}
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <ThumbsUp className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="font-semibold text-sm">{recognition.from_name}</span>
                              <ArrowRight className="h-3 w-3 text-muted-foreground" />
                              <span className="font-semibold text-sm">{recognition.to_name}</span>
                              <Badge variant="outline" className="text-xs">{recognition.category}</Badge>
                            </div>
                            <p className="text-xs mb-1.5 line-clamp-2">{recognition.message}</p>
                            <p className="text-xs text-muted-foreground">
                              {recognition.recognition_date ? formatDateOnly(recognition.recognition_date) : 'N/A'} • {recognition.type}
                            </p>
                          </div>
                        </div>
                      </div>
                        )
                      })}
                    </div>
                  )}
                    </div>
                        )
                      }}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Employee Profile Dialog */}
        <Dialog open={isProfileDialogOpen} onOpenChange={(open) => {
          setIsProfileDialogOpen(open)
          if (!open) setEmployeeInviteCode(null)
          else if (selectedEmployee) setEditableModuleAccess(Array.isArray(selectedEmployee.module_access) ? [...selectedEmployee.module_access] : [])
        }}>
          <DialogContent className="flex h-[min(620px,78vh)] w-[calc(100vw-2rem)] max-w-2xl sm:max-w-2xl flex-col overflow-hidden p-6 min-h-0">
            <DialogHeader className="pb-4 border-b flex-shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-2xl mb-2 break-words pr-8">{selectedEmployee?.name}</DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedEmployee && <Badge variant={getStatusVariant(selectedEmployee.status)}>{selectedEmployee.status}</Badge>}
                    {selectedEmployee && selectedEmployee.performance_score && selectedEmployee.performance_score >= 4.5 && (
                      <Badge variant="outline" className="border-yellow-500 text-yellow-500 bg-yellow-500/10">
                        <Star className="h-4 w-4 fill-yellow-500 mr-1" />
                        Top Performer
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button className="mx-0 my-3.5 bg-transparent" variant="outline" size="sm">
                    <Mail className="w-4 h-4" />
                  </Button>
                  <Button className="my-3.5 bg-transparent" variant="outline" size="sm">
                    <Phone className="w-4 h-4" />
                  </Button>
                  <Button className="my-3.5" size="sm">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </DialogHeader>

            {selectedEmployee && (
              <Tabs defaultValue="overview" className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden">
                <TabsList className="w-full justify-start border-b rounded-none bg-transparent p-0 flex-shrink-0 mb-2">
                  <TabsTrigger
                    value="overview"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Overview
                  </TabsTrigger>
                  <TabsTrigger
                    value="performance"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Performance
                  </TabsTrigger>
                  <TabsTrigger
                    value="goals"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    Goals
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="border-b-2 border-transparent data-[state=active]:border-primary text-base rounded-lg px-4"
                  >
                    History
                  </TabsTrigger>
                </TabsList>

                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-2 px-1">

                  <TabsContent value="overview" className="mt-0 space-y-5">
                    {/* Invite to Katana - at top so code is visible after generating */}
                    <Card className="overflow-hidden border-primary/30 bg-primary/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Ticket className="w-5 h-5 text-primary" />
                          Invite to Katana
                        </CardTitle>
                        <CardDescription>
                          Generate an invite code for this employee. They go to the app home page, click Have an invite?, enter the code, then create their account.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="px-6">
                        {!selectedEmployee.email?.trim() ? (
                          <p className="text-sm text-muted-foreground">Add an email for this employee first.</p>
                        ) : employeeInviteCode && (employeeInviteCode.email || '').toLowerCase() === (selectedEmployee.email || '').trim().toLowerCase() ? (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">Invite code (copy and give to the employee)</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                readOnly
                                value={employeeInviteCode.code || employeeInviteCode.inviteLink || '—'}
                                className="text-xl font-mono font-bold tracking-[0.2em] h-12 bg-background border-2 flex-1"
                              />
                              <Button
                                onClick={() => {
                                  const toCopy = employeeInviteCode.code || employeeInviteCode.inviteLink
                                  if (toCopy) {
                                    navigator.clipboard.writeText(toCopy)
                                    setInviteCodeCopied(true)
                                    toast({ title: 'Copied to clipboard' })
                                    setTimeout(() => setInviteCodeCopied(false), 2000)
                                  }
                                }}
                              >
                                {inviteCodeCopied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                                {inviteCodeCopied ? 'Copied' : 'Copy'}
                              </Button>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Share with <strong>{selectedEmployee.email}</strong>. They use this code on the home page at Have an invite?.
                            </p>
                          </div>
                        ) : (
                          <Button
                            type="button"
                            onClick={async () => {
                              setInviteCodeLoading(true)
                              try {
                                const email = (selectedEmployee.email ?? '').trim()
                                if (!email) {
                                  sonnerToast.error('No email', { description: 'Add an email for this employee first.' })
                                  toast({ title: 'No email', description: 'Add an email for this employee first.', variant: 'destructive' })
                                  return
                                }
                                const result = await getOrCreateInviteForEmployee(email, 'member')
                                const code = result.code || ''
                                const link = result.inviteLink || ''
                                setEmployeeInviteCode({
                                  email: email.toLowerCase(),
                                  code,
                                  inviteLink: link,
                                })
                                sonnerToast.success('Invite code ready', {
                                  description: code ? `Code: ${code}` : link ? 'Link generated — use Copy below.' : 'Done. Use Copy below.',
                                  duration: 8000,
                                })
                                toast({
                                  title: 'Invite code ready',
                                  description: code ? `Code: ${code}` : link ? 'Link generated — use Copy below.' : 'Done. Use Copy below.',
                                  duration: 8000,
                                })
                              } catch (e: unknown) {
                                const msg = e instanceof Error ? e.message : String(e)
                                console.error('Generate invite failed:', e)
                                const hint = /migration|function.*does not exist|relation.*does not exist/i.test(msg)
                                  ? ' Run the invite-code migration and try again.'
                                  : ''
                                sonnerToast.error('Failed to generate invite', { description: msg + hint, duration: 10000 })
                                toast({
                                  title: 'Failed to generate invite',
                                  description: msg + hint,
                                  variant: 'destructive',
                                  duration: 10000,
                                })
                              } finally {
                                setInviteCodeLoading(false)
                              }
                            }}
                            disabled={inviteCodeLoading}
                          >
                            {inviteCodeLoading ? 'Generating…' : 'Generate invite code'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.04, duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                        className="min-w-0"
                      >
                        <Card className="min-w-0">
                          <CardContent className="pt-5 pb-5 text-center px-3">
                            <div className="text-2xl font-bold mb-1">
                              {selectedEmployee.performance_score ? `${selectedEmployee.performance_score}/5.0` : 'N/A'}
                            </div>
                            <p className="text-sm text-muted-foreground">Performance</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08, duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                        className="min-w-0"
                      >
                        <Card className="min-w-0">
                          <CardContent className="pt-5 pb-5 text-center px-3">
                            <div className="text-2xl font-bold mb-1">
                              {goals.filter(g => g.employee_id === selectedEmployee.id && g.status === 'Complete').length}/
                              {goals.filter(g => g.employee_id === selectedEmployee.id).length}
                            </div>
                            <p className="text-sm text-muted-foreground">Goals</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12, duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                        className="min-w-0"
                      >
                        <Card className="min-w-0">
                          <CardContent className="pt-5 pb-5 text-center px-3">
                            <div className="text-2xl font-bold mb-1">-</div>
                            <p className="text-sm text-muted-foreground">Tenure</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.16, duration: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
                        className="min-w-0"
                      >
                        <Card className="min-w-0">
                          <CardContent className="pt-5 pb-5 text-center px-3">
                            <div className="text-lg font-bold mb-1 leading-snug break-words">
                              {getDaysUntilReview(selectedEmployee.next_review_date)}
                            </div>
                            <p className="text-sm text-muted-foreground">Next Review</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    </div>

                    {/* Employee Details */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Employee Information</CardTitle>
                      </CardHeader>
                      <CardContent className="px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                          <div className="flex items-start gap-3 min-w-0">
                            <Building className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Department</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.department}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <User className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Position</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.position}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Employee ID</p>
                              <p className="text-sm font-medium font-mono break-all">
                                EMP-{selectedEmployee.id}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Employment Type</p>
                              <p className="text-base font-medium">Full-time</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <User className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Manager</p>
                              <p className="text-base font-medium break-words">{selectedEmployee.manager?.name || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Building className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Location</p>
                              <p className="text-base font-medium break-words">-</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Contact Information */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Contact Information</CardTitle>
                      </CardHeader>
                      <CardContent className="px-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                          <div className="flex items-start gap-3 min-w-0">
                            <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Email</p>
                              <p className="text-base font-medium break-all">{selectedEmployee.email || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 min-w-0">
                            <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-muted-foreground mb-1">Phone</p>
                              <p className="text-base font-medium">{selectedEmployee.phone || 'N/A'}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Module access – which app modules this employee can open */}
                    <Card className="overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Module access</CardTitle>
                        <CardDescription>
                          Choose which modules this employee can see in the sidebar. They must sign in with the same email as above for this to apply.
                        </CardDescription>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          Note: users with the <span className="font-semibold">owner</span> or <span className="font-semibold">admin</span> role
                          always see every module regardless of these checkboxes. Module restrictions only apply to users with the
                          <span className="font-semibold"> member</span> role.
                        </p>
                        {isPilotModeEnabled() && canManageModuleAccess && (
                          <p className="text-xs text-muted-foreground mt-2">
                            Pilot mode is on: only modules listed in <code className="text-xs">VITE_PILOT_MODULES</code> can be assigned.
                          </p>
                        )}
                      </CardHeader>
                      <CardContent className="px-6">
                        {!canManageModuleAccess ? (
                          <p className="text-sm text-muted-foreground mb-4">
                            Only organization owners and admins can change module access. Contact an owner if you need different permissions.
                          </p>
                        ) : selectedEmployee && isLoggedInUsersEmployee(selectedEmployee) ? (
                          <p className="text-sm text-muted-foreground mb-4">
                            You cannot change your own module access. Ask another owner or admin to update it.
                          </p>
                        ) : (
                          <>
                        <ModuleAccessFields
                          value={editableModuleAccess}
                          onChange={setEditableModuleAccess}
                        />
                        <Button
                          size="sm"
                          className="mt-4"
                          disabled={moduleAccessSaving}
                          onClick={async () => {
                            if (!selectedEmployee) return
                            setModuleAccessSaving(true)
                            try {
                              const updated = await hrApi.updateEmployee(selectedEmployee.id, {
                                module_access: editableModuleAccess,
                              })
                              if (updated) {
                                const saved = Array.isArray(updated.module_access) ? updated.module_access : editableModuleAccess
                                setEmployees((prev) =>
                                  prev.map((e) => (e.id === selectedEmployee.id ? { ...e, module_access: saved } : e))
                                )
                                setSelectedEmployee((prev) => (prev?.id === selectedEmployee.id ? { ...prev, module_access: saved } : prev))
                                setEditableModuleAccess(saved)
                                sonnerToast.success('Module access saved')
                              } else {
                                sonnerToast.error('Failed to save module access')
                              }
                            } catch (e) {
                              const msg = e instanceof Error ? e.message : 'Failed to save module access'
                              sonnerToast.error(msg)
                            } finally {
                              setModuleAccessSaving(false)
                            }
                          }}
                        >
                          {moduleAccessSaving ? 'Saving…' : 'Save module access'}
                        </Button>
                          </>
                        )}
                        <div className="mt-4">
                          <ModuleAccessBadges
                            access={
                              Array.isArray(selectedEmployee?.module_access) &&
                              selectedEmployee.module_access.length > 0
                                ? selectedEmployee.module_access
                                : ['employee']
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>

                    {selectedEmployee && (
                      <Card className="overflow-hidden">
                        <CardContent className="px-6 py-4">
                          <ModuleDiscussion
                            contextType="employee"
                            contextId={selectedEmployee.id}
                            title="Employee discussion"
                          />
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  <TabsContent value="performance" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Performance Reviews</CardTitle>
                        <p className="text-sm text-muted-foreground">Historical performance data</p>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {performanceReviews
                          .filter(review => review.employee_id === selectedEmployee.id)
                          .length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No performance reviews yet</p>
                          </div>
                        ) : (
                          performanceReviews
                            .filter(review => review.employee_id === selectedEmployee.id)
                            .map((review) => (
                              <div key={review.id} className="p-4 border rounded-lg">
                                <div className="flex items-center justify-between mb-4">
                                  <div>
                                    <p className="text-base font-medium">Review Period: {review.review_period}</p>
                                    <p className="text-sm text-muted-foreground">{formatDateOnly(review.review_date)}</p>
                                  </div>
                                  <Badge variant={review.status === 'on-time' ? 'default' : 'secondary'} className="text-sm flex-shrink-0">
                                    {review.status}
                                  </Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Collaboration</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.collaboration }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Accountability</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.accountability }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Leadership</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.leadership }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-sm text-muted-foreground mb-2">Trustworthy</p>
                                    <div className="flex items-center gap-1">
                                      {Array.from({ length: review.trustworthy }).map((_, i) => (
                                        <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="goals" className="mt-0 space-y-4">
                    {goals
                      .filter(goal => goal.employee_id === selectedEmployee.id)
                      .length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No goals assigned yet</p>
                      </div>
                    ) : (
                      goals
                        .filter(goal => goal.employee_id === selectedEmployee.id)
                        .map((goal) => (
                          <Card key={goal.id}>
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <CardTitle className="text-base truncate">{goal.goal}</CardTitle>
                                  <p className="text-sm text-muted-foreground mt-1 truncate">{goal.category}</p>
                                </div>
                                <Badge 
                                  variant="outline"
                                  className={`flex-shrink-0 text-sm ${
                                    goal.status === 'On Track' ? 'border-green-500 text-green-600 bg-green-500/10' :
                                    goal.status === 'Complete' ? 'border-blue-500 text-blue-600 bg-blue-500/10' :
                                    goal.status === 'Behind' ? 'border-red-500 text-red-600 bg-red-500/10' :
                                    ''
                                  }`}
                                >
                                  {goal.status}
                                </Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                <div className="flex items-center justify-between text-sm mb-2">
                                  <span className="text-muted-foreground">Progress</span>
                                  <span className="font-medium text-base">{goal.progress}%</span>
                                </div>
                                <Progress value={goal.progress} className="h-2" />
                                <div className="flex items-center justify-between text-sm text-muted-foreground pt-1">
                                  <span className="truncate">Due: {formatDateOnly(goal.due_date)}</span>
                                  <span className="truncate">Created: {formatDateOnly(goal.created_date)}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </TabsContent>

                  <TabsContent value="history" className="mt-0 space-y-4">
                    <Card>
                      <CardHeader className="pb-4">
                        <CardTitle className="text-lg">Review History</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Last Review</span>
                          <span className="font-medium">{selectedEmployee.last_review_date ? formatDateOnly(selectedEmployee.last_review_date) : 'N/A'}</span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Next Review</span>
                          <span className="font-medium">{selectedEmployee.next_review_date ? formatDateOnly(selectedEmployee.next_review_date) : 'Not scheduled'}</span>
                        </div>
                        <div className="flex items-center justify-between text-base">
                          <span className="text-muted-foreground">Review Cycle</span>
                          <span className="font-medium">Quarterly</span>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Feedback Dialog */}
        <Dialog
          open={
            isFeedbackDialogOpen &&
            !!selectedEmployee &&
            !isLoggedInUsersEmployee(selectedEmployee)
          }
          onOpenChange={(open) => {
            if (!open) setIsFeedbackDialogOpen(false)
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Give Feedback</DialogTitle>
              <DialogDescription>
                Provide feedback for {selectedEmployee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && !isLoggedInUsersEmployee(selectedEmployee) && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="feedback-type">Feedback Type</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recognition">Recognition</SelectItem>
                      <SelectItem value="improvement">Area for Improvement</SelectItem>
                      <SelectItem value="general">General Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="feedback-message">Feedback Message</Label>
                  <Textarea 
                    id="feedback-message"
                    placeholder="Write your feedback here..."
                    rows={6}
                  />
                </div>
                <div>
                  <Label>Visibility</Label>
                  <Select defaultValue="manager">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="employee">Visible to Employee</SelectItem>
                      <SelectItem value="manager">Manager Only</SelectItem>
                      <SelectItem value="hr">HR Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFeedbackDialogOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => {
                      if (selectedEmployee && isLoggedInUsersEmployee(selectedEmployee)) {
                        toast({
                          title: 'Not allowed',
                          description: 'You cannot give feedback to yourself.',
                          variant: 'destructive',
                        })
                        setIsFeedbackDialogOpen(false)
                        return
                      }
                      alert('Feedback submitted successfully!')
                      setIsFeedbackDialogOpen(false)
                    }}
                  >
                    Submit Feedback
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Employee Goals Dialog */}
        <Dialog open={isGoalsDialogOpen} onOpenChange={setIsGoalsDialogOpen}>
          <DialogContent size="xl" className="border-4">
            <DialogHeader>
              <DialogTitle>Employee Goals</DialogTitle>
              <DialogDescription>
                View and manage goals for {selectedEmployee?.name}
              </DialogDescription>
            </DialogHeader>
            {selectedEmployee && (
              <div className="space-y-4">
                {goals
                  .filter(goal => goal.employee_id === selectedEmployee.id)
                  .length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No goals assigned yet</p>
                  </div>
                ) : (
                  goals
                    .filter(goal => goal.employee_id === selectedEmployee.id)
                    .map((goal) => (
                      <Card key={goal.id}>
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-base">{goal.goal}</CardTitle>
                              <CardDescription className="mt-1">{goal.employee?.department || 'N/A'} • {goal.category}</CardDescription>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={
                                goal.status === 'On Track' ? 'border-green-500 text-green-600 bg-green-500/10' :
                                goal.status === 'Complete' ? 'border-blue-500 text-blue-600 bg-blue-500/10' :
                                goal.status === 'Behind' ? 'border-red-500 text-red-600 bg-red-500/10' :
                                ''
                              }
                            >
                              {goal.status}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">{goal.progress}%</span>
                            </div>
                            <Progress value={goal.progress} className="h-2" />
                            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                              <span>
                                <Calendar className="inline h-3 w-3 mr-1" />
                                Due: {formatDateOnly(goal.due_date)}
                              </span>
                              <span className="capitalize">{goal.category}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
                <DialogFooter className="pt-4">
                  <Button variant="outline" onClick={() => setIsGoalsDialogOpen(false)}>Close</Button>
                  <Button
                    onClick={() => {
                      setIsGoalsDialogOpen(false)
                      setIsAddGoalDialogOpen(true)
                    }}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add New Goal
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Review Details Dialog */}
        <Dialog open={isReviewDetailsOpen} onOpenChange={setIsReviewDetailsOpen}>
          <DialogContent size="lg">
            <DialogHeader>
              <DialogTitle>Performance Review Details</DialogTitle>
              <DialogDescription>
                Detailed performance review for {selectedReview?.employee?.name || 'Unknown Employee'}
              </DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-6">
                {/* Employee Info */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold">{selectedReview.employee?.name || 'Unknown Employee'}</h3>
                        <p className="text-sm text-muted-foreground">{selectedReview.employee?.department || 'N/A'}</p>
                      </div>
                      <div className="text-right">
                        <div className={`text-3xl font-bold ${getRatingColor(Number(calculateOverallRating(selectedReview)))}`}>
                          {calculateOverallRating(selectedReview)}
                        </div>
                        <p className="text-xs text-muted-foreground">Overall Rating</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Performance Ratings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Ratings</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Collaboration</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.collaboration)}`}>
                            {selectedReview.collaboration}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.collaboration ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Accountability</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.accountability)}`}>
                            {selectedReview.accountability}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.accountability ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Trustworthy</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.trustworthy)}`}>
                            {selectedReview.trustworthy}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.trustworthy ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="p-4 border rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Leadership</p>
                        <div className="flex items-center gap-2">
                          <div className={`text-2xl font-bold ${getRatingColor(selectedReview.leadership)}`}>
                            {selectedReview.leadership}
                          </div>
                          <div className="flex gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} className={`w-4 h-4 ${i < selectedReview.leadership ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300'}`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Review Timeline */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Review Timeline</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Latest Review</span>
                      <span className="text-sm font-medium">{formatDateOnly(selectedReview.review_date)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Review Period</span>
                      <span className="text-sm font-medium">{selectedReview.review_period}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Status</span>
                      {getReviewStatusBadge(selectedReview.status)}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Trend</span>
                      <div className="flex items-center gap-2">
                        {getTrendIcon(selectedReview.trend)}
                        <span className="text-sm capitalize">{selectedReview.trend}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewDetailsOpen(false)}>Close</Button>
              <Button onClick={() => {
                setIsReviewDetailsOpen(false)
                setIsAddReviewDialogOpen(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Review Dialog */}
        <AddReviewDialog
          open={isAddReviewDialogOpen}
          onOpenChange={setIsAddReviewDialogOpen}
          employees={employees}
          preselectedEmployeeId={selectedReview?.employee_id || selectedEmployee?.id}
          onReviewAdded={loadData}
        />

        {/* Add Goal Dialog */}
        <AddGoalDialog
          open={isAddGoalDialogOpen}
          onOpenChange={setIsAddGoalDialogOpen}
          employees={
            scopeHrToSelf && loggedInEmployeeId
              ? employees.filter((e) => e.id === loggedInEmployeeId)
              : employees
          }
          preselectedEmployeeId={
            selectedEmployee?.id || selectedGoal?.employee_id || (scopeHrToSelf ? loggedInEmployeeId ?? undefined : undefined)
          }
          lockEmployee={!!selectedEmployee?.id || scopeHrToSelf}
          onGoalAdded={async () => {
            await loadData()
            if (selectedEmployee?.id) {
              setIsGoalsDialogOpen(true)
            }
          }}
        />

        {/* Add Learning Path Dialog */}
        <AddLearningPathDialog
          open={isAddLearningPathDialogOpen}
          onOpenChange={setIsAddLearningPathDialogOpen}
          employees={employees}
          courses={trainingCourses}
          onLearningPathAdded={loadData}
        />

        {/* Add Career Path Dialog */}
        <AddCareerPathDialog
          open={isAddCareerPathDialogOpen}
          onOpenChange={setIsAddCareerPathDialogOpen}
          employees={employees}
          onCareerPathAdded={loadData}
        />

        {/* Review History Dialog */}
        <Dialog open={isReviewHistoryOpen} onOpenChange={setIsReviewHistoryOpen}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>Review History</DialogTitle>
              <DialogDescription>
                Complete performance review history for {selectedReview?.employee?.name || 'Employee'}
              </DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                {/* Historical reviews */}
                {performanceReviews
                  .filter(review => review.employee_id === selectedReview.employee_id)
                  .length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No historical reviews available</p>
                  </div>
                ) : (
                  performanceReviews
                    .filter(review => review.employee_id === selectedReview.employee_id)
                    .map((review) => (
                      <Card key={review.id}>
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="font-semibold">{review.review_period}</h3>
                              <p className="text-sm text-muted-foreground">
                                {formatDateOnly(review.review_date)}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`text-2xl font-bold ${getRatingColor((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4)}`}>
                                {((review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4).toFixed(1)}
                              </div>
                              <p className="text-xs text-muted-foreground">Overall</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-4 gap-4">
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.collaboration)}`}>
                                {review.collaboration}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Collaboration</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.accountability)}`}>
                                {review.accountability}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Accountability</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.trustworthy)}`}>
                                {review.trustworthy}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Trustworthy</p>
                            </div>
                            <div className="text-center p-3 border rounded-lg">
                              <div className={`text-xl font-bold ${getRatingColor(review.leadership)}`}>
                                {review.leadership}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">Leadership</p>
                            </div>
                          </div>
                          <div className="mt-4 flex justify-end">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                setIsReviewHistoryOpen(false)
                                setIsReviewDetailsOpen(true)
                              }}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              View Full Review
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsReviewHistoryOpen(false)}>Close</Button>
              <Button onClick={() => {
                setIsReviewHistoryOpen(false)
                setIsAddReviewDialogOpen(true)
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Add New Review
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Goal Details Dialog */}
        <Dialog open={isGoalDetailsOpen} onOpenChange={setIsGoalDetailsOpen}>
          <DialogContent size="xl" className="overflow-y-auto overflow-x-hidden p-8">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl">Goal Details</DialogTitle>
              <DialogDescription>
                Detailed information and progress tracking for this goal
              </DialogDescription>
            </DialogHeader>
            {selectedGoal && (
              <div className="space-y-6 overflow-x-hidden">
                {/* Goal Header */}
                <Card className="border-2 min-w-0">
                  <CardContent className="pt-6 pb-6">
                    <div className="flex items-start justify-between gap-6 min-w-0">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-2xl font-bold mb-3 break-words">{selectedGoal.goal}</h3>
                        <div className="flex items-center gap-4 text-base text-muted-foreground flex-wrap">
                          <span className="font-medium">{selectedGoal.employee?.name || 'Unknown Employee'}</span>
                          <span>•</span>
                          <span>{selectedGoal.employee?.department || 'N/A'}</span>
                          <span>•</span>
                          <Badge variant="secondary" className="text-sm">{selectedGoal.category}</Badge>
                        </div>
                      </div>
                      <Badge className={getGoalStatusColor(selectedGoal.status) + " text-base px-4 py-2 flex-shrink-0"}>
                        {getGoalStatusIcon(selectedGoal.status)}
                        <span className="ml-2 whitespace-nowrap">{selectedGoal.status}</span>
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-6 min-w-0 overflow-hidden">
                  {/* Left Column */}
                  <div className="space-y-6 min-w-0">
                    {/* Progress Card */}
                    <Card className="min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Progress</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="flex items-center justify-between flex-wrap gap-3">
                          <span className="text-base text-muted-foreground whitespace-nowrap">Current Progress</span>
                          <span className="text-5xl font-bold">{selectedGoal.progress}%</span>
                        </div>
                        <Progress value={selectedGoal.progress} className="h-4" />
                        <div className="grid grid-cols-2 gap-4 pt-3 min-w-0">
                          <div className="p-4 border rounded-lg min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">Created</p>
                            <p className="text-base font-medium break-words">{formatDateOnly(selectedGoal.created_date)}</p>
                          </div>
                          <div className="p-4 border rounded-lg min-w-0">
                            <p className="text-sm text-muted-foreground mb-2">Due Date</p>
                            <p className="text-base font-medium break-words">{formatDateOnly(selectedGoal.due_date)}</p>
                            <p className="text-sm text-muted-foreground mt-1 break-words">{getDaysUntilDue(selectedGoal.due_date)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Goal Timeline */}
                    <Card className="min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Timeline & Milestones</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-5">
                          {/* Timeline */}
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-semibold text-base break-words">Goal Created</h4>
                              <p className="text-base text-muted-foreground break-words">{formatDateOnly(selectedGoal.created_date)}</p>
                            </div>
                          </div>
                          <div className="text-center py-4 text-muted-foreground text-sm">
                            Timeline milestones will appear here as progress is tracked
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column */}
                  <div className="min-w-0">
                    {/* Comments Section */}
                    <Card className="h-full min-w-0 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-lg">Comments & Notes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Comments */}
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No comments yet</p>
                            <p className="text-xs mt-1">Comments will appear here as progress is tracked</p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="default" 
                            className="w-full mt-4"
                            onClick={() => {
                              setIsGoalDetailsOpen(false)
                              setIsAddCommentOpen(true)
                            }}
                          >
                            <Plus className="mr-2 h-5 w-5" />
                            Add Comment
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter className="gap-3">
              <Button variant="outline" size="lg" onClick={() => setIsGoalDetailsOpen(false)}>Close</Button>
              {selectedGoal && (
                <Button size="lg" onClick={() => {
                  setIsGoalDetailsOpen(false)
                  setEditingGoal(selectedGoal.id)
                  setGoalProgress(selectedGoal.progress)
                }}>
                  <Target className="mr-2 h-5 w-5" />
                  Update Progress
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Comment Dialog */}
        <Dialog open={isAddCommentOpen} onOpenChange={setIsAddCommentOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Comment</DialogTitle>
              <DialogDescription>
                Add a comment or note about this goal
              </DialogDescription>
            </DialogHeader>
            {selectedGoal && (
              <div className="space-y-4">
                {/* Goal Summary */}
                <Card>
                  <CardContent className="pt-4">
                    <h4 className="font-medium mb-1">{selectedGoal.goal}</h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{selectedGoal.employee?.name}</span>
                      <span>•</span>
                      <Badge className={getGoalStatusColor(selectedGoal.status)} variant="outline">
                        {selectedGoal.status}
                      </Badge>
                      <span>•</span>
                      <span>{selectedGoal.progress}% complete</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Comment Input */}
                <div>
                  <Label htmlFor="comment">Comment</Label>
                  <Textarea 
                    id="comment"
                    placeholder="Add your comment or notes here..."
                    rows={6}
                    value={goalComment}
                    onChange={(e) => setGoalComment(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    This comment will be visible to the employee and their manager.
                  </p>
                </div>

                {/* Comment Type */}
                <div>
                  <Label htmlFor="comment-type">Comment Type</Label>
                  <Select defaultValue="general">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Update</SelectItem>
                      <SelectItem value="feedback">Feedback</SelectItem>
                      <SelectItem value="milestone">Milestone Achieved</SelectItem>
                      <SelectItem value="concern">Concern/Blocker</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setIsAddCommentOpen(false)
                setGoalComment('')
              }}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  if (goalComment.trim()) {
                    alert("Comment added successfully!")
                    setIsAddCommentOpen(false)
                    setGoalComment('')
                  } else {
                    alert("Please enter a comment before submitting.")
                  }
                }}
                disabled={!goalComment.trim()}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                Add Comment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Mentorship Match Dialog */}
        <Dialog open={isCreateMatchOpen} onOpenChange={(open) => {
          setIsCreateMatchOpen(open)
          if (!open) {
            // Reset form when dialog closes
            setMentorshipForm({
              mentor_id: "",
              mentee_id: "",
              focus: "",
              match_score: 85,
              start_date: getTodayDateKey(),
              status: "active",
            })
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Mentorship Match</DialogTitle>
              <DialogDescription>
                Connect a mentor with a mentee to facilitate professional development
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="mentor">Select Mentor *</Label>
                <Select
                  value={mentorshipForm.mentor_id}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, mentor_id: value })}
                >
                  <SelectTrigger id="mentor">
                    <SelectValue placeholder="Choose mentor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.position}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="mentee">Select Mentee *</Label>
                <Select
                  value={mentorshipForm.mentee_id}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, mentee_id: value })}
                >
                  <SelectTrigger id="mentee">
                    <SelectValue placeholder="Choose mentee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees
                        .filter(emp => emp.id !== mentorshipForm.mentor_id)
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} - {emp.position}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="focus-area">Focus Area *</Label>
                <Select
                  value={mentorshipForm.focus}
                  onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, focus: value })}
                >
                  <SelectTrigger id="focus-area">
                    <SelectValue placeholder="Select focus area..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Technical Skills">Technical Skills</SelectItem>
                    <SelectItem value="Leadership Development">Leadership Development</SelectItem>
                    <SelectItem value="Communication Skills">Communication Skills</SelectItem>
                    <SelectItem value="Career Growth">Career Growth</SelectItem>
                    <SelectItem value="Project Management">Project Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="match-score">Match Score: {mentorshipForm.match_score}%</Label>
                  <Slider
                    id="match-score"
                    value={[mentorshipForm.match_score]}
                    onValueChange={(value) => setMentorshipForm({ ...mentorshipForm, match_score: value[0] })}
                    min={0}
                    max={100}
                    step={5}
                  />
                </div>
                <div>
                  <Label htmlFor="start-date">Start Date *</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={mentorshipForm.start_date}
                    onChange={(e) => setMentorshipForm({ ...mentorshipForm, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={mentorshipForm.status}
                  onValueChange={(value: any) => setMentorshipForm({ ...mentorshipForm, status: value })}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsCreateMatchOpen(false)}
                disabled={isSubmittingMentorship}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateMentorship}
                disabled={isSubmittingMentorship}
              >
                {isSubmittingMentorship ? "Creating..." : "Create Match"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Give Recognition Dialog */}
        <Dialog open={isGiveRecognitionOpen} onOpenChange={(open) => {
          setIsGiveRecognitionOpen(open)
          if (open && loggedInEmployeeId) {
            setRecognitionForm((prev) => ({
              ...prev,
              from_id: loggedInEmployeeId,
              to_id: prev.to_id === loggedInEmployeeId ? "" : prev.to_id,
            }))
          }
          if (!open) {
            // Reset form when dialog closes
            setRecognitionForm({
              from_id: "",
              to_id: "",
              type: "peer",
              category: "",
              message: "",
              recognition_date: getTodayDateKey(),
            })
          }
        }}>
          <DialogContent className="max-w-2xl">
            <form onSubmit={(e) => {
              e.preventDefault()
              handleCreateRecognition()
            }}>
              <DialogHeader>
                <DialogTitle>Give Recognition</DialogTitle>
                <DialogDescription>
                  Recognize team members for their contributions
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
              <div>
                <Label htmlFor="from">From *</Label>
                <Select
                  value={recognitionForm.from_id}
                  disabled={scopeHrToSelf}
                  onValueChange={(value) =>
                    setRecognitionForm((prev) => ({
                      ...prev,
                      from_id: value,
                      to_id: prev.to_id === value ? "" : prev.to_id,
                    }))
                  }
                >
                  <SelectTrigger id="from">
                    <SelectValue placeholder="Select your name..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 && csmUsers.length === 0 ? (
                      <SelectItem value="none" disabled>No users available</SelectItem>
                    ) : (
                      <>
                        {employees.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} - {emp.position}
                          </SelectItem>
                        ))}
                        {csmUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="to">To (Employee) *</Label>
                <Select
                  value={recognitionForm.to_id}
                  onValueChange={(value) => setRecognitionForm({ ...recognitionForm, to_id: value })}
                >
                  <SelectTrigger id="to">
                    <SelectValue placeholder="Select recipient..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees
                        .filter((emp) => !isLoggedInUsersEmployee(emp))
                        .map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name} - {emp.position}
                          </SelectItem>
                        ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="recognition-type">Recognition Type *</Label>
                  <Select
                    value={recognitionForm.type}
                    onValueChange={(value: any) => setRecognitionForm({ ...recognitionForm, type: value })}
                  >
                    <SelectTrigger id="recognition-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="peer">Peer Recognition</SelectItem>
                      <SelectItem value="manager">Manager Recognition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <Select
                    value={recognitionForm.category}
                    onValueChange={(value) => setRecognitionForm({ ...recognitionForm, category: value })}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Innovation">Innovation</SelectItem>
                      <SelectItem value="Excellence">Excellence</SelectItem>
                      <SelectItem value="Teamwork">Teamwork</SelectItem>
                      <SelectItem value="Leadership">Leadership</SelectItem>
                      <SelectItem value="Dedication">Dedication</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="message">Recognition Message *</Label>
                <Textarea
                  id="message"
                  placeholder="Write a meaningful recognition message..."
                  rows={4}
                  className="resize-none"
                  value={recognitionForm.message}
                  onChange={(e) => setRecognitionForm({ ...recognitionForm, message: e.target.value })}
                  required
                />
              </div>
              <div className="p-4 border rounded-lg bg-accent/30">
                <div className="flex items-center gap-2">
                  <ThumbsUp className="h-5 w-5 text-primary" />
                  <p className="text-sm">
                    Recognition will be visible to the recipient and their manager
                  </p>
                </div>
              </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGiveRecognitionOpen(false)}
                  disabled={isSubmittingRecognition}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingRecognition}
                >
                  <Award className="mr-2 h-4 w-4" />
                  {isSubmittingRecognition ? "Sending..." : "Send Recognition"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Schedule Interview Dialog */}
        <Dialog open={isScheduleInterviewOpen} onOpenChange={(open) => {
          setIsScheduleInterviewOpen(open)
          if (!open) {
            // Reset form when closing
            setInterviewCandidate('')
            setInterviewDate('')
            setInterviewTime('')
            setInterviewType('')
            setInterviewNotes('')
            setInterviewDownloadIcs(false)
            setInterviewEmailCandidate(false)
            setInterviewEditingId(null)
          }
        }}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{interviewEditingId ? 'Edit Interview' : 'Schedule Interview'}</DialogTitle>
              <DialogDescription>
                {interviewEditingId
                  ? 'Update the date, time, type, or notes for this interview. Saving keeps the candidate at their current pipeline stage.'
                  : 'Schedule an interview with a candidate'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label htmlFor="candidate">Select Candidate</Label>
                <Select
                  value={interviewCandidate}
                  onValueChange={setInterviewCandidate}
                  disabled={!!interviewEditingId}
                >
                  <SelectTrigger id="candidate">
                    <SelectValue placeholder="Choose candidate..." />
                  </SelectTrigger>
                  <SelectContent>
                    {applications.length === 0 ? (
                      <SelectItem value="none" disabled>No candidates available</SelectItem>
                    ) : (
                      applications.map((app, idx) => (
                        <SelectItem key={app.id || idx} value={app.id || `candidate-${idx}`}>
                          {app.anonymousId} - {app.jobTitle}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {interviewEditingId && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Editing the interview for this candidate. To move it to a different candidate, cancel and re-schedule.
                  </p>
                )}
                {!interviewEditingId && applications.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    No candidates yet. Open the Recruitment tab and either click <strong>Add Anonymous Candidate</strong> or have someone apply through the public Careers page. New applications will then appear in this list.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="interview-type">Interview Type</Label>
                <Select value={interviewType} onValueChange={setInterviewType}>
                  <SelectTrigger id="interview-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Screen</SelectItem>
                    <SelectItem value="technical">Technical Interview</SelectItem>
                    <SelectItem value="behavioral">Behavioral Interview</SelectItem>
                    <SelectItem value="final">Final Round</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="interview-date">Date</Label>
                  <Input 
                    id="interview-date" 
                    type="date" 
                    value={interviewDate}
                    onChange={(e) => setInterviewDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="interview-time">Time</Label>
                  <Input 
                    id="interview-time" 
                    type="time" 
                    value={interviewTime}
                    onChange={(e) => setInterviewTime(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="interview-notes">Notes</Label>
                <Textarea
                  id="interview-notes"
                  placeholder="Add interview type, interviewer name, and any special instructions..."
                  rows={3}
                  value={interviewNotes}
                  onChange={(e) => setInterviewNotes(e.target.value)}
                />
              </div>
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">After scheduling, also:</p>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="interview-download-ics"
                    checked={interviewDownloadIcs}
                    onCheckedChange={(checked) => setInterviewDownloadIcs(checked === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="interview-download-ics" className="cursor-pointer">
                      Download calendar invite (.ics)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Saves a calendar file you can import into Google / Outlook / Apple Calendar.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="interview-email-candidate"
                    checked={interviewEmailCandidate}
                    onCheckedChange={(checked) => setInterviewEmailCandidate(checked === true)}
                  />
                  <div className="space-y-0.5">
                    <Label htmlFor="interview-email-candidate" className="cursor-pointer">
                      Open an email draft to the candidate
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Opens your default mail app (or a new browser tab) with a pre-filled message. Requires the application to have an email on file.
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Both options are off by default. Leave them unchecked to silently save the interview to the database without any popups.
                </p>
              </div>
            </div>
            <DialogFooter className="flex-wrap gap-2 sm:justify-between">
              <div>
                {interviewEditingId && (
                  <Button
                    variant="destructive"
                    onClick={async () => {
                      if (!interviewEditingId) return
                      const ok = window.confirm('Cancel this interview? The candidate stays in the pipeline at "reviewing" status.')
                      if (!ok) return
                      const success = await cancelInterview(interviewEditingId)
                      if (success) {
                        sonnerToast.success('Interview canceled')
                        await loadData()
                        setIsScheduleInterviewOpen(false)
                      } else {
                        sonnerToast.error('Could not cancel interview. Please try again.')
                      }
                    }}
                  >
                    Cancel Interview
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsScheduleInterviewOpen(false)}>
                {interviewEditingId ? 'Close' : 'Cancel'}
              </Button>
              <Button 
                onClick={async () => {
                  if (!interviewCandidate || !interviewDate) {
                    sonnerToast.error('Please select a candidate and date')
                    return
                  }
                  
                  try {
                    // Combine notes with interview details
                    const fullNotes = `Interview Type: ${interviewType || 'Not specified'}\nTime: ${interviewTime || 'Not specified'}\n\n${interviewNotes}`
                    // When a time was provided, persist the full ISO so the
                    // calendar can render hour/minute. Otherwise store the
                    // bare date string for backwards compatibility.
                    const persistedInterviewDate = interviewTime
                      ? parseLocalInterviewDateTime(interviewDate, interviewTime).toISOString()
                      : interviewDate

                    const success = await scheduleInterview(
                      interviewCandidate,
                      persistedInterviewDate,
                      fullNotes,
                      { preserveStatus: !!interviewEditingId },
                    )
                    
                    if (success) {
                      const app = applications.find((a) => a.id === interviewCandidate)
                      const start = parseLocalInterviewDateTime(interviewDate, interviewTime)
                      const end = new Date(start.getTime() + 60 * 60 * 1000)
                      const title = app
                        ? `Interview: ${app.anonymousId} — ${app.jobTitle}`
                        : 'Interview'
                      const description = `${fullNotes}\n\n— Scheduled from Katana HR`

                      let icsDownloaded = false
                      if (interviewDownloadIcs) {
                        const ics = buildInterviewIcs({ title, description, start, end })
                        downloadIcsFile(
                          `interview-${(app?.anonymousId ?? 'candidate').replace(/[^a-zA-Z0-9-_]+/g, '-')}`,
                          ics,
                        )
                        icsDownloaded = true
                      }

                      let emailOpened = false
                      if (interviewEmailCandidate && app?.email) {
                        const subject = title
                        const body = `Hi ${app.firstName || 'there'},\n\nYou are scheduled for an interview.\n\n${fullNotes}\n\nCalendar (.ics) file should be attached or use the Google Calendar link from the recruiter.\n`
                        const mailHref = buildInterviewMailtoHref(app.email, subject, body)
                        const m = document.createElement('a')
                        m.href = mailHref
                        m.target = '_blank'
                        m.rel = 'noopener noreferrer'
                        document.body.appendChild(m)
                        m.click()
                        m.remove()
                        emailOpened = true
                      }

                      const extras: string[] = []
                      if (icsDownloaded) extras.push('downloaded calendar invite (.ics)')
                      if (emailOpened) extras.push('opened email draft to candidate')
                      else if (interviewEmailCandidate && !app?.email) {
                        extras.push('skipped email (no candidate email on file)')
                      }

                      sonnerToast.success(interviewEditingId ? 'Interview updated' : 'Interview scheduled', {
                        description: extras.length > 0 ? `Also ${extras.join(' and ')}.` : 'Saved to the database.',
                      })
                      await loadData() // Refresh the data
                      setIsScheduleInterviewOpen(false)
                    } else {
                      sonnerToast.error(interviewEditingId ? 'Failed to update interview. Please try again.' : 'Failed to schedule interview. Please try again.')
                    }
                  } catch (error) {
                    console.error('Error scheduling interview:', error)
                    sonnerToast.error('An error occurred. Please try again.')
                  }
                }}
                disabled={!interviewCandidate || !interviewDate}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {interviewEditingId ? 'Save Changes' : 'Schedule Interview'}
              </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send 360° Feedback Dialog */}
        <Dialog open={isSend360FeedbackOpen} onOpenChange={setIsSend360FeedbackOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Send 360° Feedback Request</DialogTitle>
              <DialogDescription>
                Request comprehensive feedback from multiple sources
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 mt-4">
              <div>
                <Label htmlFor="feedback-subject">Feedback Subject</Label>
                <Select>
                  <SelectTrigger id="feedback-subject">
                    <SelectValue placeholder="Select employee..." />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.length === 0 ? (
                      <SelectItem value="none" disabled>No employees available</SelectItem>
                    ) : (
                      employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name} - {emp.department}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select Feedback Providers</Label>
                <div className="space-y-2 mt-2">
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="manager" className="rounded" />
                    <Label htmlFor="manager">Manager</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="peers" className="rounded" />
                    <Label htmlFor="peers">Peers</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="direct-reports" className="rounded" />
                    <Label htmlFor="direct-reports">Direct Reports</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input type="checkbox" id="self" className="rounded" />
                    <Label htmlFor="self">Self Assessment</Label>
                  </div>
                </div>
              </div>
              <div>
                <Label htmlFor="feedback-deadline">Deadline</Label>
                <Input id="feedback-deadline" type="date" />
              </div>
              <div>
                <Label htmlFor="feedback-instructions">Instructions</Label>
                <Textarea
                  id="feedback-instructions"
                  placeholder="Provide instructions or context for feedback providers..."
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSend360FeedbackOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                alert("360° feedback request sent successfully!")
                setIsSend360FeedbackOpen(false)
              }}>
                <MessageSquare className="mr-2 h-4 w-4" />
                Send Request
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approve Time Off Dialog */}
        <Dialog open={isApproveTimeOffOpen} onOpenChange={setIsApproveTimeOffOpen}>
          <DialogContent size="md">
            <DialogHeader>
              <DialogTitle>Approve Time Off Requests</DialogTitle>
              <DialogDescription>
                Review and decide pending time off requests submitted by employees.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              {timeOffLoading ? (
                <div className="text-sm text-muted-foreground py-6 text-center">
                  Loading pending requests...
                </div>
              ) : pendingTimeOff.length === 0 ? (
                <div className="border rounded-lg p-6 text-center space-y-2">
                  <p className="text-sm font-medium">No pending time off requests</p>
                  <p className="text-xs text-muted-foreground">
                    Requests submitted by employees from the Employee Portal will appear here for approval.
                  </p>
                </div>
              ) : (
                pendingTimeOff.map((req) => {
                  const start = new Date(req.start_date)
                  const end = new Date(req.end_date)
                  const dayMs = 24 * 60 * 60 * 1000
                  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1)
                  const note = timeOffNotes[req.id] ?? ''
                  const working = timeOffWorkingId === req.id
                  return (
                    <div key={req.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold truncate">{req.employee?.name ?? 'Unknown employee'}</h4>
                          <p className="text-sm text-muted-foreground truncate">
                            {req.employee?.department ?? ''}
                          </p>
                        </div>
                        <Badge>Pending</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Type</p>
                          <p className="font-medium">{req.type}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Duration</p>
                          <p className="font-medium">{days} day{days === 1 ? '' : 's'}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Start Date</p>
                          <p className="font-medium">{start.toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">End Date</p>
                          <p className="font-medium">{end.toLocaleDateString()}</p>
                        </div>
                      </div>
                      {req.reason && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-1">Reason</p>
                          <p className="text-sm whitespace-pre-wrap">{req.reason}</p>
                        </div>
                      )}
                      <div>
                        <Label htmlFor={`notes-${req.id}`}>Manager Notes (Optional)</Label>
                        <Textarea
                          id={`notes-${req.id}`}
                          placeholder="Add any notes about this decision..."
                          rows={2}
                          value={note}
                          onChange={(e) => setTimeOffNotes((prev) => ({ ...prev, [req.id]: e.target.value }))}
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={working}
                          onClick={async () => {
                            setTimeOffWorkingId(req.id)
                            const updated = await hrApi.decideTimeOffRequest(req.id, 'Denied', note || undefined)
                            setTimeOffWorkingId(null)
                            if (updated) {
                              sonnerToast.success('Time off request denied')
                              setPendingTimeOff((prev) => prev.filter((r) => r.id !== req.id))
                            } else {
                              sonnerToast.error('Failed to update request')
                            }
                          }}
                        >
                          Deny
                        </Button>
                        <Button
                          size="sm"
                          disabled={working}
                          onClick={async () => {
                            setTimeOffWorkingId(req.id)
                            const updated = await hrApi.decideTimeOffRequest(req.id, 'Approved', note || undefined)
                            setTimeOffWorkingId(null)
                            if (updated) {
                              sonnerToast.success('Time off request approved')
                              setPendingTimeOff((prev) => prev.filter((r) => r.id !== req.id))
                            } else {
                              sonnerToast.error('Failed to update request')
                            }
                          }}
                        >
                          <FileCheck className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApproveTimeOffOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AssignTrainingDialog
          open={isAssignTrainingOpen}
          onOpenChange={setIsAssignTrainingOpen}
          employees={employees}
          courses={trainingCourses}
          onAssigned={loadData}
          onManageCourses={() => {
            setIsAssignTrainingOpen(false)
            setIsManageCoursesOpen(true)
          }}
        />

        <ManageTrainingCoursesDialog
          open={isManageCoursesOpen}
          onOpenChange={setIsManageCoursesOpen}
          onCoursesChanged={async () => {
            const courses = await hrApi.getTrainingCourses(false)
            setTrainingCourses(courses)
          }}
        />


        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Selected Employees?</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedEmployees.length} employee(s)? This action cannot be undone and will permanently remove their records from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog
          open={bulkDeleteTarget != null}
          onOpenChange={(open) => {
            if (!open) setBulkDeleteTarget(null)
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {bulkDeleteTarget === 'reviews' && 'Delete Selected Reviews?'}
                {bulkDeleteTarget === 'goals' && 'Delete Selected Goals?'}
                {bulkDeleteTarget === 'mentorships' && 'Delete Selected Mentorships?'}
                {bulkDeleteTarget === 'recognitions' && 'Delete Selected Recognitions?'}
                {bulkDeleteTarget === 'learningPaths' && 'Delete Selected Learning Paths?'}
                {bulkDeleteTarget === 'careerPaths' && 'Delete Selected Career Paths?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete{' '}
                {bulkDeleteTarget === 'reviews' && `${selectedReviews.size} review(s)`}
                {bulkDeleteTarget === 'goals' && `${selectedGoals.size} goal(s)`}
                {bulkDeleteTarget === 'mentorships' && `${selectedMentorships.size} mentorship(s)`}
                {bulkDeleteTarget === 'recognitions' && `${selectedRecognitions.size} recognition(s)`}
                {bulkDeleteTarget === 'learningPaths' && `${selectedLearningPaths.size} learning path(s)`}
                {bulkDeleteTarget === 'careerPaths' && `${selectedCareerPaths.size} career path(s)`}
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  const target = bulkDeleteTarget
                  setBulkDeleteTarget(null)
                  if (target === 'reviews') void handleDeleteSelectedReviews()
                  else if (target === 'goals') void handleDeleteSelectedGoals()
                  else if (target === 'mentorships') void handleDeleteSelectedMentorships()
                  else if (target === 'recognitions') void handleDeleteSelectedRecognitions()
                  else if (target === 'learningPaths') void handleDeleteSelectedLearningPaths()
                  else if (target === 'careerPaths') void handleDeleteSelectedCareerPaths()
                }}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Candidate Details Dialog */}
        <Dialog open={isCandidateDetailsOpen} onOpenChange={setIsCandidateDetailsOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Application Status</DialogTitle>
              <DialogDescription>
                {selectedCandidate?.anonymousId} - {selectedCandidate?.jobTitle}
              </DialogDescription>
            </DialogHeader>
            {selectedCandidate && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <Badge 
                    variant={
                      selectedCandidate.status === 'new' ? 'secondary' :
                      selectedCandidate.status === 'reviewing' ? 'default' :
                      selectedCandidate.status === 'interviewed' || selectedCandidate.status === 'interview-scheduled' ? 'outline' :
                      selectedCandidate.status === 'offer' ? 'default' :
                      'secondary'
                    }
                    className="text-base px-3 py-1"
                  >
                    {selectedCandidate.status.replace('-', ' ')}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Anonymous ID</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.anonymousId}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Position Applied</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.jobTitle}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Department</Label>
                    <p className="text-base font-medium mt-1">{selectedCandidate.department}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Applied Date</Label>
                    <p className="text-base font-medium mt-1">
                      {formatDateOnly(selectedCandidate.appliedDate)}
                    </p>
                  </div>
                  {selectedCandidate.interviewDate && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Interview Date</Label>
                      <p className="text-base font-medium mt-1">
                        {formatDateOnly(selectedCandidate.interviewDate)}
                      </p>
                    </div>
                  )}
                  {selectedCandidate.rating && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Rating</Label>
                      <div className="flex items-center gap-1 mt-1">
                        {Array.from({ length: selectedCandidate.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCandidateDetailsOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MotionPage>
  )
}
