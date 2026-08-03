import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "lucide-react"

interface UpcomingDeadlinesWidgetProps {
  count: number
  timeframe?: string
  className?: string
}

export function UpcomingDeadlinesWidget({ 
  count, 
  timeframe = "Next 7 days",
  className = "" 
}: UpcomingDeadlinesWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Upcoming Deadlines</CardTitle>
        <Calendar className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{count}</div>
        <p className="text-xs text-muted-foreground">
          {timeframe}
        </p>
      </CardContent>
    </Card>
  )
}







