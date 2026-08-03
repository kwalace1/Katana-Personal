import { formatDateOnly } from '@/lib/due-date-utils'
import type {
  Activity,
  Goal,
  LearningPath,
  PerformanceReview,
  Recognition,
  TimeOffRequest,
} from '@/lib/hr-api'
import { timeOffPortalNoticeBody, timeOffPortalNoticeTitle } from '@/lib/hr-api'
import type { NotificationSourceModule } from '@/lib/notifications-api'
import { notificationModuleLabel } from '@/lib/notifications-present'

export type EmployeeFeedScope = 'all' | 'for_you' | 'company'

/** Active inbox shows only unseen/unread items; history holds everything already reviewed. */
export type EmployeeFeedDisplayMode = 'active' | 'history'
export type EmployeeFeedTypeFilter =
  | 'all'
  | 'assigned'
  | 'updates'
  | 'deadlines'
  | 'achievements'
  | 'projects'

/** Filter feed by notification source module (cross-module bell notifications). */
export type EmployeeFeedModuleFilter = 'all' | 'notifications' | NotificationSourceModule

export const EMPLOYEE_FEED_MODULE_FILTER_OPTIONS: readonly {
  value: EmployeeFeedModuleFilter
  label: string
}[] = [
  { value: 'all', label: 'All modules' },
  { value: 'notifications', label: 'All notifications' },
  { value: 'projects', label: notificationModuleLabel('projects') },
  { value: 'hr', label: notificationModuleLabel('hr') },
  { value: 'comms', label: notificationModuleLabel('comms') },
  { value: 'customer_success', label: notificationModuleLabel('customer_success') },
  { value: 'kyi', label: notificationModuleLabel('kyi') },
  { value: 'inventory', label: notificationModuleLabel('inventory') },
  { value: 'workforce', label: notificationModuleLabel('workforce') },
  { value: 'support', label: notificationModuleLabel('support') },
  { value: 'hub', label: notificationModuleLabel('hub') },
  { value: 'general', label: notificationModuleLabel('general') },
] as const

export type EmployeeFeedIconKind =
  | 'goal'
  | 'training'
  | 'project'
  | 'bell'
  | 'award'
  | 'star'
  | 'activity'
  | 'users'
  | 'recognition'
  | 'message'
  | 'work'

export const EMPLOYEE_FEED_PAGE_SIZE = 10

/** Max PM activities fetched for the employee portal timeline. */
export const EMPLOYEE_PORTAL_PM_ACTIVITY_FETCH_LIMIT = 20

/** Max company-wide PM activity rows in the portal feed (for_you rows are not capped). */
export const EMPLOYEE_PORTAL_PM_ACTIVITY_COMPANY_CAP = 15

export interface EmployeeFeedQuickViewDetail {
  label: string
  value: string
}

export type EmployeeFeedQuickViewLayout =
  | 'goal'
  | 'training'
  | 'project'
  | 'message'
  | 'recognition'
  | 'performance'
  | 'notice'
  | 'timeoff'
  | 'activity'
  | 'achievement'
  | 'generic'

export type EmployeeFeedStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

export interface EmployeeFeedQuickViewTask {
  title: string
  status?: string
  deadline?: string
}

export interface EmployeeFeedQuickView {
  layout?: EmployeeFeedQuickViewLayout
  summary?: string
  details: EmployeeFeedQuickViewDetail[]
  moduleLabel?: string
  progress?: number
  statusLabel?: string
  statusTone?: EmployeeFeedStatusTone
  categoryLabel?: string
  dueDate?: string
  body?: string
  fromName?: string
  contextLabel?: string
  priorityLabel?: string
  tasks?: EmployeeFeedQuickViewTask[]
  completedDate?: string
  lastUpdated?: string
  timestamp?: string
}

export interface EmployeePortalFeedItem {
  id: string
  scope: 'for_you' | 'company'
  category: 'assigned' | 'event' | 'notification' | 'achievement' | 'project' | 'activity' | 'recognition'
  sortAt: number
  /** Higher values surface first after unread. */
  priorityRank?: number
  /** Short label shown in the feed (e.g. "Due today", "Unread message"). */
  urgencyLabel?: string
  title: string
  subtitle?: string
  time?: string
  link?: string
  meta?: string
  unread?: boolean
  iconKind: EmployeeFeedIconKind
  /** Set on persisted user_notifications feed items. */
  sourceModule?: NotificationSourceModule
  notificationType?: string
  /** When a comms notification mirrors a live Comms message, used for deduplication. */
  commsMessageId?: string
  quickView: EmployeeFeedQuickView
}

export interface EmployeePortalFeedInput {
  employeeId: string
  employeeName: string
  goals: Goal[]
  learningPaths: LearningPath[]
  recognitions: Recognition[]
  reviews: PerformanceReview[]
  myProjects: {
    projectId: string
    projectName: string
    tasks: { id: string; title: string; status?: string; deadline?: string }[]
  }[]
  myWorkItems?: Array<{
    id: string
    title: string
    jobNumber: string
    status: string
    startDate: string | null
    endDate: string | null
  }>
  hrActivities: Activity[]
  projectActivities: Array<{
    id: string
    project_id: string
    type: string
    description: string
    user: string
    created_at: string
  }>
  goalsCompleted: number
  recognitionsCount: number
  trainingCompleted: number
  nextReviewDate?: string | null
  timeOffRequests?: TimeOffRequest[]
}

export const FEED_PRIORITY = {
  COMMS_UNREAD: 1000,
  OVERDUE: 950,
  DUE_TODAY: 900,
  DUE_SOON: 850,
  HR_HIGH: 820,
  PENDING_TIME_OFF: 800,
  REQUIRED_TRAINING: 780,
  UNREAD_ALERT: 760,
  DUE_THIS_WEEK: 600,
  COMMS_READ: 400,
  ASSIGNED: 300,
  RECOGNITION: 250,
  ACTIVITY: 200,
  ACHIEVEMENT: 100,
  LOW: 50,
} as const

function daysUntilTimestamp(dueMs: number, now = Date.now()): number {
  return Math.ceil((dueMs - now) / 86400000)
}

function rankFromDueTimestamp(dueMs: number, now = Date.now()): { rank: number; label?: string } {
  const days = daysUntilTimestamp(dueMs, now)
  if (days < 0) return { rank: FEED_PRIORITY.OVERDUE, label: 'Overdue' }
  if (days === 0) return { rank: FEED_PRIORITY.DUE_TODAY, label: 'Due today' }
  if (days <= 2) return { rank: FEED_PRIORITY.DUE_SOON, label: 'Due soon' }
  if (days <= 5) return { rank: FEED_PRIORITY.DUE_SOON, label: `Due in ${days} days` }
  if (days <= 7) return { rank: FEED_PRIORITY.DUE_THIS_WEEK, label: `Due in ${days} days` }
  return { rank: FEED_PRIORITY.ASSIGNED }
}

export function isCommsFeedItem(item: EmployeePortalFeedItem): boolean {
  return item.id.startsWith('comms-')
}

export function isUserNotificationFeedItem(item: EmployeePortalFeedItem): boolean {
  return item.id.startsWith('user-notif-')
}

function hasDueUrgencyLabel(label?: string): boolean {
  if (!label) return false
  return (
    label === 'Overdue' ||
    label === 'Due today' ||
    label === 'Due soon' ||
    label === 'Required' ||
    label.startsWith('Due in')
  )
}

/** Calendar deadlines, due-soon alerts, and assignments with an upcoming due date. */
export function isDeadlineFeedItem(item: EmployeePortalFeedItem): boolean {
  if (isCommsFeedItem(item)) return false
  if (isUserNotificationFeedItem(item) && item.urgencyLabel === 'Overdue') return true
  if (item.id.startsWith('timeoff-') || item.id.startsWith('hr-notice-')) return false

  if (item.category === 'event') return true
  if (item.id.startsWith('notif-')) return true

  if (
    (item.category === 'assigned' || item.category === 'project') &&
    hasDueUrgencyLabel(item.urgencyLabel)
  ) {
    return true
  }

  return false
}

/** Messages, recognitions, activity, HR notices, and time-off — not calendar deadlines. */
export function isUpdateFeedItem(item: EmployeePortalFeedItem): boolean {
  if (isDeadlineFeedItem(item)) return false
  if (item.category === 'activity' || item.category === 'recognition') return true
  if (isCommsFeedItem(item)) return true
  if (isUserNotificationFeedItem(item)) return true
  if (item.id.startsWith('timeoff-') || item.id.startsWith('hr-notice-')) return true
  return false
}

/** Sort feed: unread first, then priority, then soonest deadlines, then newest activity. */
export function compareEmployeePortalFeedItems(
  a: EmployeePortalFeedItem,
  b: EmployeePortalFeedItem
): number {
  const aUnread = a.unread ? 1 : 0
  const bUnread = b.unread ? 1 : 0
  if (aUnread !== bUnread) return bUnread - aUnread

  const aRank = a.priorityRank ?? FEED_PRIORITY.ACTIVITY
  const bRank = b.priorityRank ?? FEED_PRIORITY.ACTIVITY
  if (aRank !== bRank) return bRank - aRank

  const aDeadline = isDeadlineFeedItem(a)
  const bDeadline = isDeadlineFeedItem(b)
  if (aDeadline && bDeadline) return a.sortAt - b.sortAt
  if (aDeadline !== bDeadline) return aDeadline ? -1 : 1

  if (b.sortAt !== a.sortAt) return b.sortAt - a.sortAt
  return a.id.localeCompare(b.id)
}

export function sortEmployeePortalFeed(items: EmployeePortalFeedItem[]): EmployeePortalFeedItem[] {
  return [...items].sort(compareEmployeePortalFeedItems)
}

const FEED_SCOPE_KEY = 'employeePortal_feedScope'
const FEED_TYPE_KEY = 'employeePortal_feedType'
const FEED_MODULE_KEY = 'employeePortal_feedModule'
const FEED_DISPLAY_KEY = 'employeePortal_feedDisplay'

const VALID_MODULE_FILTERS = new Set<string>([
  'all',
  'notifications',
  ...EMPLOYEE_FEED_MODULE_FILTER_OPTIONS.map((o) => o.value).filter((v) => v !== 'all' && v !== 'notifications'),
])

export function loadFeedScopePreference(): EmployeeFeedScope {
  if (typeof window === 'undefined') return 'all'
  const v = localStorage.getItem(FEED_SCOPE_KEY)
  if (v === 'for_you' || v === 'company' || v === 'all') return v
  return 'all'
}

export function loadFeedTypePreference(): EmployeeFeedTypeFilter {
  if (typeof window === 'undefined') return 'all'
  const v = localStorage.getItem(FEED_TYPE_KEY)
  if (
    v === 'assigned' ||
    v === 'updates' ||
    v === 'deadlines' ||
    v === 'achievements' ||
    v === 'projects' ||
    v === 'all'
  ) {
    return v
  }
  return 'all'
}

export function saveFeedScopePreference(scope: EmployeeFeedScope): void {
  if (typeof window !== 'undefined') localStorage.setItem(FEED_SCOPE_KEY, scope)
}

export function saveFeedTypePreference(type: EmployeeFeedTypeFilter): void {
  if (typeof window !== 'undefined') localStorage.setItem(FEED_TYPE_KEY, type)
}

export function loadFeedModulePreference(): EmployeeFeedModuleFilter {
  if (typeof window === 'undefined') return 'all'
  const v = localStorage.getItem(FEED_MODULE_KEY)
  if (v && VALID_MODULE_FILTERS.has(v)) return v as EmployeeFeedModuleFilter
  return 'all'
}

export function saveFeedModulePreference(module: EmployeeFeedModuleFilter): void {
  if (typeof window !== 'undefined') localStorage.setItem(FEED_MODULE_KEY, module)
}

export function loadFeedDisplayPreference(): EmployeeFeedDisplayMode {
  if (typeof window === 'undefined') return 'active'
  const v = localStorage.getItem(FEED_DISPLAY_KEY)
  if (v === 'history') return 'history'
  return 'active'
}

export function saveFeedDisplayPreference(mode: EmployeeFeedDisplayMode): void {
  if (typeof window !== 'undefined') localStorage.setItem(FEED_DISPLAY_KEY, mode)
}

/** Resolve which Katana module a feed item belongs to for module filtering. */
export function resolveFeedItemSourceModule(
  item: EmployeePortalFeedItem
): NotificationSourceModule | null {
  if (item.sourceModule) return item.sourceModule
  if (isCommsFeedItem(item)) return 'comms'

  if (
    item.id.startsWith('assigned-proj-') ||
    item.id.startsWith('pm-activity-') ||
    item.category === 'project'
  ) {
    return 'projects'
  }

  if (
    item.id.startsWith('assigned-goal-') ||
    item.id.startsWith('event-goal-') ||
    item.id.startsWith('notif-goal-') ||
    item.id.startsWith('assigned-training-') ||
    item.id.startsWith('event-training-') ||
    item.id.startsWith('notif-training-') ||
    item.id.startsWith('recognition-') ||
    item.id.startsWith('hr-activity-') ||
    item.id.startsWith('hr-notice-') ||
    item.id.startsWith('timeoff-') ||
    item.id === 'event-review' ||
    item.id.startsWith('ach-') ||
    item.iconKind === 'goal' ||
    item.iconKind === 'training' ||
    item.iconKind === 'recognition'
  ) {
    return 'hr'
  }

  return null
}

export function isPersistedNotificationFeedItem(item: EmployeePortalFeedItem): boolean {
  return isUserNotificationFeedItem(item) || isCommsFeedItem(item)
}

function matchesFeedModuleFilter(
  item: EmployeePortalFeedItem,
  moduleFilter: EmployeeFeedModuleFilter
): boolean {
  if (moduleFilter === 'all') return true
  if (moduleFilter === 'notifications') return isPersistedNotificationFeedItem(item)
  return resolveFeedItemSourceModule(item) === moduleFilter
}

export function normalizePersonName(name: string): string {
  return name.trim().toLowerCase()
}

/** True when text references this employee (e.g. "Kevin Wallace" in an activity description). */
export function mentionsEmployee(text: string, employeeName: string): boolean {
  const n = normalizePersonName(employeeName)
  if (!n || n.length < 2) return false
  const hay = normalizePersonName(text)
  if (hay.includes(n)) return true
  const first = n.split(/\s+/)[0]
  if (first && first.length >= 3 && hay.includes(first)) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return hay.includes(parts[parts.length - 1] ?? '')
  }
  return false
}

export function isHrActivityForYou(
  activity: Activity,
  employeeId: string,
  employeeName: string
): boolean {
  if (activity.employee_id === employeeId) return true
  if (mentionsEmployee(activity.description, employeeName)) return true
  if (activity.employee_name && mentionsEmployee(activity.employee_name, employeeName)) return true
  return false
}

export function isHrActivityCompany(activity: Activity, employeeId: string): boolean {
  if (!activity.employee_id) return true
  if (activity.employee_id !== employeeId) return true
  const orgWide = ['employee_added', 'interview_scheduled', 'employee_updated']
  return orgWide.includes(activity.type)
}

export function isProjectActivityForYou(
  activity: { description: string; user: string; project_id: string },
  employeeName: string,
  myProjectIds: Set<string>
): boolean {
  if (myProjectIds.has(activity.project_id)) return true
  if (mentionsEmployee(activity.description, employeeName)) return true
  if (mentionsEmployee(activity.user, employeeName)) return true
  return false
}

function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function quickView(
  summary: string,
  details: EmployeeFeedQuickViewDetail[],
  moduleLabel?: string,
  extras?: Partial<Omit<EmployeeFeedQuickView, 'summary' | 'details' | 'moduleLabel'>>
): EmployeeFeedQuickView {
  return {
    summary,
    details: details.filter((d) => d.value && d.value !== '—'),
    moduleLabel,
    ...extras,
  }
}

function goalStatusTone(status: Goal['status']): EmployeeFeedStatusTone {
  if (status === 'Complete') return 'success'
  if (status === 'Behind') return 'danger'
  if (status === 'On Track') return 'success'
  return 'warning'
}

function trainingStatusTone(status: LearningPath['status']): EmployeeFeedStatusTone {
  if (status === 'completed') return 'success'
  return 'info'
}

function trainingCourseMeta(l: LearningPath): string {
  const cat = l.training_course?.category || 'Assigned'
  const duration = l.training_course?.duration_hours ? `${l.training_course.duration_hours}h` : ''
  const level = l.training_course?.level || ''
  return [cat, duration, level].filter(Boolean).join(' · ')
}

function trainingQuickExtras(l: LearningPath): Partial<Omit<EmployeeFeedQuickView, 'summary' | 'details' | 'moduleLabel'>> {
  return {
    layout: 'training',
    progress: l.progress ?? 0,
    statusLabel: l.status === 'completed' ? 'Completed' : 'In Progress',
    statusTone: trainingStatusTone(l.status),
    dueDate: formatDate(l.due_date),
    priorityLabel: l.priority === 'high' ? 'Required' : undefined,
    contextLabel: trainingCourseMeta(l),
    body: l.notes || undefined,
    completedDate:
      l.status === 'completed' && l.updated_at ? formatDate(l.updated_at) : undefined,
  }
}

function goalQuickExtras(g: Goal): Partial<Omit<EmployeeFeedQuickView, 'summary' | 'details' | 'moduleLabel'>> {
  return {
    layout: 'goal',
    progress: g.progress ?? 0,
    statusLabel: g.status,
    statusTone: goalStatusTone(g.status),
    categoryLabel: g.category || 'individual',
    dueDate: formatDate(g.due_date),
    body: g.description || undefined,
    lastUpdated: g.updated_at ? formatDate(g.updated_at) : undefined,
  }
}

/** Infer module preview layout when not set on the item. */
export function resolveFeedQuickViewLayout(item: EmployeePortalFeedItem): EmployeeFeedQuickViewLayout {
  if (item.quickView.layout) return item.quickView.layout
  if (isCommsFeedItem(item)) return 'message'
  if (isUserNotificationFeedItem(item) && item.iconKind === 'project') return 'project'
  if (item.id.startsWith('hr-notice-')) return 'notice'
  if (item.id.startsWith('timeoff-')) return 'timeoff'
  if (item.id.startsWith('recognition-')) return 'recognition'
  if (item.id.startsWith('ach-')) return 'achievement'
  if (item.id.startsWith('assigned-proj-')) return 'project'
  if (item.id === 'event-review') return 'performance'
  if (item.iconKind === 'goal' || item.id.includes('goal')) return 'goal'
  if (item.iconKind === 'training') return 'training'
  if (item.iconKind === 'project') return 'project'
  if (item.iconKind === 'message') return 'message'
  if (item.category === 'activity') return 'activity'
  return 'generic'
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso)
  const diffMs = Date.now() - d.getTime()
  const diffM = Math.floor(diffMs / 60000)
  const diffH = Math.floor(diffMs / 3600000)
  const diffD = Math.floor(diffMs / 86400000)
  if (diffM < 1) return 'Just now'
  if (diffM < 60) return `${diffM} min ago`
  if (diffH < 24) return `${diffH} hour${diffH !== 1 ? 's' : ''} ago`
  if (diffD < 7) return `${diffD} day${diffD !== 1 ? 's' : ''} ago`
  return d.toLocaleDateString()
}

function pushAssignedGoals(items: EmployeePortalFeedItem[], goals: Goal[]): void {
  goals
    .filter((g) => g.status !== 'Complete' && g.status !== 'Cancelled')
    .slice(0, 8)
    .forEach((g, i) => {
      const goalTitle = (g.goal || 'Goal').slice(0, 50) + ((g.goal?.length ?? 0) > 50 ? '…' : '')
      const dueMs = g.due_date ? new Date(g.due_date).getTime() : null
      const dueRank = dueMs ? rankFromDueTimestamp(dueMs) : { rank: FEED_PRIORITY.ASSIGNED }
      items.push({
        id: `assigned-goal-${g.id ?? i}`,
        scope: 'for_you',
        category: 'assigned',
        sortAt: dueMs ?? new Date(g.created_at ?? Date.now()).getTime(),
        priorityRank: dueRank.rank,
        urgencyLabel: dueRank.label,
        title: 'Goal assigned to you',
        subtitle: goalTitle,
        link: '/employee/goals',
        meta: 'Goal',
        iconKind: 'goal',
        quickView: quickView(g.goal || 'Goal', [
          { label: 'Status', value: g.status },
          { label: 'Progress', value: `${g.progress ?? 0}%` },
          { label: 'Due', value: formatDate(g.due_date) },
          { label: 'Category', value: g.category || '—' },
        ], 'Open in Goals', goalQuickExtras(g)),
      })
    })
}

function pushAssignedTraining(items: EmployeePortalFeedItem[], learningPaths: LearningPath[]): void {
  learningPaths
    .filter((l) => l.status !== 'completed')
    .slice(0, 8)
    .forEach((l, i) => {
      const courseTitle = (l.course || 'Training').slice(0, 50) + ((l.course?.length ?? 0) > 50 ? '…' : '')
      const priorityLabel =
        l.priority === 'high' ? ' · Required' : l.priority === 'low' ? ' · Optional' : ''
      const dueMs = l.due_date ? new Date(l.due_date).getTime() : null
      const dueRank = dueMs ? rankFromDueTimestamp(dueMs) : { rank: FEED_PRIORITY.ASSIGNED }
      const requiredRank =
        l.priority === 'high'
          ? Math.max(dueRank.rank, FEED_PRIORITY.REQUIRED_TRAINING)
          : dueRank.rank
      items.push({
        id: `assigned-training-${l.id ?? i}`,
        scope: 'for_you',
        category: 'assigned',
        sortAt: dueMs ?? new Date(l.created_at).getTime(),
        priorityRank: requiredRank,
        urgencyLabel:
          l.priority === 'high' ? 'Required' : dueRank.label,
        title: 'Training assigned to you',
        subtitle: courseTitle + priorityLabel,
        link: '/employee/development',
        meta: 'Training',
        iconKind: 'training',
        quickView: quickView(l.course || 'Training', [
          { label: 'Status', value: l.status },
          { label: 'Progress', value: `${l.progress ?? 0}%` },
          { label: 'Due', value: formatDate(l.due_date) },
          { label: 'Priority', value: l.priority ?? 'normal' },
        ], 'Open in Learning', trainingQuickExtras(l)),
      })
    })
}

function pushAssignedProjects(
  items: EmployeePortalFeedItem[],
  myProjects: EmployeePortalFeedInput['myProjects']
): void {
  myProjects.slice(0, 5).forEach(({ projectId, projectName, tasks }) => {
    const taskDeadlines = tasks
      .map((t) => (t.deadline ? new Date(t.deadline).getTime() : null))
      .filter((ms): ms is number => ms !== null && !Number.isNaN(ms))
    const nearestDeadline = taskDeadlines.length > 0 ? Math.min(...taskDeadlines) : null
    const dueRank = nearestDeadline
      ? rankFromDueTimestamp(nearestDeadline)
      : { rank: FEED_PRIORITY.ASSIGNED }
    items.push({
      id: `assigned-proj-${projectId}`,
      scope: 'for_you',
      category: 'project',
      sortAt: nearestDeadline ?? Date.now(),
      priorityRank: dueRank.rank,
      urgencyLabel: dueRank.label,
      title: 'Tasks assigned to you',
      subtitle: `${tasks.length} task${tasks.length === 1 ? '' : 's'} on ${projectName}`,
      link: `/projects/${projectId}`,
      meta: 'Project',
      iconKind: 'project',
      quickView: quickView(
        projectName,
        [
          { label: 'Open tasks', value: String(tasks.length) },
          ...tasks.slice(0, 5).map((t, idx) => ({
            label: `Task ${idx + 1}`,
            value: `${t.title}${t.status ? ` (${t.status})` : ''}`,
          })),
        ],
        'Open in Projects',
        {
          layout: 'project',
          tasks: tasks.slice(0, 8).map((t) => ({
            title: t.title,
            status: t.status,
            deadline: t.deadline ? formatDate(t.deadline) : undefined,
          })),
        }
      ),
    })
  })
}

function pushAssignedWorkItems(
  items: EmployeePortalFeedItem[],
  workItems: NonNullable<EmployeePortalFeedInput['myWorkItems']>,
): void {
  workItems.slice(0, 8).forEach((job) => {
    const dueMs = job.endDate ? new Date(job.endDate).getTime() : null
    const dueRank = dueMs ? rankFromDueTimestamp(dueMs) : { rank: FEED_PRIORITY.ASSIGNED }
    const statusLabel =
      job.status === 'in-progress'
        ? 'In progress'
        : job.status === 'on-hold'
          ? 'On hold'
          : job.status
    items.push({
      id: `assigned-wfm-${job.id}`,
      scope: 'for_you',
      category: 'assigned',
      sortAt: dueMs ?? Date.now(),
      priorityRank: dueRank.rank,
      urgencyLabel: dueRank.label,
      title: 'Work assigned to you',
      subtitle: `${job.jobNumber} · ${job.title}`,
      link: `/employee/work?job=${encodeURIComponent(job.id)}`,
      meta: 'Workforce',
      iconKind: 'work',
      sourceModule: 'workforce',
      quickView: quickView(
        job.title,
        [
          { label: 'ID', value: job.jobNumber },
          { label: 'Status', value: statusLabel },
          { label: 'Start', value: job.startDate ? formatDate(job.startDate) : '—' },
          { label: 'Due', value: job.endDate ? formatDate(job.endDate) : '—' },
        ],
        'Workforce',
        { layout: 'generic' },
      ),
    })
  })
}

function pushUpcomingEvents(
  items: EmployeePortalFeedItem[],
  input: EmployeePortalFeedInput
): void {
  const now = Date.now()
  const { goals, learningPaths, nextReviewDate } = input

  if (nextReviewDate) {
    const d = new Date(nextReviewDate)
    if (d.getTime() >= now) {
      const dueRank = rankFromDueTimestamp(d.getTime(), now)
      items.push({
        id: 'event-review',
        scope: 'for_you',
        category: 'event',
        sortAt: d.getTime(),
        priorityRank: dueRank.rank,
        urgencyLabel: dueRank.label,
        title: 'Performance Review',
        subtitle: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        time: 'Upcoming',
        link: '/employee/performance',
        meta: 'Review',
        iconKind: 'star',
        quickView: quickView('Your next performance review is scheduled.', [
          { label: 'Review date', value: formatDate(nextReviewDate ?? undefined) },
        ], 'Open in Performance', {
          layout: 'performance',
          dueDate: formatDate(nextReviewDate ?? undefined),
          statusLabel: 'Upcoming',
          statusTone: 'info',
        }),
      })
    }
  }

  goals
    .filter((g) => g.status !== 'Complete' && g.status !== 'Cancelled' && g.due_date)
    .forEach((g) => {
      const d = new Date(g.due_date)
      if (d.getTime() >= now) {
        const dueRank = rankFromDueTimestamp(d.getTime(), now)
        items.push({
          id: `event-goal-${g.id}`,
          scope: 'for_you',
          category: 'event',
          sortAt: d.getTime(),
          priorityRank: dueRank.rank,
          urgencyLabel: dueRank.label,
          title: (g.goal?.slice(0, 40) ?? 'Goal') + ((g.goal?.length ?? 0) > 40 ? '…' : ''),
          subtitle: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: 'Due',
          link: '/employee/goals',
          meta: 'Goal',
          iconKind: 'goal',
          quickView: quickView(g.goal || 'Goal', [
            { label: 'Due', value: formatDate(g.due_date) },
            { label: 'Status', value: g.status },
            { label: 'Progress', value: `${g.progress ?? 0}%` },
          ], 'Open in Goals', goalQuickExtras(g)),
        })
      }
    })

  learningPaths
    .filter((l) => l.status !== 'completed' && l.due_date)
    .forEach((l) => {
      const d = new Date(l.due_date)
      if (d.getTime() >= now) {
        const dueRank = rankFromDueTimestamp(d.getTime(), now)
        const requiredRank =
          l.priority === 'high'
            ? Math.max(dueRank.rank, FEED_PRIORITY.REQUIRED_TRAINING)
            : dueRank.rank
        items.push({
          id: `event-training-${l.id}`,
          scope: 'for_you',
          category: 'event',
          sortAt: d.getTime(),
          priorityRank: requiredRank,
          urgencyLabel: l.priority === 'high' ? 'Required' : dueRank.label,
          title: (l.course?.slice(0, 40) ?? 'Training') + ((l.course?.length ?? 0) > 40 ? '…' : ''),
          subtitle: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          time: 'Due',
          link: '/employee/development',
          meta: 'Training',
          iconKind: 'training',
          quickView: quickView(l.course || 'Training', [
            { label: 'Due', value: formatDate(l.due_date) },
            { label: 'Status', value: l.status },
            { label: 'Progress', value: `${l.progress ?? 0}%` },
          ], 'Open in Learning', trainingQuickExtras(l)),
        })
      }
    })
}

function pushDueSoonNotifications(items: EmployeePortalFeedItem[], input: EmployeePortalFeedInput): void {
  const now = Date.now()
  const in5Days = now + 5 * 24 * 60 * 60 * 1000

  input.goals
    .filter((g) => {
      if (g.status === 'Complete' || g.status === 'Cancelled' || !g.due_date) return false
      const due = new Date(g.due_date).getTime()
      return due <= in5Days && due >= now
    })
    .slice(0, 3)
    .forEach((g, i) => {
      const dueMs = new Date(g.due_date).getTime()
      const dueRank = rankFromDueTimestamp(dueMs, now)
      items.push({
        id: `notif-goal-${g.id ?? i}`,
        scope: 'for_you',
        category: 'notification',
        sortAt: dueMs,
        priorityRank: Math.max(dueRank.rank, FEED_PRIORITY.UNREAD_ALERT),
        urgencyLabel: dueRank.label ?? 'Due soon',
        title: `Goal "${(g.goal || '').slice(0, 30)}…" is due soon`,
        subtitle: 'Due ' + formatDateOnly(g.due_date),
        link: '/employee/goals',
        unread: true,
        iconKind: 'bell',
        quickView: quickView(g.goal || 'Goal', [
          { label: 'Due', value: formatDate(g.due_date) },
          { label: 'Status', value: g.status },
        ], 'Open in Goals', goalQuickExtras(g)),
      })
    })

  input.learningPaths
    .filter((l) => {
      if (l.status === 'completed' || !l.due_date) return false
      const due = new Date(l.due_date).getTime()
      return due <= in5Days && due >= now
    })
    .slice(0, 3)
    .forEach((l, i) => {
      const dueMs = new Date(l.due_date).getTime()
      const dueRank = rankFromDueTimestamp(dueMs, now)
      items.push({
        id: `notif-training-${l.id ?? i}`,
        scope: 'for_you',
        category: 'notification',
        sortAt: dueMs,
        priorityRank: Math.max(dueRank.rank, FEED_PRIORITY.UNREAD_ALERT),
        urgencyLabel: dueRank.label ?? 'Due soon',
        title: `Training "${(l.course || '').slice(0, 28)}…" is due soon`,
        subtitle: 'Due ' + formatDateOnly(l.due_date),
        link: '/employee/development',
        unread: true,
        iconKind: 'bell',
        quickView: quickView(l.course || 'Training', [
          { label: 'Due', value: formatDate(l.due_date) },
          { label: 'Status', value: l.status },
        ], 'Open in Learning', trainingQuickExtras(l)),
      })
    })
}

function pushRecognitions(
  items: EmployeePortalFeedItem[],
  recognitions: Recognition[]
): void {
  recognitions.slice(0, 5).forEach((r) => {
    items.push({
      id: `recognition-${r.id}`,
      scope: 'for_you',
      category: 'recognition',
      sortAt: new Date(r.recognition_date || r.created_at).getTime(),
      priorityRank: FEED_PRIORITY.RECOGNITION,
      title: `${r.from_name} recognized you`,
      subtitle: (r.message || r.category || r.type).slice(0, 120),
      time: formatRelativeTime(r.created_at),
      link: '/employee/performance',
      meta: r.type,
      iconKind: 'recognition',
      quickView: quickView(r.message || 'Recognition', [
        { label: 'From', value: r.from_name },
        { label: 'Type', value: r.type },
        { label: 'Category', value: r.category },
        { label: 'Date', value: formatDate(r.recognition_date || r.created_at) },
      ], 'Open in Performance', {
        layout: 'recognition',
        fromName: r.from_name,
        body: r.message || r.category || r.type,
        statusLabel: r.type,
        statusTone: 'info',
        timestamp: formatDate(r.recognition_date || r.created_at),
      }),
    })
  })
}

function pushHrActivities(
  items: EmployeePortalFeedItem[],
  activities: Activity[],
  employeeId: string,
  employeeName: string
): void {
  activities.forEach((a) => {
    const forYou = isHrActivityForYou(a, employeeId, employeeName)
    const company = isHrActivityCompany(a, employeeId)
    if (!forYou && !company) return

    items.push({
      id: `hr-activity-${a.id}`,
      scope: forYou ? 'for_you' : 'company',
      category: 'activity',
      sortAt: new Date(a.created_at).getTime(),
      priorityRank: FEED_PRIORITY.ACTIVITY,
      title: a.description,
      time: formatRelativeTime(a.created_at),
      link: forYou ? '/employee/performance' : '/employee/directory',
      meta: 'HR',
      iconKind: forYou ? 'star' : 'users',
      quickView: quickView(a.description, [
        { label: 'When', value: formatRelativeTime(a.created_at) },
        { label: 'Employee', value: a.employee_name || '—' },
        { label: 'Type', value: a.type },
      ], forYou ? 'Open in Performance' : 'Open Directory', {
        layout: 'activity',
        body: a.description,
        statusLabel: a.type,
      }),
    })
  })
}

function pushProjectActivities(
  items: EmployeePortalFeedItem[],
  projectActivities: EmployeePortalFeedInput['projectActivities'],
  employeeName: string,
  myProjectIds: Set<string>
): void {
  let companyActivityCount = 0

  projectActivities.forEach((a) => {
    const forYou = isProjectActivityForYou(a, employeeName, myProjectIds)
    if (!forYou) {
      if (companyActivityCount >= EMPLOYEE_PORTAL_PM_ACTIVITY_COMPANY_CAP) return
      companyActivityCount += 1
    }
    items.push({
      id: `pm-activity-${a.id}`,
      scope: forYou ? 'for_you' : 'company',
      category: forYou ? 'project' : 'activity',
      sortAt: new Date(a.created_at).getTime(),
      priorityRank: forYou ? FEED_PRIORITY.ASSIGNED : FEED_PRIORITY.ACTIVITY,
      title: a.description,
      subtitle: a.user ? `By ${a.user}` : undefined,
      time: formatRelativeTime(a.created_at),
      link: `/projects/${a.project_id}`,
      meta: 'Projects',
      iconKind: 'project',
      quickView: quickView(a.description, [
        { label: 'When', value: formatRelativeTime(a.created_at) },
        { label: 'By', value: a.user || '—' },
        { label: 'Activity type', value: a.type },
      ], 'Open in Projects', {
        layout: 'activity',
        body: a.description,
        fromName: a.user || undefined,
        statusLabel: a.type,
      }),
    })
  })
}

function pushAchievements(
  items: EmployeePortalFeedItem[],
  input: EmployeePortalFeedInput
): void {
  const { goalsCompleted, recognitionsCount, trainingCompleted } = input
  if (goalsCompleted > 0) {
    items.push({
      id: 'ach-goals',
      scope: 'for_you',
      category: 'achievement',
      sortAt: Date.now(),
      priorityRank: FEED_PRIORITY.ACHIEVEMENT,
      title: 'Goal Achiever',
      subtitle: `Completed ${goalsCompleted} goal${goalsCompleted === 1 ? '' : 's'}`,
      link: '/employee/goals',
      iconKind: 'award',
      quickView: quickView(`You've completed ${goalsCompleted} goal${goalsCompleted === 1 ? '' : 's'}.`, [
        { label: 'Completed goals', value: String(goalsCompleted) },
      ], 'Open in Goals', { layout: 'achievement', statusTone: 'success' }),
    })
  }
  if (recognitionsCount > 0) {
    items.push({
      id: 'ach-recognition',
      scope: 'for_you',
      category: 'achievement',
      sortAt: Date.now(),
      priorityRank: FEED_PRIORITY.ACHIEVEMENT,
      title: 'Team Player',
      subtitle: `Received ${recognitionsCount} recognition${recognitionsCount === 1 ? '' : 's'}`,
      link: '/employee/performance',
      iconKind: 'award',
      quickView: quickView(
        `You've received ${recognitionsCount} recognition${recognitionsCount === 1 ? '' : 's'} from your team.`,
        [{ label: 'Total recognitions', value: String(recognitionsCount) }],
        'Open in Performance',
        { layout: 'achievement', statusTone: 'success' }
      ),
    })
  }
  if (trainingCompleted > 0) {
    items.push({
      id: 'ach-training',
      scope: 'for_you',
      category: 'achievement',
      sortAt: Date.now(),
      priorityRank: FEED_PRIORITY.ACHIEVEMENT,
      title: 'Learning Champion',
      subtitle: `Completed ${trainingCompleted} training course${trainingCompleted === 1 ? '' : 's'}`,
      link: '/employee/development',
      iconKind: 'award',
      quickView: quickView(
        `You've completed ${trainingCompleted} training course${trainingCompleted === 1 ? '' : 's'}.`,
        [{ label: 'Courses completed', value: String(trainingCompleted) }],
        'Open in Learning',
        { layout: 'achievement', statusTone: 'success' }
      ),
    })
  }
}

function pushTimeOffFeedItems(items: EmployeePortalFeedItem[], requests: TimeOffRequest[]): void {
  const recentCutoff = Date.now() - 14 * 86400000
  requests.forEach((req) => {
    const sortAt = req.decided_at
      ? new Date(req.decided_at).getTime()
      : new Date(req.created_at).getTime()
    if (sortAt < recentCutoff && req.status !== 'Pending') return

    const isPending = req.status === 'Pending'
    const recentlyDecided =
      req.status !== 'Pending' &&
      req.decided_at &&
      new Date(req.decided_at).getTime() >= recentCutoff

    items.push({
      id: `timeoff-${req.id}`,
      scope: 'for_you',
      category: 'notification',
      sortAt,
      priorityRank: isPending
        ? FEED_PRIORITY.PENDING_TIME_OFF
        : recentlyDecided
          ? FEED_PRIORITY.ASSIGNED
          : FEED_PRIORITY.LOW,
      urgencyLabel: isPending ? 'Awaiting approval' : req.status,
      title: timeOffPortalNoticeTitle(req),
      subtitle: timeOffPortalNoticeBody(req).slice(0, 120),
      time: formatRelativeTime(req.decided_at ?? req.created_at),
      meta: 'Time off',
      unread: isPending || Boolean(recentlyDecided),
      iconKind: 'bell',
      quickView: quickView(timeOffPortalNoticeBody(req), [
        { label: 'Status', value: req.status },
        { label: 'Type', value: req.type },
        { label: 'Dates', value: `${formatDate(req.start_date)} – ${formatDate(req.end_date)}` },
      ], 'View in portal', {
        layout: 'timeoff',
        body: timeOffPortalNoticeBody(req),
        statusLabel: req.status,
        statusTone:
          req.status === 'Approved'
            ? 'success'
            : req.status === 'Denied'
              ? 'danger'
              : req.status === 'Pending'
                ? 'warning'
                : 'neutral',
        dueDate: `${formatDate(req.start_date)} – ${formatDate(req.end_date)}`,
      }),
    })
  })
}

/** Build unified portal feed items from HR, PM, and personal assignments. */
export function buildEmployeePortalFeed(
  input: EmployeePortalFeedInput & { nextReviewDate?: string | null }
): EmployeePortalFeedItem[] {
  const items: EmployeePortalFeedItem[] = []
  const myProjectIds = new Set(input.myProjects.map((p) => p.projectId))

  pushAssignedGoals(items, input.goals)
  pushAssignedTraining(items, input.learningPaths)
  pushAssignedProjects(items, input.myProjects)
  if (input.myWorkItems?.length) {
    pushAssignedWorkItems(items, input.myWorkItems)
  }
  pushUpcomingEvents(items, input)
  pushDueSoonNotifications(items, input)
  pushTimeOffFeedItems(items, input.timeOffRequests ?? [])
  pushRecognitions(items, input.recognitions)
  pushHrActivities(items, input.hrActivities, input.employeeId, input.employeeName)
  pushProjectActivities(items, input.projectActivities, input.employeeName, myProjectIds)
  pushAchievements(items, input)

  return sortEmployeePortalFeed(items)
}

export function filterEmployeePortalFeed(
  items: EmployeePortalFeedItem[],
  scope: EmployeeFeedScope,
  typeFilter: EmployeeFeedTypeFilter,
  moduleFilter: EmployeeFeedModuleFilter = 'all'
): EmployeePortalFeedItem[] {
  let filtered = items

  if (scope === 'for_you') {
    filtered = filtered.filter((i) => i.scope === 'for_you')
  } else if (scope === 'company') {
    filtered = filtered.filter((i) => i.scope === 'company')
  }

  if (typeFilter === 'assigned') {
    filtered = filtered.filter((i) => i.category === 'assigned')
  } else if (typeFilter === 'updates') {
    filtered = filtered.filter((i) => isUpdateFeedItem(i))
  } else if (typeFilter === 'deadlines') {
    filtered = filtered.filter((i) => isDeadlineFeedItem(i))
  } else if (typeFilter === 'achievements') {
    filtered = filtered.filter((i) => i.category === 'achievement')
  } else if (typeFilter === 'projects') {
    filtered = filtered.filter((i) => i.category === 'project')
  }

  if (moduleFilter !== 'all') {
    filtered = filtered.filter((i) => matchesFeedModuleFilter(i, moduleFilter))
  }

  return sortEmployeePortalFeed(filtered)
}

export function countUnreadForYou(items: EmployeePortalFeedItem[]): number {
  return items.filter((i) => i.scope === 'for_you' && i.unread).length
}

/** Merge Comms notification items into the portal feed with priority-aware sorting. */
export function mergeCommsIntoFeed(
  items: EmployeePortalFeedItem[],
  commsItems: EmployeePortalFeedItem[]
): EmployeePortalFeedItem[] {
  if (commsItems.length === 0) return sortEmployeePortalFeed(items)
  return sortEmployeePortalFeed([...items, ...commsItems])
}

/** Merge persisted user_notifications feed items (PM, HR, KYI, CS) into the portal feed. */
export function mergeUserNotificationsIntoFeed(
  items: EmployeePortalFeedItem[],
  notificationItems: EmployeePortalFeedItem[]
): EmployeePortalFeedItem[] {
  if (notificationItems.length === 0) return sortEmployeePortalFeed(items)
  return sortEmployeePortalFeed([...items, ...notificationItems])
}
