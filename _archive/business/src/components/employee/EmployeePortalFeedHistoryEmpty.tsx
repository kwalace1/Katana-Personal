import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmployeePortalFeedHistoryEmptyProps {
  onShowActive: () => void
}

export function EmployeePortalFeedHistoryEmpty({ onShowActive }: EmployeePortalFeedHistoryEmptyProps) {
  return (
    <Card className="employee-portal-card border shadow-sm">
      <CardContent className="flex flex-col items-center py-12 text-center text-muted-foreground">
        <p>No past items match this filter.</p>
        <p className="mt-1 text-sm">Try a different filter, or return to your inbox.</p>
        <Button type="button" variant="outline" size="sm" className="mt-4" onClick={onShowActive}>
          <ArrowLeft className="mr-1.5 h-4 w-4" />
          Back to inbox
        </Button>
      </CardContent>
    </Card>
  )
}
