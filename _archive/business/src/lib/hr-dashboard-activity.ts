import type { Activity, Employee, Goal, LearningPath, Mentorship, PerformanceReview, Recognition } from './hr-api'
import type { JobApplication } from './recruitment-db'

export type HrDashboardActivityItem = {
  id: string
  message: string
  time: string
  sortAt: number
  category: 'HR' | 'Recruitment' | 'Training'
  variant: 'success' | 'warning' | 'info'
}

function parseTime(value: string | null | undefined): number {
  if (!value) return 0
  const ms = new Date(value).getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export function formatRelativeTime(iso: string): string {
  const ms = parseTime(iso)
  if (!ms) return 'Recently'
  const diffSec = Math.floor((Date.now() - ms) / 1000)
  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`
  return new Date(ms).toLocaleDateString()
}

function push(
  items: HrDashboardActivityItem[],
  partial: {
    id: string
    message: string
    createdAt: string
    category: HrDashboardActivityItem['category']
    variant: HrDashboardActivityItem['variant']
  }
) {
  const sortAt = parseTime(partial.createdAt)
  if (!sortAt) return
  items.push({
    id: partial.id,
    message: partial.message,
    sortAt,
    time: formatRelativeTime(partial.createdAt),
    category: partial.category,
    variant: partial.variant,
  })
}

export type BuildHrDashboardActivitiesInput = {
  employees: Employee[]
  reviews: PerformanceReview[]
  goals: Goal[]
  applications: JobApplication[]
  recognitions: Recognition[]
  learningPaths: LearningPath[]
  mentorships: Mentorship[]
}

/** Build activity feed items from HR module data (works even when hr_activities is empty). */
export function buildHrDashboardActivities(input: BuildHrDashboardActivitiesInput): HrDashboardActivityItem[] {
  const items: HrDashboardActivityItem[] = []

  for (const emp of input.employees) {
    push(items, {
      id: `emp-${emp.id}`,
      message: `${emp.name} added to ${emp.department || 'the team'} as ${emp.position}`,
      createdAt: emp.created_at,
      category: 'HR',
      variant: 'info',
    })
  }

  for (const review of input.reviews) {
    const name = review.employee?.name ?? 'Employee'
    push(items, {
      id: `review-${review.id}`,
      message: `Performance review recorded for ${name} (${review.review_period})`,
      createdAt: review.created_at ?? review.review_date,
      category: 'HR',
      variant: 'success',
    })
  }

  for (const goal of input.goals) {
    const name = goal.employee?.name ?? 'Employee'
    const completed = goal.status === 'Complete'
    push(items, {
      id: `goal-${goal.id}`,
      message: completed
        ? `${name} completed goal: ${goal.goal}`
        : `Goal set for ${name}: ${goal.goal}`,
      createdAt: goal.updated_at ?? goal.created_at ?? goal.created_date,
      category: 'HR',
      variant: completed ? 'success' : goal.status === 'Behind' ? 'warning' : 'info',
    })
  }

  for (const app of input.applications) {
    const label = app.anonymousId ?? 'Candidate'
    push(items, {
      id: `app-${app.id ?? label}`,
      message: `New application for ${app.jobTitle ?? 'open role'} (${label})`,
      createdAt: app.appliedDate ?? '',
      category: 'Recruitment',
      variant: app.status === 'new' ? 'info' : 'success',
    })
  }

  for (const rec of input.recognitions) {
    push(items, {
      id: `rec-${rec.id}`,
      message: `${rec.from_name} recognized ${rec.to_name}`,
      createdAt: rec.created_at ?? rec.recognition_date,
      category: 'HR',
      variant: 'success',
    })
  }

  for (const lp of input.learningPaths) {
    const name = lp.employee?.name ?? 'Employee'
    const done = lp.status === 'completed'
    push(items, {
      id: `lp-${lp.id}`,
      message: done
        ? `${name} completed training: ${lp.course}`
        : `Training assigned to ${name}: ${lp.course}`,
      createdAt: lp.updated_at ?? lp.created_at,
      category: 'Training',
      variant: done ? 'success' : 'info',
    })
  }

  for (const m of input.mentorships) {
    const mentor = m.mentor?.name ?? 'Mentor'
    const mentee = m.mentee?.name ?? 'Mentee'
    push(items, {
      id: `mentor-${m.id}`,
      message: `Mentorship started: ${mentor} ↔ ${mentee}`,
      createdAt: m.created_at ?? m.start_date,
      category: 'HR',
      variant: 'info',
    })
  }

  return items.sort((a, b) => b.sortAt - a.sortAt)
}

const LOGGED_SUCCESS_TYPES = new Set(['goal_completed', 'review_completed', 'recognition_given'])

export function mergeHrDashboardActivities(
  logged: Activity[],
  synthesized: HrDashboardActivityItem[],
  limit = 10
): HrDashboardActivityItem[] {
  const fromLog: HrDashboardActivityItem[] = logged.map((a) => ({
    id: `log-${a.id}`,
    message: a.description,
    sortAt: parseTime(a.created_at),
    time: formatRelativeTime(a.created_at),
    category: 'HR' as const,
    variant: LOGGED_SUCCESS_TYPES.has(a.type) ? 'success' : 'info',
  }))

  const seen = new Set<string>()
  const merged = [...fromLog, ...synthesized]
    .filter((item) => {
      const key = `${item.message}|${item.sortAt}`
      if (seen.has(key)) return false
      seen.add(key)
      return item.sortAt > 0
    })
    .sort((a, b) => b.sortAt - a.sortAt)

  return merged.slice(0, limit)
}
