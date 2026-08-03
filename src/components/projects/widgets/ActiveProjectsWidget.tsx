import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ActiveProjectsWidgetProps {
  activeProjects: number
  totalProjects: number
  className?: string
}

export function ActiveProjectsWidget({ 
  activeProjects, 
  totalProjects,
  className = "" 
}: ActiveProjectsWidgetProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardDescription>Active Projects</CardDescription>
        <CardTitle className="text-2xl">{activeProjects}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-muted-foreground">{totalProjects} total</div>
      </CardContent>
    </Card>
  )
}







