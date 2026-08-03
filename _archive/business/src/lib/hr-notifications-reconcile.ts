import type { JobApplication } from '@/lib/recruitment-db'

/**
 * Notify HR stakeholders when interviews are today or tomorrow (deduped per day).
 */
export async function reconcileHrInterviewReminders(
  applications: JobApplication[]
): Promise<JobApplication[]> {
  const now = Date.now()
  const dayMs = 24 * 60 * 60 * 1000
  const { notifyHrInterviewReminder } = await import('@/lib/notification-modules')

  for (const app of applications) {
    if (!app.id || !app.interviewDate) continue
    if (app.status === 'rejected' || app.status === 'withdrawn') continue

    const interviewMs = new Date(app.interviewDate).getTime()
    if (Number.isNaN(interviewMs)) continue

    const daysUntil = Math.ceil((interviewMs - now) / dayMs)
    if (daysUntil === 0 || daysUntil === 1) {
      void notifyHrInterviewReminder(app, daysUntil)
    }
  }

  return applications
}
