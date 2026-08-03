import { History, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmployeePortalFeedCaughtUpProps {
  historyCount: number
  onShowHistory: () => void
}

export function EmployeePortalFeedCaughtUp({
  historyCount,
  onShowHistory,
}: EmployeePortalFeedCaughtUpProps) {
  return (
    <Card className="employee-portal-card border shadow-sm">
      <CardContent className="flex flex-col items-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <p className="text-base font-medium text-foreground">You&apos;re all caught up</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          No new updates need your attention. New messages, assignments, and alerts will appear
          here.
        </p>
        {historyCount > 0 && (
          <Button type="button" variant="outline" size="sm" className="mt-5" onClick={onShowHistory}>
            <History className="mr-1.5 h-4 w-4" />
            View past updates ({historyCount})
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
