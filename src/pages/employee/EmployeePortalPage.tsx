import { formatDateOnly } from '@/lib/due-date-utils'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Users,
  Target,
  BookOpen,
  Star,
  Award,
  Briefcase,
  Clock,
  ArrowRight,
  Bell,
  MessageSquare,
  RefreshCw,
} from "lucide-react"
import { useEmployeePortal } from "@/contexts/EmployeePortalContext"
import { useAuth } from "@/contexts/AuthContext"
import { EmployeePortalNoAccess } from "@/components/employee/EmployeePortalNoAccess"
import { LoadingState } from "@/components/ui/loading-state"
import * as hrApi from "@/lib/hr-api"
import type {
  PerformanceReview,
  Goal,
  LearningPath,
  HrNotice,
  TimeOffRequest,
  Recognition,
  Activity,
} from "@/lib/hr-api"
import {
  buildPortalHrFeed,
  timeOffPortalNoticeBody,
  timeOffPortalNoticeTitle,
} from "@/lib/hr-api"
import { RequestTimeOffDialog } from "@/components/employee/request-time-off-dialog"
import { getProjectsAndTasksAssignedTo } from "@/lib/project-data-supabase"
import { getRecentProjectActivities } from "@/lib/supabase-api"
import {
  buildEmployeePortalFeed,
  EMPLOYEE_PORTAL_PM_ACTIVITY_FETCH_LIMIT,
  mergeCommsIntoFeed,
  mergeUserNotificationsIntoFeed,
  filterEmployeePortalFeed,
  loadFeedScopePreference,
  loadFeedTypePreference,
  loadFeedModulePreference,
  loadFeedDisplayPreference,
  saveFeedScopePreference,
  saveFeedTypePreference,
  saveFeedModulePreference,
  saveFeedDisplayPreference,
  type EmployeeFeedScope,
  type EmployeeFeedTypeFilter,
  type EmployeeFeedModuleFilter,
  type EmployeeFeedDisplayMode,
} from "@/lib/employee-portal-feed"
import {
  dedupeNotificationFeedItemsAgainstComms,
  suppressSyntheticFeedItems,
  userNotificationsToFeedItems,
} from "@/lib/employee-portal-notifications"
import { useNotifications } from "@/contexts/NotificationContext"
import { useEmployeePortalUnread } from "@/hooks/useEmployeePortalUnread"
import { useFeedDismissals } from "@/hooks/useFeedDismissals"
import { useFeedSeen } from "@/hooks/useFeedSeen"
import { listNewFeedItemIds, countNewFeedItems, countHistoryFeedItems } from "@/lib/employee-portal-feed-sections"
import { listDismissibleSyntheticIds } from "@/lib/employee-portal-dismissals"
import { EmployeePortalUnreadBadge } from "@/components/employee/EmployeePortalUnreadBadge"
import { EmployeePortalFeedFilters } from "@/components/employee/EmployeePortalFeedFilters"
import { EmployeePortalFeedList } from "@/components/employee/EmployeePortalFeedList"
import { EmployeeAvatar } from "@/components/ui/employee-avatar"
import { resolveEmployeePhotoUrl } from "@/lib/employee-portal-profile"
import { useEmployeePortalComms } from "@/contexts/EmployeePortalCommsContext"
import { useModuleAccess } from "@/contexts/ModuleAccessContext"
import { getCompanies, type KYICompany } from "@/lib/kyi-api"
import { getMyWorkItems, resolveTechnicianForEmployee } from "@/lib/wfm-worker"
import { OnboardingTourButton } from '@/components/tour/onboarding-tour-button'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import { useModuleTour } from '@/components/tour/use-module-tour'
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

function overallRating(review: PerformanceReview): number {
  return (review.collaboration + review.accountability + review.trustworthy + review.leadership) / 4
}

export default function EmployeePortalPage() {
  useModuleTour('launchpad')
  const { employee, employeeId, loading, error, refresh } = useEmployeePortal()
  const { profile } = useAuth()
  const { hasModuleAccess } = useModuleAccess()
  const { commsFeedItems, refreshComms, markCommsSeen } = useEmployeePortalComms()
  const { notifications, refresh: refreshNotifications, markAllRead } = useNotifications()
  const { dismiss, dismissMany, filterItems: filterDismissedFeedItems } = useFeedDismissals()
  const { markSeen, markManySeen, revision: seenRevision } = useFeedSeen()

  const surfaceConfig = getEmployeeSurfaceConfig('feed')
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
  const [reviews, setReviews] = useState<PerformanceReview[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([])
  const [recognitions, setRecognitions] = useState<Recognition[]>([])
  const [hrActivities, setHrActivities] = useState<Activity[]>([])
  const [projectActivities, setProjectActivities] = useState<
    Awaited<ReturnType<typeof getRecentProjectActivities>>
  >([])
  const [hrNotices, setHrNotices] = useState<HrNotice[]>([])
  const [feedScope, setFeedScope] = useState<EmployeeFeedScope>(() => loadFeedScopePreference())
  const [feedTypeFilter, setFeedTypeFilter] = useState<EmployeeFeedTypeFilter>(() =>
    loadFeedTypePreference()
  )
  const [feedModuleFilter, setFeedModuleFilter] = useState<EmployeeFeedModuleFilter>(() =>
    loadFeedModulePreference()
  )
  const [feedDisplayMode, setFeedDisplayMode] = useState<EmployeeFeedDisplayMode>(() =>
    loadFeedDisplayPreference()
  )
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([])
  const [isTimeOffDialogOpen, setIsTimeOffDialogOpen] = useState(false)
  const [dataLoading, setDataLoading] = useState(true)
  const [myProjects, setMyProjects] = useState<Awaited<ReturnType<typeof getProjectsAndTasksAssignedTo>>>([])
  const [myWorkItems, setMyWorkItems] = useState<
    Array<{
      id: string
      title: string
      jobNumber: string
      status: string
      startDate: string | null
      endDate: string | null
    }>
  >([])
  const [kyiCompanies, setKyiCompanies] = useState<KYICompany[]>([])
  const [feedRefreshing, setFeedRefreshing] = useState(false)
  const [markAllReadLoading, setMarkAllReadLoading] = useState(false)
  const hasKyiAccess = hasModuleAccess('kyi')

  const reloadPortalData = useCallback(async () => {
    if (!employeeId) return
    const [
      reviewsData,
      goalsData,
      learningData,
      recognitionsData,
      noticesData,
      timeOffData,
      activitiesData,
      pmActivitiesData,
    ] = await Promise.all([
      hrApi.getPerformanceReviewsByEmployeeId(employeeId),
      hrApi.getGoalsByEmployeeId(employeeId),
      hrApi.getLearningPathsByEmployeeId(employeeId),
      hrApi.getRecognitionsByEmployeeId(employeeId),
      hrApi.getHrNoticesForPortal(),
      hrApi.getTimeOffRequestsByEmployeeId(employeeId),
      hrApi.getRecentActivities(50),
      getRecentProjectActivities(EMPLOYEE_PORTAL_PM_ACTIVITY_FETCH_LIMIT),
    ])
    setReviews(reviewsData)
    setGoals(goalsData)
    setLearningPaths(learningData)
    setRecognitions(recognitionsData)
    setHrNotices(noticesData)
    setTimeOffRequests(timeOffData)
    setHrActivities(activitiesData)
    setProjectActivities(pmActivitiesData)
  }, [employeeId])

  // Load portal data when employee is set
  useEffect(() => {
    if (!employeeId) {
      setDataLoading(false)
      return
    }
    setDataLoading(true)
    void reloadPortalData()
      .catch((e) => console.error('Failed to load portal data:', e))
      .finally(() => setDataLoading(false))
  }, [employeeId, reloadPortalData])

  useEffect(() => {
    if (!employeeId) return
    const reload = () => {
      void Promise.all([
        hrApi.getRecentActivities(50),
        getRecentProjectActivities(EMPLOYEE_PORTAL_PM_ACTIVITY_FETCH_LIMIT),
        getProjectsAndTasksAssignedTo(employee?.name?.trim() ?? '', employeeId),
      ]).then(([activities, pmActivities, projects]) => {
        setHrActivities(activities)
        setProjectActivities(pmActivities)
        setMyProjects(projects)
      })
    }
    window.addEventListener('projectDataUpdated', reload)
    return () => window.removeEventListener('projectDataUpdated', reload)
  }, [employeeId, employee?.name])

  // Load KYI companies if employee has access
  useEffect(() => {
    if (!hasKyiAccess) return
    getCompanies().then((c) => setKyiCompanies(c.slice(0, 5))).catch(() => setKyiCompanies([]))
  }, [hasKyiAccess])

  // Load projects/tasks by HR employee id (stable) and legacy assignee_name match
  useEffect(() => {
    if (!employeeId && !employee?.name?.trim()) {
      setMyProjects([])
      setMyWorkItems([])
      return
    }
    getProjectsAndTasksAssignedTo(employee?.name?.trim() ?? '', employeeId ?? null)
      .then(setMyProjects)
      .catch(() => setMyProjects([]))

    void (async () => {
      if (!employeeId) {
        setMyWorkItems([])
        return
      }
      const tech = await resolveTechnicianForEmployee({
        employeeId,
        email: employee?.email,
        name: employee?.name,
      })
      if (!tech) {
        setMyWorkItems([])
        return
      }
      const jobs = await getMyWorkItems(tech.id)
      setMyWorkItems(jobs.map((j) => ({
        id: j.id,
        title: j.title,
        jobNumber: j.jobNumber,
        status: j.status,
        startDate: j.startDate,
        endDate: j.endDate,
      })))
    })()
  }, [employeeId, employee?.name, employee?.email])

  const performanceScore = useMemo(() => {
    if (employee?.performance_score != null) return Number(employee.performance_score)
    if (reviews.length === 0) return null
    return Number(overallRating(reviews[0]))
  }, [employee?.performance_score, reviews])

  const goalsCompleted = useMemo(() => goals.filter((g) => g.status === "Complete").length, [goals])
  const goalsTotal = goals.length
  const trainingInProgress = useMemo(
    () => learningPaths.filter((l) => l.status === "in-progress" || l.status === "not-started").length,
    [learningPaths]
  )
  const trainingCompleted = useMemo(
    () => learningPaths.filter((l) => l.status === "completed").length,
    [learningPaths]
  )

  const nextReviewDate = employee?.next_review_date ?? null

  const recognitionsCount = recognitions.length

  const hrFeedItems = useMemo(
    () => buildPortalHrFeed(hrNotices, timeOffRequests),
    [hrNotices, timeOffRequests]
  )

  const handleFeedScopeChange = useCallback((scope: EmployeeFeedScope) => {
    setFeedScope(scope)
    saveFeedScopePreference(scope)
  }, [])

  const handleFeedTypeChange = useCallback((type: EmployeeFeedTypeFilter) => {
    setFeedTypeFilter(type)
    saveFeedTypePreference(type)
  }, [])

  const handleFeedModuleChange = useCallback((module: EmployeeFeedModuleFilter) => {
    setFeedModuleFilter(module)
    saveFeedModulePreference(module)
  }, [])

  const handleFeedDisplayModeChange = useCallback((mode: EmployeeFeedDisplayMode) => {
    setFeedDisplayMode(mode)
    saveFeedDisplayPreference(mode)
  }, [])

  const notificationFeedItems = useMemo(
    () =>
      dedupeNotificationFeedItemsAgainstComms(
        userNotificationsToFeedItems(notifications),
        commsFeedItems
      ),
    [notifications, commsFeedItems]
  )

  const mergedFeedItems = useMemo(() => {
    if (!employeeId || !employee?.name) {
      return mergeUserNotificationsIntoFeed(mergeCommsIntoFeed([], commsFeedItems), notificationFeedItems)
    }
    const base = buildEmployeePortalFeed({
      employeeId,
      employeeName: employee.name,
      goals,
      learningPaths,
      recognitions,
      reviews,
      myProjects,
      myWorkItems,
      hrActivities,
      projectActivities,
      goalsCompleted,
      recognitionsCount,
      trainingCompleted,
      nextReviewDate,
      timeOffRequests,
    })
    const dedupedBase = suppressSyntheticFeedItems(base, notifications)
    return mergeUserNotificationsIntoFeed(
      mergeCommsIntoFeed(dedupedBase, commsFeedItems),
      notificationFeedItems
    )
  }, [
    employeeId,
    employee?.name,
    goals,
    learningPaths,
    recognitions,
    reviews,
    myProjects,
    myWorkItems,
    hrActivities,
    projectActivities,
    goalsCompleted,
    recognitionsCount,
    trainingCompleted,
    nextReviewDate,
    timeOffRequests,
    commsFeedItems,
    notificationFeedItems,
    notifications,
  ])

  const allFeedItems = useMemo(
    () => filterDismissedFeedItems(mergedFeedItems),
    [mergedFeedItems, filterDismissedFeedItems]
  )

  const feedItems = useMemo(
    () => filterEmployeePortalFeed(allFeedItems, feedScope, feedTypeFilter, feedModuleFilter),
    [allFeedItems, feedScope, feedTypeFilter, feedModuleFilter]
  )

  const activeFeedCount = useMemo(
    () => countNewFeedItems(feedItems),
    [feedItems, seenRevision]
  )
  const historyFeedCount = useMemo(
    () => countHistoryFeedItems(feedItems),
    [feedItems, seenRevision]
  )

  const forYouFeedCount = useMemo(
    () => allFeedItems.filter((i) => i.scope === 'for_you').length,
    [allFeedItems]
  )
  const companyFeedCount = useMemo(
    () => allFeedItems.filter((i) => i.scope === 'company').length,
    [allFeedItems]
  )
  const { total: unreadAttentionCount } = useEmployeePortalUnread(allFeedItems)

  const handleRefreshFeed = useCallback(async () => {
    setFeedRefreshing(true)
    try {
      await Promise.all([
        refresh(),
        refreshNotifications(),
        refreshComms(),
        reloadPortalData(),
        employeeId || employee?.name?.trim()
          ? getProjectsAndTasksAssignedTo(employee?.name?.trim() ?? '', employeeId ?? null).then(
              setMyProjects
            )
          : Promise.resolve(),
      ])
    } catch (e) {
      console.error('Failed to refresh employee portal feed:', e)
    } finally {
      setFeedRefreshing(false)
    }
  }, [
    refresh,
    refreshNotifications,
    refreshComms,
    reloadPortalData,
    employeeId,
    employee?.name,
  ])

  const handleMarkAllFeedRead = useCallback(async () => {
    setMarkAllReadLoading(true)
    try {
      await markAllRead()
      markCommsSeen()
      dismissMany(listDismissibleSyntheticIds(mergedFeedItems))
      markManySeen(listNewFeedItemIds(mergedFeedItems))
      setFeedDisplayMode('active')
      saveFeedDisplayPreference('active')
    } catch (e) {
      console.error('Failed to mark feed as read:', e)
    } finally {
      setMarkAllReadLoading(false)
    }
  }, [markAllRead, markCommsSeen, dismissMany, markManySeen, mergedFeedItems])

  const quickActions = [
    { label: "Company Directory", icon: Users, link: "/employee/directory", color: "bg-blue-500" },
    { label: "My Performance", icon: Star, link: "/employee/performance", color: "bg-purple-500" },
    { label: "My Goals", icon: Target, link: "/employee/goals", color: "bg-green-500" },
    { label: "Learning & Development", icon: BookOpen, link: "/employee/development", color: "bg-orange-500" },
    { label: "Internal Jobs", icon: Briefcase, link: "/employee/jobs", color: "bg-pink-500" },
  ]

  const recentAchievements = useMemo(() => {
    const list: { title: string; description: string; icon: typeof Award; color: string }[] = []
    if (goalsCompleted > 0) {
      list.push({
        title: "Goal Achiever",
        description: `Completed ${goalsCompleted} goal${goalsCompleted === 1 ? "" : "s"}`,
        icon: Award,
        color: "text-yellow-500",
      })
    }
    if (recognitionsCount > 0) {
      list.push({
        title: "Team Player",
        description: `Received ${recognitionsCount} recognition${recognitionsCount === 1 ? "" : "s"}`,
        icon: Users,
        color: "text-blue-500",
      })
    }
    if (trainingCompleted > 0) {
      list.push({
        title: "Learning Champion",
        description: `Completed ${trainingCompleted} training course${trainingCompleted === 1 ? "" : "s"}`,
        icon: BookOpen,
        color: "text-green-500",
      })
    }
    if (list.length === 0) {
      list.push({
        title: "Get started",
        description: "Complete goals, training, or receive recognition to see achievements here",
        icon: Award,
        color: "text-muted-foreground",
      })
    }
    return list
  }, [goalsCompleted, recognitionsCount, trainingCompleted])

  if (loading || dataLoading) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <LoadingState message="Loading your portal…" />
      </div>
    )
  }

  if (error || !employee) {
    return (
      <div className="flex flex-1 overflow-y-auto p-6">
        <EmployeePortalNoAccess error={error ?? undefined} />
      </div>
    )
  }

  const firstName = employee.name?.split(" ")[0] || "there"
  const portalPhotoUrl = resolveEmployeePhotoUrl(employee, profile?.avatar_url)

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 lg:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground sm:text-2xl">Feed</h1>
          <p className="text-sm text-muted-foreground">
            Your launchpad for assignments, company updates, and activity.
          </p>
        </div>
        <ModuleCustomizeControls
          customizeMode={isCustomizeMode}
          onEnterCustomize={enterCustomize}
          onDone={() => void saveAndExit()}
          dataTourCustomize="launchpad-feed-customize"
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
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'profile_card') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-profile">
                <div className="h-12 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
                <CardContent className="pt-0 pb-3 -mt-7 px-3">
                  <div className="flex flex-col items-center text-center">
                    <EmployeeAvatar
                      name={employee.name ?? 'Employee'}
                      photoUrl={portalPhotoUrl}
                      size="xl"
                    />
                    <h2 className="font-semibold text-base mt-2 leading-tight">{employee.name}</h2>
                    <p className="text-xs text-muted-foreground line-clamp-2">{employee.position}</p>
                    <p className="text-xs text-muted-foreground">{employee.department}</p>
                    <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        {performanceScore != null ? `${Number(performanceScore).toFixed(1)}/5` : "—"} perf
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {goalsCompleted}/{goalsTotal} goals
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" className="w-full mt-3 h-8 text-xs" asChild>
                      <Link to="/employee/profile">Edit profile</Link>
                    </Button>
                    <div className="mt-3 w-full border-t border-border/60 pt-3 text-left">
                      <div className="mb-1.5 flex items-center justify-between">
                        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          Performance
                        </span>
                        <Link to="/employee/performance" className="text-xs text-primary">
                          View
                        </Link>
                      </div>
                      <Progress
                        value={performanceScore != null ? (performanceScore / 5) * 100 : 0}
                        className="h-1.5"
                      />
                      <p className="mt-1 text-xs text-muted-foreground">
                        Next review:{' '}
                        {nextReviewDate ? formatDateOnly(nextReviewDate) : '—'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'shortcuts') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-shortcuts">
                <CardContent className="p-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Shortcuts
                  </p>
                  <nav className="space-y-0.5" aria-label="Portal shortcuts">
                    {quickActions.map((action) => (
                      <Link key={action.label} to={action.link}>
                        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-muted/80 transition-colors">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${action.color}`}
                          >
                            <action.icon className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="text-sm font-medium leading-snug">{action.label}</span>
                        </div>
                      </Link>
                    ))}
                  </nav>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'welcome') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-welcome">
                <CardContent className="p-4 h-full">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Welcome back, {firstName}</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your launchpad for assignments, company updates, and activity that mentions you.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <OnboardingTourButton showLabel={false} />
                      <ModuleHelpButton moduleId="launchpad" />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="relative shrink-0"
                        onClick={() => {
                          handleFeedDisplayModeChange('active')
                          handleFeedScopeChange('for_you')
                          handleFeedTypeChange('updates')
                          handleFeedModuleChange('notifications')
                        }}
                        title={
                          unreadAttentionCount > 0
                            ? `${unreadAttentionCount} items need your attention`
                            : 'View your notifications'
                        }
                      >
                        <Bell className="h-5 w-5" />
                        <EmployeePortalUnreadBadge
                          count={unreadAttentionCount}
                          className="absolute top-1 right-1"
                        />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'directory_search') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-directory-search">
                <CardContent className="p-4 h-full flex items-center">
                  <div className="flex items-center gap-3 w-full">
                    <EmployeeAvatar
                      name={employee.name ?? 'Employee'}
                      photoUrl={portalPhotoUrl}
                      size="xs"
                    />
                    <Link to="/employee/directory" className="flex-1 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground hover:bg-muted/80 transition-colors text-left">
                      Find someone in the directory…
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleRefreshFeed()}
                      disabled={feedRefreshing}
                      title="Refresh feed"
                    >
                      <RefreshCw className={`h-5 w-5 ${feedRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'hr_notices') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-hr-notices">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    HR notices
                  </CardTitle>
                  <CardDescription>
                    Company-wide announcements plus your time-off requests — always visible here.
                  </CardDescription>
                  {employeeId && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => setIsTimeOffDialogOpen(true)}>
                      <Clock className="mr-2 h-4 w-4" />
                      Request time off
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {hrFeedItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      No HR announcements or requests yet. Use Request time off to submit leave to HR.
                    </p>
                  ) : (
                    hrFeedItems.map((item) => {
                      if (item.kind === 'notice') {
                        const n = item.notice
                        return (
                          <div
                            key={n.id}
                            className={`rounded-lg border p-3 ${
                              n.priority === "high" ? "border-destructive/40 bg-destructive/5" : "employee-portal-muted-panel"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="font-medium text-sm text-foreground">{n.title}</p>
                              {n.priority === "high" && (
                                <Badge variant="destructive" className="text-xs shrink-0">
                                  High priority
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">{n.body}</p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {new Date(n.published_at).toLocaleString()}
                            </p>
                          </div>
                        )
                      }
                      const req = item.request
                      const statusVariant =
                        req.status === 'Approved'
                          ? 'default'
                          : req.status === 'Denied'
                            ? 'destructive'
                            : 'secondary'
                      return (
                        <div
                          key={`timeoff-${req.id}`}
                          className="employee-portal-muted-panel rounded-lg border p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-medium text-sm text-foreground">
                              {timeOffPortalNoticeTitle(req)}
                            </p>
                            <Badge variant={statusVariant} className="text-xs shrink-0">
                              {req.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap mt-1">
                            {timeOffPortalNoticeBody(req)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(req.decided_at ?? req.created_at).toLocaleString()}
                          </p>
                        </div>
                      )
                    })
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'feed') {
            return (
              <div className="h-full space-y-3" data-tour="launchpad-feed">
                <h2 className="text-lg font-semibold px-1">Your feed</h2>
                <p className="text-sm text-muted-foreground px-1">
                  Your inbox shows only new updates. Once you&apos;ve caught up, they move to history
                  so nothing repeats — open history anytime to find a past notification.
                </p>
                <div data-tour="launchpad-feed-filters">
                  <EmployeePortalFeedFilters
                    displayMode={feedDisplayMode}
                    onDisplayModeChange={handleFeedDisplayModeChange}
                    activeCount={activeFeedCount}
                    historyCount={historyFeedCount}
                    scope={feedScope}
                    typeFilter={feedTypeFilter}
                    moduleFilter={feedModuleFilter}
                    onScopeChange={handleFeedScopeChange}
                    onTypeFilterChange={handleFeedTypeChange}
                    onModuleFilterChange={handleFeedModuleChange}
                    forYouCount={forYouFeedCount}
                    companyCount={companyFeedCount}
                    totalCount={allFeedItems.length}
                    unreadAttentionCount={unreadAttentionCount}
                    onMarkAllRead={() => void handleMarkAllFeedRead()}
                    markAllReadLoading={markAllReadLoading}
                  />
                </div>
                {feedItems.length === 0 && allFeedItems.length > 0 ? (
                  <Card className="employee-portal-card border shadow-sm overflow-hidden">
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>No items match this filter.</p>
                      <p className="text-sm mt-1">
                        Try &quot;For you&quot; or &quot;All types&quot; to see goals, projects, and company updates.
                      </p>
                      <div className="flex flex-wrap justify-center gap-2 mt-4">
                        <Button variant="outline" size="sm" onClick={() => handleFeedScopeChange('all')}>
                          Show all
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/employee/goals">Goals</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <EmployeePortalFeedList
                    items={feedItems}
                    displayMode={feedDisplayMode}
                    historyCount={historyFeedCount}
                    onShowHistory={() => handleFeedDisplayModeChange('history')}
                    onShowActive={() => handleFeedDisplayModeChange('active')}
                    onDismissSynthetic={dismiss}
                    onMarkSeen={markSeen}
                    seenRevision={seenRevision}
                  />
                )}
              </div>
            )
          }

          if (widgetId === 'achievements') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-achievements">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Achievements</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentAchievements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Complete goals or training to earn badges.</p>
                  ) : (
                    recentAchievements.map((achievement, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/40">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${achievement.color}`}>
                          <achievement.icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm">{achievement.title}</p>
                          <p className="text-xs text-muted-foreground">{achievement.description}</p>
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'resources') {
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm" data-tour="launchpad-resources">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link to="/employee/profile"><MessageSquare className="w-4 h-4 mr-2" />My Profile</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link to="/employee/directory"><Users className="w-4 h-4 mr-2" />Company Directory</Link>
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start" asChild>
                    <Link to="/employee/development"><BookOpen className="w-4 h-4 mr-2" />Learning</Link>
                  </Button>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'kyi_companies') {
            if (!hasKyiAccess) {
              return (
                <Card className="h-full overflow-hidden employee-portal-card border shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      KYI Companies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      KYI is not available on your plan.
                    </p>
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-hidden employee-portal-card border shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Briefcase className="h-4 w-4" />
                    KYI Companies
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {kyiCompanies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No companies to show yet.</p>
                  ) : (
                    <>
                      {kyiCompanies.map((c) => (
                        <Link
                          key={c.id}
                          to={`/kyi/companies/${c.id}`}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/80 transition-colors"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
                          </div>
                          <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                            {c.investor_count}
                          </Badge>
                        </Link>
                      ))}
                      <Button variant="ghost" size="sm" className="w-full justify-start mt-1" asChild>
                        <Link to="/kyi">View all companies <ArrowRight className="w-3 h-3 ml-1" /></Link>
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />

      {employeeId && (
        <RequestTimeOffDialog
          open={isTimeOffDialogOpen}
          onOpenChange={setIsTimeOffDialogOpen}
          employeeId={employeeId}
          onSubmitted={(req) => {
            setTimeOffRequests((prev) => [req, ...prev.filter((r) => r.id !== req.id)])
          }}
        />
      )}
    </div>
  )
}
