import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link } from "react-router-dom"
import type { Project } from "@/lib/project-data"

interface ProjectCardWidgetProps {
  project: Project
  className?: string
}

export function ProjectCardWidget({ project, className = "" }: ProjectCardWidgetProps) {
  return (
    <Link to={`/projects/${project.id}`}>
      <Card className={`hover:shadow-lg transition-shadow cursor-pointer ${className}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{project.name}</CardTitle>
            <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
              {project.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{project.progress}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${project.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{project.completedTasks}/{project.totalTasks} tasks</span>
              <span>{project.team.length} members</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}







