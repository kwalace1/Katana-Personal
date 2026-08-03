import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"

interface TotalProjectsWidgetProps {
  totalProjects: number
  activeProjects: number
  className?: string
}

export function TotalProjectsWidget({ 
  totalProjects, 
  activeProjects, 
  className = "" 
}: TotalProjectsWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{totalProjects}</div>
        <p className="text-xs text-muted-foreground">
          {activeProjects} active
        </p>
      </CardContent>
    </Card>
  )
}







