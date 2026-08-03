import { RecentActivityFeed, type FeedActivity } from '@/components/shared/recent-activity-feed'

export type HubFeedActivity = FeedActivity

export type { ActivityPeriod, ActivityModuleFilter } from '@/components/shared/recent-activity-feed'

interface HubActivityFeedProps {
  activities: HubFeedActivity[]
}

export function HubActivityFeed({ activities }: HubActivityFeedProps) {
  return (
    <div data-tour="hub-activity-feed">
      <RecentActivityFeed
        activities={activities}
        emptyMessage="No recent activity. Actions across all Katana modules will appear here."
      />
    </div>
  )
}
