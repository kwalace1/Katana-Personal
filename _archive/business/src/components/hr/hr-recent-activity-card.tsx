import { useMemo } from 'react'
import { RecentActivityFeed, type FeedActivity } from '@/components/shared/recent-activity-feed'
import type { HrDashboardActivityItem } from '@/lib/hr-dashboard-activity'

type HrRecentActivityCardProps = {
  activities: HrDashboardActivityItem[]
  isLoading: boolean
}

function toFeedActivity(item: HrDashboardActivityItem): FeedActivity {
  return {
    type: item.variant,
    module: item.category,
    message: item.message,
    time: item.time,
    sortAt: item.sortAt,
  }
}

export function HrRecentActivityCard({ activities, isLoading }: HrRecentActivityCardProps) {
  const feedActivities = useMemo(() => activities.map(toFeedActivity), [activities])

  return (
    <RecentActivityFeed
      activities={feedActivities}
      isLoading={isLoading}
      emptyMessage="No recent activity. Employee, recruitment, and training events will appear here."
    />
  )
}
