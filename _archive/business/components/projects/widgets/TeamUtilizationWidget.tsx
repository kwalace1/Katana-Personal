import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

interface TeamUtilizationWidgetProps {
  utilizationPercentage: number
  className?: string
}

export function TeamUtilizationWidget({ 
  utilizationPercentage,
  className = "" 
}: TeamUtilizationWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>Team Utilization</CardDescription>
        <CardTitle className="text-2xl">{utilizationPercentage}%</CardTitle>
      </CardHeader>
      <CardContent>
        <Progress value={utilizationPercentage} className="h-1" />
      </CardContent>
    </Card>
  )
}







