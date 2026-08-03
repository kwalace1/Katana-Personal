import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Clock, ChevronDown } from "lucide-react"
import { useState, useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type TaskStatus = "backlog" | "todo" | "in-progress" | "review" | "blocked" | "done"

interface Activity {
  id: string
  title: string
  projectName: string
  projectId: string
  status: TaskStatus
  time: string
  color: string
}

type ActivityFilter = "all" | TaskStatus

const FILTER_OPTIONS: { value: ActivityFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To do" },
  { value: "in-progress", label: "In progress" },
  { value: "review", label: "Review" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
]

interface RecentActivityWidgetProps {
  activities: Activity[]
  maxVisible?: number
  className?: string
  showFilter?: boolean
}

export function RecentActivityWidget({ 
  activities, 
  maxVisible = 3,
  className = "",
  showFilter = true,
}: RecentActivityWidgetProps) {
  const [expanded, setExpanded] = useState(false)
  const [filter, setFilter] = useState<ActivityFilter>("all")

  const filteredActivities = useMemo(() => {
    if (filter === "all") return activities
    return activities.filter((a) => a.status === filter)
  }, [activities, filter])

  const visibleActivities = expanded ? filteredActivities : filteredActivities.slice(0, maxVisible)
  const hasMore = filteredActivities.length > maxVisible

  const getStatusLabel = (status: TaskStatus) => status.replace("-", " ")

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
            <p className="text-xs text-muted-foreground">Latest updates across your projects</p>
          </div>
          {showFilter && (
            <Select value={filter} onValueChange={(v) => setFilter(v as ActivityFilter)}>
              <SelectTrigger className="w-[160px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_OPTIONS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {visibleActivities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 pb-3 border-b last:border-0 last:pb-0">
              <div className={`w-2 h-2 rounded-full mt-2 ${activity.color}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <p className="font-medium text-sm truncate">{activity.title}</p>
                  <Badge variant={activity.status === "done" ? "secondary" : "outline"} className="text-xs capitalize shrink-0">
                    {getStatusLabel(activity.status)}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activity.projectName}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>{activity.time}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {filteredActivities.length === 0 && (
          <p className="text-sm text-muted-foreground py-2">
            {filter === "all" ? "No recent activity." : `No tasks with status "${FILTER_OPTIONS.find((o) => o.value === filter)?.label ?? filter}".`}
          </p>
        )}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-3 text-muted-foreground hover:text-foreground"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Show less" : "Expand activity"}
            <ChevronDown className={`h-4 w-4 ml-1.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </Button>
        )}
      </CardContent>
    </Card>
  )
}