/**
 * Deep links into the Workforce module — used by Hub, notifications, and activity feed.
 */

export type WorkforceTab = 'today' | 'work' | 'team' | 'time'
export type WorkforceWorkSubTab = 'list' | 'board' | 'schedule' | 'reports'

export function workforceTabPath(
  tab: WorkforceTab = 'today',
  workSubTab?: WorkforceWorkSubTab,
  jobId?: string,
): string {
  const params = new URLSearchParams({ tab })
  if (tab === 'work' && workSubTab) {
    params.set('work', workSubTab)
  }
  if (jobId) {
    params.set('job', jobId)
  }
  return `/workforce?${params.toString()}`
}

export function parseWorkforceSearchParams(search: string): {
  tab: WorkforceTab | null
  workSubTab: WorkforceWorkSubTab | null
  jobId: string | null
} {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tab = params.get('tab') as WorkforceTab | null
  const workSubTab = params.get('work') as WorkforceWorkSubTab | null
  const jobId = params.get('job')
  return { tab, workSubTab, jobId }
}

export function isWorkforceTab(value: string | null): value is WorkforceTab {
  return value === 'today' || value === 'work' || value === 'team' || value === 'time'
}

export function isWorkforceWorkSubTab(value: string | null): value is WorkforceWorkSubTab {
  return value === 'list' || value === 'board' || value === 'schedule' || value === 'reports'
}
