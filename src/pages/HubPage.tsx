import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  FolderKanban,
  Package,
  Users,
  Briefcase,
  UserCheck,
  Bot,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Activity,
  CheckCircle2,
  Settings,
  ChevronDown,
  ChevronUp,
  BarChart3,
  GripVertical,
  Check,
  X,
  LineChart,
  LifeBuoy,
  LayoutGrid,
  Eye,
  EyeOff,
  MessageSquare,
  Swords,
  Landmark,
  AlertCircle,
  PenLine,
} from 'lucide-react'
import * as ProjectData from '@/lib/project-data-supabase'
import type { Project } from '@/lib/project-data'
import * as CSApi from '@/lib/customer-success-api'
import * as CrmApi from '@/lib/customer-crm-api'
import * as HRApi from '@/lib/hr-api'
import * as WfmApi from '@/lib/wfm-api'
import * as InventoryApi from '@/lib/inventory-api'
import * as SupportApi from '@/lib/support-api'
import * as KyiApi from '@/lib/kyi-api'
import { getAllChannels, getConversations } from '@/lib/comms-api'
import { getDashboardSummary } from '@/lib/finance-api'
import { getMissingHubToolModules } from '@/lib/hub-module-registry'
import type { FinDashboardSummary } from '@/lib/finance-types'
import { getRecentProjectActivities } from '@/lib/supabase-api'
import { buildHubActivityFeed } from '@/lib/hub-activity'
import {
  buildHubMetricsBundle,
  deriveHubInventoryMetrics,
  deriveHubSupportMetrics,
  deriveHubWfmMetrics,
} from '@/lib/hub-metrics'
import { workforceTabPath } from '@/lib/wfm-deep-links'
import { resolveWfmTerminology } from '@/lib/wfm-settings'
import { useAuth } from '@/contexts/AuthContext'
import { getAllJobs, getAllApplications } from '@/lib/recruitment-db'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import {
  HubProfileSetupSection,
  HubPerformanceOverviewSection,
  HubKeyMetricsSection,
} from '@/components/hub/HubDashboardSections'
import { HubSectionFrame } from '@/components/hub/HubSectionFrame'
import { HubActivityFeed, type HubFeedActivity } from '@/components/hub/HubActivityFeed'
import {
  loadHubLayout,
  saveHubLayout,
  resetHubLayout,
  resolveHubSectionsForDisplay,
  reorderHubSections,
  toggleHubSectionHidden,
  isHubSectionHidden,
  HUB_SECTION_META,
  type HubSectionId,
  type HubLayoutPreferences,
} from '@/lib/hub-layout'
import { useReorderList } from '@/hooks/useReorderList'
import { HubQuickSearchDialog } from '@/components/hub/HubQuickSearchDialog'
import { HubQuickCreateDialog } from '@/components/hub/HubQuickCreateDialog'
import { EmployeePortalLaunchpadLink } from '@/components/employee/EmployeePortalLaunchpadLink'
import { OnboardingTourButton } from '@/components/tour/onboarding-tour-button'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
import {
  loadHubSettings,
  saveHubSettings,
  getHubLayoutClasses,
  getHubRefreshIntervalMs,
  formatHubLastSync,
  getHubRefreshIntervalLabel,
  normalizeHubSettings,
  type HubUserSettings,
} from '@/lib/hub-settings'
import { cn } from '@/lib/utils'

export default function HubPage() {
  useModuleTour('hub')
  const { loading: authLoading, user, organization } = useAuth()
  const { hasModuleAccess, allowedModules, loading: moduleAccessLoading, orgEnabledModules } = useModuleAccess()
  const [hubSettings, setHubSettings] = useState<HubUserSettings>(() => loadHubSettings())
  const [refreshTrigger, setRefreshTrigger] = useState<number | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [syncClock, setSyncClock] = useState(() => Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [csClients, setCSClients] = useState<any[]>([])
  const [employees, setEmployees] = useState<any[]>([])
  const [performanceReviews, setPerformanceReviews] = useState<any[]>([])
  const [goals, setGoals] = useState<any[]>([])
  const [jobPostings, setJobPostings] = useState<any[]>([])
  const [jobApplications, setJobApplications] = useState<any[]>([])
  const [feedActivities, setFeedActivities] = useState<HubFeedActivity[]>([])
  const [wfmJobs, setWfmJobs] = useState<Awaited<ReturnType<typeof WfmApi.getJobs>>>([])
  const [wfmTechnicians, setWfmTechnicians] = useState<Awaited<ReturnType<typeof WfmApi.getTechnicians>>>([])
  const [wfmTimesheets, setWfmTimesheets] = useState<Awaited<ReturnType<typeof WfmApi.getTimesheets>>>([])
  const [purchaseOrders, setPurchaseOrders] = useState<Awaited<ReturnType<typeof InventoryApi.getPurchaseOrders>>>([])
  const [supportSubmissions, setSupportSubmissions] = useState<Awaited<ReturnType<typeof SupportApi.getAllSubmissions>>>([])
  const [kyiCompanies, setKyiCompanies] = useState<Awaited<ReturnType<typeof KyiApi.getRecentKyiCompanies>>>([])
  const [financeSummary, setFinanceSummary] = useState<FinDashboardSummary | null>(null)
  const [commsChannelCount, setCommsChannelCount] = useState(0)
  const [commsConversationCount, setCommsConversationCount] = useState(0)
  const [inventoryStats, setInventoryStats] = useState({
    totalItems: 0,
    lowStockItems: 0,
    outOfStockItems: 0,
    totalValue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hubDataLoadFailed, setHubDataLoadFailed] = useState(false)
  const hubFailureToastShownRef = useRef(false)
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set())
  const [isCustomizeMode, setIsCustomizeMode] = useState(false)
  const [hubLayout, setHubLayout] = useState<HubLayoutPreferences>(() => loadHubLayout())
  const [moduleOrder, setModuleOrder] = useState<number[]>(() => {
    // Load saved order from localStorage
    const saved = localStorage.getItem('katana_hub_module_order')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return []
      }
    }
    return []
  })
  const [draggedModuleIndex, setDraggedModuleIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const draggedIndexRef = useRef<number | null>(null)

  // Handle drag and drop for modules using refs to avoid stale closure issues
  const handleModuleDragStart = useCallback((index: number) => {
    if (!isCustomizeMode) return
    setDraggedModuleIndex(index)
    draggedIndexRef.current = index
  }, [isCustomizeMode])

  const handleModuleDragEnter = useCallback((index: number) => {
    if (!isCustomizeMode) return
    const fromIndex = draggedIndexRef.current
    if (fromIndex === null || fromIndex === index) {
      setDragOverIndex(index)
      return
    }

    setDragOverIndex(index)
    setModuleOrder(prev => {
      const newOrder = [...prev]
      const draggedItem = newOrder[fromIndex]
      if (draggedItem === undefined) return prev
      newOrder.splice(fromIndex, 1)
      newOrder.splice(index, 0, draggedItem)
      return newOrder
    })
    setDraggedModuleIndex(index)
    draggedIndexRef.current = index
  }, [isCustomizeMode])

  const handleModuleDragEnd = useCallback(() => {
    setDraggedModuleIndex(null)
    setDragOverIndex(null)
    draggedIndexRef.current = null
  }, [])

  // Keyboard navigation for module reordering
  const handleModuleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    if (!isCustomizeMode) return

    if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault()
      setModuleOrder(prev => {
        const newOrder = [...prev]
        const temp = newOrder[currentIndex]
        newOrder[currentIndex] = newOrder[currentIndex - 1]
        newOrder[currentIndex - 1] = temp
        return newOrder
      })
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setModuleOrder(prev => {
        if (currentIndex >= prev.length - 1) return prev
        const newOrder = [...prev]
        const temp = newOrder[currentIndex]
        newOrder[currentIndex] = newOrder[currentIndex + 1]
        newOrder[currentIndex + 1] = temp
        return newOrder
      })
    }
  }, [isCustomizeMode])

  const displaySections = useMemo(
    () => resolveHubSectionsForDisplay(hubLayout, isCustomizeMode),
    [hubLayout, isCustomizeMode]
  )

  const {
    draggedIndex: draggedSectionIndex,
    handleDragStart: handleSectionDragStart,
    handleDragEnter: handleSectionDragEnter,
    handleDragEnd: handleSectionDragEnd,
    handleKeyDown: handleSectionKeyDown,
  } = useReorderList(displaySections)

  const reorderDisplayedSections = useCallback((fromIndex: number, toIndex: number) => {
    setHubLayout((prev) => {
      const visible = resolveHubSectionsForDisplay(prev, true)
      const nextVisible = reorderHubSections(visible, fromIndex, toIndex)
      const hidden = prev.hiddenSections
      const hiddenSet = new Set(hidden)
      const nextOrder = [
        ...nextVisible,
        ...prev.sectionOrder.filter((id) => hiddenSet.has(id) && !nextVisible.includes(id)),
      ]
      return { ...prev, sectionOrder: nextOrder }
    })
  }, [])

  const handleToggleSectionHidden = useCallback((sectionId: HubSectionId) => {
    setHubLayout((prev) => toggleHubSectionHidden(prev, sectionId))
  }, [])

  useEffect(() => {
    // Don't load data while auth / module access is still loading
    if (authLoading || moduleAccessLoading) {
      return
    }

    const loadAllData = async () => {
      const isBackgroundRefresh = !isInitialLoad
      try {
        if (isInitialLoad) setLoading(true)
        else setIsRefreshing(true)
        
        // Use Promise.allSettled to prevent one failure from blocking others
        // Also add timeouts to prevent hanging
        const timeout = (ms: number) => new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), ms)
        )
        
        const withTimeout = <T,>(promise: Promise<T>, ms: number = 5000): Promise<T> => 
          Promise.race([promise, timeout(ms)]) as Promise<T>

        const loadIf = <T,>(enabled: boolean, promise: Promise<T>): Promise<T | null> =>
          enabled ? withTimeout(promise) : Promise.resolve(null)

        const hasProjects = hasModuleAccess('projects')
        const hasCustomers = hasModuleAccess('customer-success')
        const hasHr = hasModuleAccess('hr')
        const hasCareers = hasModuleAccess('careers') || hasHr
        const hasWorkforce = hasModuleAccess('workforce')
        const hasInventory = hasModuleAccess('inventory')
        const hasSupport = hasModuleAccess('support')
        const hasKyi = hasModuleAccess('kyi')
        const hasFinance = hasModuleAccess('finance') && orgEnabledModules.includes('finance')
        const hasComms = hasModuleAccess('comms') && orgEnabledModules.includes('comms')
        
        // Load only enabled modules (avoids noise for scoped pilots)
        const [
          projectsResult,
          clientsResult,
          employeesResult,
          reviewsResult,
          goalsResult,
          jobsResult,
          appsResult,
          hrActivitiesResult,
          projectActivitiesResult,
          csInteractionsResult,
          csTasksResult,
          csMilestonesResult,
          csDealsResult,
          csLeadsResult,
          recognitionsResult,
          learningPathsResult,
          mentorshipsResult,
          wfmJobsResult,
          wfmTechniciansResult,
          wfmTimesheetsResult,
          inventoryMovementsResult,
          inventoryTransactionsResult,
          purchaseOrdersResult,
          supportSubmissionsResult,
          supportActivityResult,
          kyiCompaniesResult,
          inventoryStatsResult,
          financeSummaryResult,
          commsSummaryResult,
        ] = await Promise.allSettled([
          loadIf(hasProjects, ProjectData.getAllProjects()),
          loadIf(hasCustomers, CSApi.getAllClients()),
          loadIf(hasHr, HRApi.getAllEmployees()),
          loadIf(hasHr, HRApi.getAllPerformanceReviews()),
          loadIf(hasHr, HRApi.getAllGoals()),
          loadIf(hasCareers, getAllJobs()),
          loadIf(hasCareers, getAllApplications()),
          loadIf(hasHr, HRApi.getRecentActivities(75)),
          loadIf(hasProjects, getRecentProjectActivities(75)),
          loadIf(hasCustomers, CSApi.getRecentInteractions(75)),
          loadIf(hasCustomers, CSApi.getAllTasks()),
          loadIf(hasCustomers, CSApi.getAllMilestones()),
          loadIf(hasCustomers, CrmApi.getAllDeals()),
          loadIf(hasCustomers, CrmApi.getAllLeads()),
          loadIf(hasHr, HRApi.getAllRecognitions()),
          loadIf(hasHr, HRApi.getAllLearningPaths()),
          loadIf(hasHr, HRApi.getAllMentorships()),
          loadIf(hasWorkforce, WfmApi.getJobs()),
          loadIf(hasWorkforce, WfmApi.getTechnicians()),
          loadIf(hasWorkforce, WfmApi.getTimesheets()),
          loadIf(hasInventory, InventoryApi.getRecentInventoryMovements(75)),
          loadIf(hasInventory, InventoryApi.getRecentInventoryTransactions(75)),
          loadIf(hasInventory, InventoryApi.getPurchaseOrders()),
          loadIf(hasSupport, SupportApi.getAllSubmissions()),
          loadIf(hasSupport, SupportApi.getRecentSupportActivity(75)),
          loadIf(hasKyi, KyiApi.getRecentKyiCompanies(75)),
          loadIf(hasInventory, InventoryApi.getInventoryStats()),
          loadIf(hasFinance, getDashboardSummary()),
          loadIf(hasComms, Promise.all([getAllChannels(), getConversations()])),
        ])

        // Set data for successful fetches, use empty arrays for failures / disabled modules
        if (projectsResult.status === 'fulfilled') setProjects(projectsResult.value ?? [])
        if (clientsResult.status === 'fulfilled') setCSClients(clientsResult.value ?? [])
        if (employeesResult.status === 'fulfilled') setEmployees(employeesResult.value ?? [])
        if (reviewsResult.status === 'fulfilled') setPerformanceReviews(reviewsResult.value ?? [])
        if (goalsResult.status === 'fulfilled') setGoals(goalsResult.value ?? [])
        if (jobsResult.status === 'fulfilled') setJobPostings(jobsResult.value ?? [])
        if (appsResult.status === 'fulfilled') setJobApplications(appsResult.value ?? [])
        if (wfmJobsResult.status === 'fulfilled') setWfmJobs(wfmJobsResult.value ?? [])
        if (wfmTechniciansResult.status === 'fulfilled') setWfmTechnicians(wfmTechniciansResult.value ?? [])
        if (wfmTimesheetsResult.status === 'fulfilled') setWfmTimesheets(wfmTimesheetsResult.value ?? [])
        if (purchaseOrdersResult.status === 'fulfilled') setPurchaseOrders(purchaseOrdersResult.value ?? [])
        if (supportSubmissionsResult.status === 'fulfilled') setSupportSubmissions(supportSubmissionsResult.value ?? [])
        if (kyiCompaniesResult.status === 'fulfilled') setKyiCompanies(kyiCompaniesResult.value ?? [])
        if (inventoryStatsResult.status === 'fulfilled' && inventoryStatsResult.value) {
          setInventoryStats(inventoryStatsResult.value)
        }
        if (financeSummaryResult.status === 'fulfilled') setFinanceSummary(financeSummaryResult.value)
        if (commsSummaryResult.status === 'fulfilled' && commsSummaryResult.value) {
          setCommsChannelCount(commsSummaryResult.value[0].length)
          setCommsConversationCount(commsSummaryResult.value[1].length)
        } else if (commsSummaryResult.status === 'fulfilled') {
          setCommsChannelCount(0)
          setCommsConversationCount(0)
        }

        // Build activity feed from all modules (real data)
        const hrActivities = hrActivitiesResult.status === 'fulfilled' ? hrActivitiesResult.value ?? [] : []
        const projectActivities = projectActivitiesResult.status === 'fulfilled' ? projectActivitiesResult.value ?? [] : []
        const csClients = clientsResult.status === 'fulfilled' ? clientsResult.value ?? [] : []
        const csInteractions = csInteractionsResult.status === 'fulfilled' ? csInteractionsResult.value ?? [] : []
        const csTasks = csTasksResult.status === 'fulfilled' ? csTasksResult.value ?? [] : []
        const csMilestones = csMilestonesResult.status === 'fulfilled' ? csMilestonesResult.value ?? [] : []
        const csDeals = csDealsResult.status === 'fulfilled' ? csDealsResult.value ?? [] : []
        const csLeads = csLeadsResult.status === 'fulfilled' ? csLeadsResult.value ?? [] : []
        const employees = employeesResult.status === 'fulfilled' ? employeesResult.value ?? [] : []
        const reviews = reviewsResult.status === 'fulfilled' ? reviewsResult.value ?? [] : []
        const goals = goalsResult.status === 'fulfilled' ? goalsResult.value ?? [] : []
        const applications = appsResult.status === 'fulfilled' ? appsResult.value ?? [] : []

        setFeedActivities(
          buildHubActivityFeed({
            hrActivities,
            projectActivities,
            employees,
            reviews,
            goals,
            applications,
            recognitions: recognitionsResult.status === 'fulfilled' ? recognitionsResult.value ?? [] : [],
            learningPaths: learningPathsResult.status === 'fulfilled' ? learningPathsResult.value ?? [] : [],
            mentorships: mentorshipsResult.status === 'fulfilled' ? mentorshipsResult.value ?? [] : [],
            csClients,
            csInteractions,
            csTasks,
            csMilestones,
            csDeals,
            csLeads,
            wfmJobs: wfmJobsResult.status === 'fulfilled' ? wfmJobsResult.value ?? [] : [],
            wfmTechnicians: wfmTechniciansResult.status === 'fulfilled' ? wfmTechniciansResult.value ?? [] : [],
            wfmTimesheets: wfmTimesheetsResult.status === 'fulfilled' ? wfmTimesheetsResult.value ?? [] : [],
            inventoryMovements:
              inventoryMovementsResult.status === 'fulfilled' ? inventoryMovementsResult.value ?? [] : [],
            inventoryTransactions:
              inventoryTransactionsResult.status === 'fulfilled' ? inventoryTransactionsResult.value ?? [] : [],
            purchaseOrders: purchaseOrdersResult.status === 'fulfilled' ? purchaseOrdersResult.value ?? [] : [],
            supportSubmissions:
              supportSubmissionsResult.status === 'fulfilled' ? supportSubmissionsResult.value ?? [] : [],
            supportActivity: supportActivityResult.status === 'fulfilled' ? supportActivityResult.value ?? [] : [],
            kyiCompanies: kyiCompaniesResult.status === 'fulfilled' ? kyiCompaniesResult.value ?? [] : [],
          }),
        )

        // Only surface failures for modules this org/user actually has access to
        const relevantResults = [
          hasProjects ? projectsResult : null,
          hasCustomers ? clientsResult : null,
          hasHr ? employeesResult : null,
          hasHr ? reviewsResult : null,
          hasHr ? goalsResult : null,
          hasCareers ? jobsResult : null,
          hasCareers ? appsResult : null,
          hasHr ? hrActivitiesResult : null,
          hasProjects ? projectActivitiesResult : null,
          hasCustomers ? csInteractionsResult : null,
          hasCustomers ? csTasksResult : null,
          hasCustomers ? csMilestonesResult : null,
          hasCustomers ? csDealsResult : null,
          hasCustomers ? csLeadsResult : null,
          hasHr ? recognitionsResult : null,
          hasHr ? learningPathsResult : null,
          hasHr ? mentorshipsResult : null,
          hasWorkforce ? wfmJobsResult : null,
          hasWorkforce ? wfmTechniciansResult : null,
          hasWorkforce ? wfmTimesheetsResult : null,
          hasInventory ? inventoryMovementsResult : null,
          hasInventory ? inventoryTransactionsResult : null,
          hasInventory ? purchaseOrdersResult : null,
          hasSupport ? supportSubmissionsResult : null,
          hasSupport ? supportActivityResult : null,
          hasKyi ? kyiCompaniesResult : null,
          hasInventory ? inventoryStatsResult : null,
          hasFinance ? financeSummaryResult : null,
          hasComms ? commsSummaryResult : null,
        ]
        const relevantFailures = relevantResults.filter(
          (r): r is PromiseRejectedResult => r != null && r.status === 'rejected',
        )

        if (relevantFailures.length > 0) {
          console.warn('Some hub module data failed to load:', relevantFailures)
          setHubDataLoadFailed(true)
          if (!hubFailureToastShownRef.current) {
            hubFailureToastShownRef.current = true
            toast.error("Couldn't load some hub data")
          }
        } else {
          setHubDataLoadFailed(false)
        }
      } catch (err) {
        console.error('Error loading data:', err)
        setHubDataLoadFailed(true)
        if (!hubFailureToastShownRef.current) {
          hubFailureToastShownRef.current = true
          toast.error("Couldn't load some hub data")
        }
      } finally {
        setLoading(false)
        setIsRefreshing(false)
        if (isBackgroundRefresh || isInitialLoad) {
          setLastSyncedAt(Date.now())
          setSyncClock(Date.now())
        }
        if (isInitialLoad) setIsInitialLoad(false)
      }
    }

    loadAllData()

    // Listen for updates
    const handleProjectUpdate = () => loadAllData()
    const handleAppUpdate = () => loadAllData()
    
    window.addEventListener('projectDataUpdated', handleProjectUpdate)
    window.addEventListener('applicationSubmitted', handleAppUpdate)
    window.addEventListener('applicationUpdated', handleAppUpdate)
    
    return () => {
      window.removeEventListener('projectDataUpdated', handleProjectUpdate)
      window.removeEventListener('applicationSubmitted', handleAppUpdate)
      window.removeEventListener('applicationUpdated', handleAppUpdate)
    }
  }, [authLoading, moduleAccessLoading, user?.id, refreshTrigger, allowedModules, orgEnabledModules])

  // Auto-refresh when refresh interval is not manual
  useEffect(() => {
    const ms = getHubRefreshIntervalMs(hubSettings.refreshInterval)
    if (ms === null) return
    const id = setInterval(() => setRefreshTrigger(Date.now()), ms)
    return () => clearInterval(id)
  }, [hubSettings.refreshInterval])

  // Keep "Last sync" label current between refreshes
  useEffect(() => {
    const id = setInterval(() => setSyncClock(Date.now()), 15_000)
    return () => clearInterval(id)
  }, [])

  const layoutClasses = useMemo(
    () => getHubLayoutClasses(hubSettings.dashboardLayout),
    [hubSettings.dashboardLayout]
  )

  const persistHubSettings = useCallback((next: HubUserSettings) => {
    const normalized = normalizeHubSettings(next)
    saveHubSettings(normalized)
    setHubSettings(normalized)
  }, [])

  // Calculate real project metrics
  const projectMetrics = useMemo(() => {
    if (projects.length === 0) {
      return {
        completionRate: 0,
        overdueTasks: 0,
        totalTasks: 0,
        completedTasks: 0,
      }
    }

    const totalTasks = projects.reduce((sum, p) => sum + p.totalTasks, 0)
    const completedTasks = projects.reduce((sum, p) => sum + p.completedTasks, 0)
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    // Calculate overdue tasks
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const overdueTasks = projects.reduce((count, project) => {
      return count + project.tasks.filter(task => {
        if (!task.deadline || task.status === 'done') return false
        const taskDeadline = new Date(task.deadline)
        taskDeadline.setHours(0, 0, 0, 0)
        return taskDeadline < today
      }).length
    }, 0)

    return {
      completionRate,
      overdueTasks,
      totalTasks,
      completedTasks,
    }
  }, [projects])

  // Calculate Katana Customers metrics
  const csMetrics = useMemo(() => {
    if (csClients.length === 0) {
      return {
        avgHealthScore: 0,
        atRiskClients: 0,
        upcomingRenewals: 0,
        avgNPS: 0,
      }
    }

    const totalHealth = csClients.reduce((sum, c) => sum + (c.health_score || 0), 0)
    const avgHealthScore = Math.round(totalHealth / csClients.length)
    
    const atRiskClients = csClients.filter(c => c.status === 'at-risk').length
    
    // Count renewals in next 60 days
    const today = new Date()
    const sixtyDaysLater = new Date(today)
    sixtyDaysLater.setDate(today.getDate() + 60)
    const upcomingRenewals = csClients.filter(c => {
      if (!c.renewal_date) return false
      const renewalDate = new Date(c.renewal_date)
      return renewalDate >= today && renewalDate <= sixtyDaysLater
    }).length
    
    const totalNPS = csClients.reduce((sum, c) => sum + (c.nps_score || 0), 0)
    const avgNPS = Math.round(totalNPS / csClients.length)

    return {
      avgHealthScore,
      atRiskClients,
      upcomingRenewals,
      avgNPS,
    }
  }, [csClients])

  // Calculate HR metrics
  const hrMetrics = useMemo(() => {
    // Case-insensitive status check
    const activeEmployees = employees.filter(e => e.status?.toLowerCase() === 'active').length
    
    // Reviews due in next 30 days
    const today = new Date()
    const thirtyDaysLater = new Date(today)
    thirtyDaysLater.setDate(today.getDate() + 30)
    const reviewsDue = employees.filter(e => {
      if (!e.next_review_date) return false
      const reviewDate = new Date(e.next_review_date)
      return reviewDate >= today && reviewDate <= thirtyDaysLater
    }).length
    
    // Open job positions (handle TRUE as string from database)
    const openPositions = jobPostings.filter(j => 
      j.is_active === true || j.is_active === 'TRUE' || j.is_active === 'true'
    ).length
    
    // New applications (last 7 days)
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(today.getDate() - 7)
    const newApplications = jobApplications.filter(a => {
      const appliedDate = new Date(a.applied_date)
      return appliedDate >= sevenDaysAgo
    }).length
    
    const avgPerformance = HRApi.calculateAveragePerformanceScore(performanceReviews, employees)

    return {
      activeEmployees,
      reviewsDue,
      openPositions,
      newApplications,
      avgPerformance,
    }
  }, [employees, performanceReviews, jobPostings, jobApplications])

  const wfmMetrics = useMemo(
    () => deriveHubWfmMetrics(wfmJobs, wfmTechnicians, wfmTimesheets),
    [wfmJobs, wfmTechnicians, wfmTimesheets]
  )

  const wfmTerms = useMemo(
    () => resolveWfmTerminology((organization?.settings as Record<string, unknown> | undefined) ?? null),
    [organization?.settings],
  )

  const inventoryMetrics = useMemo(
    () =>
      deriveHubInventoryMetrics(
        {
          totalItems: inventoryStats.totalItems,
          lowStockItems: inventoryStats.lowStockItems,
          outOfStockItems: inventoryStats.outOfStockItems,
        },
        purchaseOrders
      ),
    [inventoryStats, purchaseOrders]
  )

  const supportMetrics = useMemo(
    () => deriveHubSupportMetrics(supportSubmissions),
    [supportSubmissions]
  )

  const hubMetrics = useMemo(
    () =>
      buildHubMetricsBundle(
        {
          projects,
          projectMetrics,
          csClients,
          csMetrics,
          hrMetrics,
          goals,
          jobApplications,
          purchaseOrders,
          supportSubmissions,
          kyiCompanies,
          inventoryMetrics,
          wfmMetrics,
          financeSummary,
        },
        allowedModules
      ),
    [
      projects,
      projectMetrics,
      csClients,
      csMetrics,
      hrMetrics,
      goals,
      jobApplications,
      purchaseOrders,
      supportSubmissions,
      kyiCompanies,
      inventoryMetrics,
      wfmMetrics,
      financeSummary,
      allowedModules,
    ]
  )

  const kpis = hubMetrics.kpis

  const modules = [
    {
      moduleId: 'projects' as const,
      name: 'Katana Projects',
      shortName: 'Projects',
      icon: FolderKanban,
      color: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
      metrics: [
        { label: 'Completion', value: `${projectMetrics.completionRate}%`, progress: projectMetrics.completionRate },
        { label: 'Overdue Tasks', value: projectMetrics.overdueTasks.toString(), status: projectMetrics.overdueTasks > 0 ? 'warning' : 'success' },
        { label: 'Active Projects', value: projects.filter(p => p.status === 'active').length.toString(), status: 'info' },
      ],
      href: '/projects',
    },
    {
      moduleId: 'inventory' as const,
      name: 'Katana Inventory',
      shortName: 'INV',
      icon: Package,
      color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      metrics: [
        { label: 'SKUs tracked', value: inventoryMetrics.totalItems.toString(), status: 'info' },
        {
          label: 'Low stock',
          value: inventoryMetrics.lowStockItems.toString(),
          status: inventoryMetrics.lowStockItems > 0 ? 'warning' : 'success',
        },
        {
          label: 'Open POs',
          value: inventoryMetrics.openPurchaseOrders.toString(),
          status: 'info',
        },
      ],
      href: '/inventory',
    },
    {
      moduleId: 'customer-success' as const,
      name: 'Katana Customers',
      shortName: 'CSP',
      icon: Users,
      color: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
      metrics: [
        { label: 'Avg Health Score', value: `${csMetrics.avgHealthScore}%`, progress: csMetrics.avgHealthScore },
        { label: 'At-Risk Clients', value: csMetrics.atRiskClients.toString(), status: csMetrics.atRiskClients > 0 ? 'warning' : 'success' },
        { label: 'Renewals (60d)', value: csMetrics.upcomingRenewals.toString(), status: 'info' },
      ],
      href: '/customer-success',
    },
    {
      moduleId: 'workforce' as const,
      name: 'Katana Workforce',
      shortName: 'Workforce',
      icon: Briefcase,
      color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      metrics: [
        {
          label: `Active ${wfmTerms.workItemPlural.toLowerCase()}`,
          value: wfmMetrics.activeJobs.toString(),
          status: 'info' as const,
        },
        {
          label: wfmMetrics.unassignedJobs > 0 ? 'Unassigned' : 'Team members',
          value: (wfmMetrics.unassignedJobs > 0 ? wfmMetrics.unassignedJobs : wfmMetrics.activeTechnicians).toString(),
          status: wfmMetrics.unassignedJobs > 0 ? 'warning' : 'info',
        },
        {
          label: wfmMetrics.overdueJobs > 0 ? 'Overdue' : 'Pending time',
          value: (wfmMetrics.overdueJobs > 0 ? wfmMetrics.overdueJobs : wfmMetrics.pendingTimesheets).toString(),
          status: wfmMetrics.overdueJobs > 0 || wfmMetrics.pendingTimesheets > 0 ? 'warning' : 'success',
        },
      ],
      href: workforceTabPath('today'),
    },
    {
      moduleId: 'hr' as const,
      name: 'Katana HR',
      shortName: 'Katana HR',
      icon: UserCheck,
      color: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
      metrics: [
        { label: 'Active Employees', value: hrMetrics.activeEmployees.toString(), status: 'success' },
        { label: 'Reviews Due (30d)', value: hrMetrics.reviewsDue.toString(), status: hrMetrics.reviewsDue > 0 ? 'warning' : 'success' },
        { label: 'Open Positions', value: hrMetrics.openPositions.toString(), status: 'info' },
      ],
      href: '/hr',
    },
    {
      moduleId: 'employee' as const,
      name: 'Employee Portal',
      shortName: 'Portal',
      icon: Users,
      color: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
      metrics: [
        { label: 'My Profile', value: 'View', status: 'info' },
        { label: 'Directory', value: 'Browse', status: 'info' },
        { label: 'Goals & Performance', value: 'Track', status: 'info' },
      ],
      href: '/employee',
    },
    {
      moduleId: 'careers' as const,
      name: 'Careers',
      shortName: 'Careers',
      icon: Briefcase,
      color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      metrics: [
        { label: 'Open Roles', value: jobPostings.filter(j => j.is_active).length.toString(), status: 'info' },
        { label: 'Applications', value: jobApplications.length.toString(), status: 'info' },
        { label: 'Browse jobs', value: 'Go', status: 'info' },
      ],
      href: '/careers',
    },
    {
      moduleId: 'automation' as const,
      name: 'Automation',
      shortName: 'Automation',
      icon: Bot,
      color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
      metrics: [
        { label: 'Knowledge', value: 'Documents', status: 'info' },
        { label: 'Tools', value: 'Manage', status: 'info' },
        { label: 'Status', value: 'Ready', status: 'success' },
      ],
      href: '/automation',
    },
    {
      moduleId: 'kyi' as const,
      name: 'Know Your Investor',
      shortName: 'KYI',
      icon: LineChart,
      color: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
      metrics: [
        { label: 'Companies tracked', value: kyiCompanies.length.toString(), status: 'info' },
        { label: 'Pipeline', value: kyiCompanies.length ? 'Active' : 'Empty', status: 'info' },
        { label: 'Detail', value: 'Open KYI', status: 'info' },
      ],
      href: '/kyi',
    },
    {
      moduleId: 'finance' as const,
      name: 'Katana Finance',
      shortName: 'Finance',
      icon: Landmark,
      color: 'bg-emerald-600/10 text-emerald-600 border-emerald-600/20',
      metrics: [
        {
          label: 'Uncategorized',
          value: String(financeSummary?.uncategorizedCount ?? 0),
          status: (financeSummary?.uncategorizedCount ?? 0) > 0 ? 'warning' : 'success',
        },
        {
          label: 'Net income (YTD)',
          value: financeSummary?.setupComplete
            ? `$${Math.round(financeSummary.netIncomeYtd).toLocaleString()}`
            : '—',
          status: 'info',
        },
        {
          label: 'Accounts',
          value: financeSummary?.setupComplete
            ? String(financeSummary.financialAccountCount)
            : 'Setup',
          status: financeSummary?.setupComplete ? 'info' : 'warning',
        },
      ],
      href: '/finance',
    },
    {
      moduleId: 'esign' as const,
      name: 'Katana E-Sign',
      shortName: 'E-Sign',
      icon: PenLine,
      color: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
      metrics: [
        { label: 'Requests', value: 'Manage', status: 'info' },
        { label: 'Signatures', value: 'Collect', status: 'info' },
        { label: 'Status', value: 'Ready', status: 'success' },
      ],
      href: '/esign',
    },
    {
      moduleId: 'comms' as const,
      name: 'Katana Comms',
      shortName: 'Comms',
      icon: MessageSquare,
      color: 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      metrics: [
        { label: 'Channels', value: String(commsChannelCount), status: 'info' },
        { label: 'Conversations', value: String(commsConversationCount), status: 'info' },
        { label: 'Messages', value: 'Open Comms', status: 'info' },
      ],
      href: '/comms',
    },
    {
      moduleId: 'agents' as const,
      name: 'Agent Office',
      shortName: 'Agents',
      icon: Swords,
      color: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
      metrics: [
        { label: 'AI agents', value: 'Open office', status: 'info' },
        { label: 'Workflows', value: 'Manage', status: 'info' },
        { label: 'Status', value: 'Ready', status: 'success' },
      ],
      href: '/agents',
    },
    {
      moduleId: 'support' as const,
      name: 'Katana Support',
      shortName: 'Support',
      icon: LifeBuoy,
      color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
      metrics: [
        {
          label: 'Open items',
          value: String(supportMetrics.open + supportMetrics.inProgress),
          status: supportMetrics.open + supportMetrics.inProgress > 0 ? 'warning' : 'success',
        },
        { label: 'Open', value: supportMetrics.open.toString(), status: 'info' },
        { label: 'In progress', value: supportMetrics.inProgress.toString(), status: 'info' },
      ],
      href: '/support',
    },
  ]

  const handleSaveCustomize = useCallback(() => {
    saveHubLayout(hubLayout)
    if (moduleOrder.length > 0) {
      localStorage.setItem('katana_hub_module_order', JSON.stringify(moduleOrder))
    }
    setIsCustomizeMode(false)
    toast.success('Hub layout saved')
  }, [hubLayout, moduleOrder])

  const handleResetHubLayout = useCallback(() => {
    const defaults = resetHubLayout()
    setHubLayout(defaults)
    const defaultModuleOrder = modules.map((_, index) => index)
    setModuleOrder(defaultModuleOrder)
    localStorage.setItem('katana_hub_module_order', JSON.stringify(defaultModuleOrder))
    toast.success('Hub layout reset to default')
  }, [modules])

  // Initialize module order after modules are defined with validation
  useEffect(() => {
    if (modules.length > 0) {
      if (moduleOrder.length === 0) {
        const defaultOrder = modules.map((_, index) => index)
        setModuleOrder(defaultOrder)
      } else {
        // Validate: all indices must be in range and unique (no duplicates)
        const validOrder = moduleOrder.filter(index => index >= 0 && index < modules.length)
        const uniqueOrder = [...new Set(validOrder)]
        if (uniqueOrder.length !== modules.length) {
          const defaultOrder = modules.map((_, index) => index)
          setModuleOrder(defaultOrder)
        } else if (validOrder.length !== moduleOrder.length) {
          setModuleOrder(uniqueOrder)
        }
      }
    }
  }, [modules.length])

  // Save module order to localStorage only when it's valid (no duplicates, correct length)
  useEffect(() => {
    if (moduleOrder.length > 0 && moduleOrder.length === modules.length) {
      const unique = new Set(moduleOrder)
      if (unique.size === moduleOrder.length) {
        localStorage.setItem('katana_hub_module_order', JSON.stringify(moduleOrder))
      }
    }
  }, [moduleOrder, modules.length])

  // Get ordered modules based on saved order, then filter to only modules the user has access to (HR-assigned)
  const orderedModules = useMemo(() => {
    const list = moduleOrder.length === modules.length
      ? moduleOrder.map(i => modules[i]).filter(Boolean)
      : modules
    return list.filter((m) => hasModuleAccess(m.moduleId) && m.moduleId !== 'employee')
  }, [moduleOrder, modules, hasModuleAccess])

  const showEmployeeLaunchpad = hasModuleAccess('employee')

  // Show loading state while auth is loading or data is loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    )
  }

  if (loading || moduleAccessLoading) {
    return (
      <MotionPage
        subtle
        className={cn('min-h-screen bg-background', layoutClasses.pagePadding)}
        data-layout={hubSettings.dashboardLayout}
      >
        <div className={layoutClasses.sectionGap}>
          <div
            className={cn('flex items-center justify-between', layoutClasses.headerMargin)}
            data-tour="hub-header"
          >
            <div>
              <h1 className={cn('font-bold mb-2', layoutClasses.title)}>Katana Hub</h1>
              <p className={cn('text-muted-foreground', layoutClasses.subtitle)}>
                BusinessOps Platform - Central Command Center
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <OnboardingTourButton />
              <ModuleHelpButton moduleId="hub" />
              <Badge variant="outline" className="gap-2">
                <Activity className="h-3 w-3" />
                {moduleAccessLoading ? 'Checking access…' : 'Loading data…'}
              </Badge>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4" data-tour="hub-quick-actions">
            <HubQuickSearchDialog allowedModules={allowedModules} />
            <HubQuickCreateDialog
              allowedModules={allowedModules}
              onCreated={() => setRefreshTrigger(Date.now())}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              data-tour="hub-customize"
              aria-label="Customize hub"
              disabled
            >
              <LayoutGrid className="h-4 w-4" />
              Customize
            </Button>
          </div>

          <div className="space-y-4" data-tour="hub-modules">
            <h2 className={cn('font-bold', layoutClasses.toolsTitle)}>Your Tools</h2>
            <div className={layoutClasses.moduleGrid}>
              {[0, 1, 2].map((slot) => (
                <Card key={slot} className="animate-pulse">
                  <CardContent className={cn('h-28', layoutClasses.moduleCardPadding)} />
                </Card>
              ))}
            </div>
          </div>
        </div>
      </MotionPage>
    )
  }

  const lastSyncLabel = formatHubLastSync(lastSyncedAt, syncClock)
  const refreshLabel = getHubRefreshIntervalLabel(hubSettings.refreshInterval)

  const performanceExpandedContent =
    hubMetrics.performanceMetrics.length === 0 ? (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Metrics appear here for modules assigned to you in HR.
      </p>
    ) : (
      <div className={cn(layoutClasses.performanceMetricGrid)}>
        {hubMetrics.performanceMetrics.map((metric) => (
          <div key={`${metric.moduleId}-${metric.label}`} className="space-y-1">
            <div className="text-sm text-muted-foreground">{metric.label}</div>
            <div className={cn('font-bold', layoutClasses.performanceMetricValue)}>{metric.value}</div>
            {metric.detail && <div className="text-xs text-muted-foreground">{metric.detail}</div>}
          </div>
        ))}
      </div>
    )

  const renderHubSectionContent = (sectionId: HubSectionId) => {
    switch (sectionId) {
      case 'profile_setup':
        return <HubProfileSetupSection forceVisible={isCustomizeMode} />
      case 'performance_overview':
        return (
          <HubPerformanceOverviewSection
            performancePreview={hubMetrics.previewMetrics.map((item) => ({
              label: item.label,
              value: item.value,
            }))}
            performanceExpandedContent={performanceExpandedContent}
            performanceProgress={hubMetrics.performanceProgress.map((item) => ({
              label: item.label,
              value: item.value,
              displayValue: item.displayValue,
            }))}
            layoutClasses={layoutClasses}
          />
        )
      case 'key_metrics':
        return <HubKeyMetricsSection kpis={kpis} layoutClasses={layoutClasses} />
      case 'launchpad':
        if (!showEmployeeLaunchpad) {
          return isCustomizeMode ? (
            <Card>
              <CardContent className="py-6 text-center text-sm text-muted-foreground">
                Launchpad appears here when you have Employee Portal access.
              </CardContent>
            </Card>
          ) : null
        }
        return (
          <div className="space-y-2" data-tour="hub-launchpad">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Launchpad
            </h2>
            <EmployeePortalLaunchpadLink variant="hub" />
          </div>
        )
      case 'your_tools':
        return (
          <div className="space-y-4" data-tour="hub-modules">
            <div className={cn('flex items-center justify-between', layoutClasses.headerMargin)}>
              <h2 className={cn('font-bold', layoutClasses.toolsTitle)}>Your Tools</h2>
              {isCustomizeMode && (
                <p className="text-xs text-muted-foreground">Drag module cards to reorder</p>
              )}
            </div>
            {orderedModules.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No modules available</h3>
                  <p className="text-sm text-muted-foreground">
                    Modules appear here based on your HR module access.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className={layoutClasses.moduleGrid}>
                {orderedModules.map((module, displayIndex) => {
                  const Icon = module.icon
                  const originalIndex = modules.findIndex((m) => m.name === module.name)
                  const isExpanded = expandedModules.has(originalIndex)
                  const toggleModule = () => {
                    const newExpanded = new Set(expandedModules)
                    if (isExpanded) newExpanded.delete(originalIndex)
                    else newExpanded.add(originalIndex)
                    setExpandedModules(newExpanded)
                  }
                  const isDragging = draggedModuleIndex === displayIndex

                  return (
                    <div
                      key={module.moduleId}
                      className={`relative ${isDragging ? 'opacity-50 scale-95' : ''} ${isCustomizeMode ? 'cursor-move' : ''} transition-all`}
                      draggable={isCustomizeMode}
                      onDragStart={(e) => {
                        if (!isCustomizeMode) return
                        e.dataTransfer.effectAllowed = 'move'
                        e.dataTransfer.setData('text/plain', displayIndex.toString())
                        handleModuleDragStart(displayIndex)
                      }}
                      onDragEnter={(e) => {
                        if (!isCustomizeMode) return
                        e.preventDefault()
                        handleModuleDragEnter(displayIndex)
                      }}
                      onDragLeave={(e) => {
                        if (!isCustomizeMode) return
                        const rect = e.currentTarget.getBoundingClientRect()
                        const x = e.clientX
                        const y = e.clientY
                        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                          setDragOverIndex(null)
                        }
                      }}
                      onDragOver={(e) => {
                        if (!isCustomizeMode) return
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                      }}
                      onDragEnd={handleModuleDragEnd}
                      onKeyDown={(e) => handleModuleKeyDown(e, displayIndex)}
                      tabIndex={isCustomizeMode ? 0 : -1}
                      role={isCustomizeMode ? 'button' : undefined}
                      aria-label={
                        isCustomizeMode
                          ? `${module.name}. Press arrow keys to reorder, or drag to move.`
                          : module.name
                      }
                      aria-describedby={isCustomizeMode ? `module-${displayIndex}-desc` : undefined}
                    >
                      {isCustomizeMode && (
                        <span id={`module-${displayIndex}-desc`} className="sr-only">
                          Use arrow keys to move up or down, or drag to reorder
                        </span>
                      )}
                      <Collapsible open={isExpanded} onOpenChange={toggleModule}>
                        <Card
                          className={`border-2 ${module.color} hover:shadow-lg transition-all ${isCustomizeMode ? 'ring-2 ring-primary ring-offset-2' : ''} ${isDragging ? 'border-primary' : ''}`}
                        >
                          <div className={cn('relative', layoutClasses.moduleCardPadding)}>
                            {isCustomizeMode && (
                              <div
                                className="absolute -left-3 top-6 z-10 cursor-grab active:cursor-grabbing bg-primary text-primary-foreground rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform touch-none"
                                aria-label="Drag handle"
                              >
                                <GripVertical className="h-4 w-4" />
                              </div>
                            )}
                            <div className="flex items-center justify-between mb-3">
                              <Link
                                to={module.href}
                                className="flex items-center gap-3 flex-1 hover:opacity-80 transition-opacity"
                              >
                                <div className={cn(layoutClasses.moduleIconBox, module.color)}>
                                  <Icon className="h-6 w-6" />
                                </div>
                                <CardTitle className={cn('font-semibold', layoutClasses.moduleTitle)}>{module.name}</CardTitle>
                              </Link>
                              <div className="flex items-center gap-1">
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                                    {isExpanded ? (
                                      <ChevronUp className="h-4 w-4" />
                                    ) : (
                                      <ChevronDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </CollapsibleTrigger>
                                <Link to={module.href}>
                                  <Button variant="ghost" size="sm">
                                    <ArrowRight className="h-4 w-4" />
                                  </Button>
                                </Link>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {module.metrics.slice(0, 2).map((metric, idx) => (
                                <span key={idx}>
                                  <span className="font-medium text-foreground">{metric.value}</span>{' '}
                                  {metric.label}
                                </span>
                              ))}
                            </div>
                          </div>
                          <CollapsibleContent>
                            <CardContent className="pt-0 pb-4 px-5 space-y-3 border-t">
                              {module.metrics.map((metric, idx) => (
                                <div key={idx}>
                                  <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-muted-foreground">{metric.label}</span>
                                    <span className="font-medium">{metric.value}</span>
                                  </div>
                                  {'progress' in metric && metric.progress !== undefined ? (
                                    <Progress value={metric.progress} className="h-1" />
                                  ) : null}
                                </div>
                              ))}
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      case 'activity_feed':
        return <HubActivityFeed activities={feedActivities} />
      default:
        return null
    }
  }

  return (
    <MotionPage
      subtle
      className={cn('min-h-screen bg-background', layoutClasses.pagePadding)}
      data-layout={hubSettings.dashboardLayout}
    >
      <div className={layoutClasses.sectionGap}>
        <div
          className={cn('flex items-center justify-between', layoutClasses.headerMargin)}
          data-tour="hub-header"
        >
          <div>
            <h1 className={cn('font-bold mb-2', layoutClasses.title)}>Katana Hub</h1>
            <p className={cn('text-muted-foreground', layoutClasses.subtitle)}>
              BusinessOps Platform - Central Command Center
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
            <OnboardingTourButton />
            <ModuleHelpButton moduleId="hub" />
            <Badge variant="outline" className="gap-2">
              <Activity className="h-3 w-3" />
              System Healthy
            </Badge>
            <Badge variant="secondary" className="gap-1.5">
              {isRefreshing ? (
                <>
                  <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                  Refreshing…
                </>
              ) : (
                <>Last sync: {lastSyncLabel}</>
              )}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {hubSettings.refreshInterval === 'manual' ? 'Manual refresh' : `Auto refresh ${refreshLabel}`}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 sm:gap-4" data-tour="hub-quick-actions">
          <HubQuickSearchDialog allowedModules={allowedModules} />
          <HubQuickCreateDialog
            allowedModules={allowedModules}
            onCreated={() => setRefreshTrigger(Date.now())}
          />

          {isCustomizeMode ? (
            <Button
              variant="default"
              size="sm"
              className="gap-2"
              aria-label="Save hub layout"
              onClick={handleSaveCustomize}
            >
              <Check className="h-4 w-4" />
              Done
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              data-tour="hub-customize"
              aria-label="Customize hub"
              onClick={() => {
                setIsCustomizeMode(true)
                toast.info('Drag sections to reorder your hub. Hide sections you don’t need.')
              }}
            >
              <LayoutGrid className="h-4 w-4" />
              Customize
            </Button>
          )}

          <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hub Settings</DialogTitle>
                <DialogDescription>Configure your hub preferences. Changes are saved and applied immediately.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dashboard Layout</Label>
                  <Select
                    value={hubSettings.dashboardLayout}
                    onValueChange={(v) => {
                      persistHubSettings({
                        ...hubSettings,
                        dashboardLayout: v as HubUserSettings['dashboardLayout'],
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default Layout</SelectItem>
                      <SelectItem value="compact">Compact View</SelectItem>
                      <SelectItem value="detailed">Detailed View</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Refresh Interval</Label>
                  <Select
                    value={hubSettings.refreshInterval}
                    onValueChange={(v) => {
                      persistHubSettings({
                        ...hubSettings,
                        refreshInterval: v as HubUserSettings['refreshInterval'],
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1min">1 minute</SelectItem>
                      <SelectItem value="2min">2 minutes</SelectItem>
                      <SelectItem value="5min">5 minutes</SelectItem>
                      <SelectItem value="manual">Manual only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Sections on your hub</Label>
                  <div className="mt-2 space-y-2 rounded-lg border p-3">
                    {hubLayout.sectionOrder.map((sectionId) => (
                      <label key={sectionId} className="flex items-center justify-between gap-3 text-sm">
                        <span>{HUB_SECTION_META[sectionId].label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          onClick={() =>
                            setHubLayout((prev) => toggleHubSectionHidden(prev, sectionId))
                          }
                        >
                          {isHubSectionHidden(hubLayout, sectionId) ? (
                            <>
                              <Eye className="mr-1 h-4 w-4" /> Show
                            </>
                          ) : (
                            <>
                              <EyeOff className="mr-1 h-4 w-4" /> Hide
                            </>
                          )}
                        </Button>
                      </label>
                    ))}
                  </div>
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={handleResetHubLayout}>
                  Reset hub layout to default
                </Button>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      saveHubSettings(hubSettings)
                      saveHubLayout(hubLayout)
                      toast.success('Settings saved')
                      setIsSettingsOpen(false)
                    }}
                  >
                    Save Settings
                  </Button>
                  <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {hubDataLoadFailed && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-foreground">Couldn&apos;t load some hub data</p>
              <p className="text-muted-foreground">
                Some metrics may be incomplete or show as empty. Try refreshing, or check back shortly.
              </p>
            </div>
          </div>
        )}

        {isCustomizeMode && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Customize your hub.</span> Drag entire sections to
            reorder them, hide what you don&apos;t need, and rearrange module cards inside Your Tools. Click{' '}
            <span className="font-medium text-foreground">Done</span> when finished.
          </div>
        )}

        <div className={cn('flex flex-col', layoutClasses.metricsGap, layoutClasses.dashboardStackMargin)} data-hub-dashboard="v2">
          {displaySections.map((sectionId, displayIndex) => {
            const content = renderHubSectionContent(sectionId)
            if (!content && !isCustomizeMode) return null

            return (
              <HubSectionFrame
                key={sectionId}
                sectionId={sectionId}
                customizeMode={isCustomizeMode}
                isHidden={isHubSectionHidden(hubLayout, sectionId)}
                isDragging={draggedSectionIndex === displayIndex}
                draggable={isCustomizeMode}
                onDragStart={() => handleSectionDragStart(displayIndex)}
                onDragEnter={() => handleSectionDragEnter(displayIndex, reorderDisplayedSections)}
                onDragEnd={handleSectionDragEnd}
                onKeyDown={(event) =>
                  handleSectionKeyDown(event, displayIndex, reorderDisplayedSections)
                }
                onToggleHidden={() => handleToggleSectionHidden(sectionId)}
              >
                {content ?? (
                  <Card>
                    <CardContent className="py-6 text-center text-sm text-muted-foreground">
                      This section is hidden or unavailable with your current access.
                    </CardContent>
                  </Card>
                )}
              </HubSectionFrame>
            )
          })}
        </div>
      </div>
    </MotionPage>
  )
}
