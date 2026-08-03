import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Wrench } from 'lucide-react'
import { getJobsLinkedToProject } from '@/lib/wfm-integrations'
import { workforceTabPath } from '@/lib/wfm-deep-links'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import type { Job } from '@/lib/wfm-api'

interface PmProjectLinkedRecordsProps {
  projectId: string
}

export function PmProjectLinkedRecords({ projectId }: PmProjectLinkedRecordsProps) {
  const { allowedModules, canOrgIntegrate, hasModuleAccess } = useModuleAccess()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)

  const orgLinked = canOrgIntegrate('projects', 'workforce')
  const userCanOpenWfm = hasModuleAccess('workforce')

  useEffect(() => {
    if (!orgLinked) {
      setLoading(false)
      return
    }
    let cancelled = false
    void getJobsLinkedToProject(projectId).then((rows) => {
      if (cancelled) return
      setJobs(rows)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [projectId, orgLinked])

  if (!orgLinked || loading || jobs.length === 0) return null

  return (
    <Card className="mb-6">
      <CardHeader className="py-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Wrench className="h-4 w-4" />
          Linked workforce jobs ({jobs.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pb-4">
        {jobs.slice(0, 5).map((job) =>
          userCanOpenWfm ? (
            <Link
              key={job.id}
              to={workforceTabPath('work', 'list', job.id)}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0 hover:bg-muted/50 rounded px-1 -mx-1"
            >
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.job_number}</p>
              </div>
              <Badge variant="outline">{job.status}</Badge>
            </Link>
          ) : (
            <div
              key={job.id}
              className="flex items-center justify-between text-sm border-b pb-2 last:border-0"
            >
              <div>
                <p className="font-medium">{job.title}</p>
                <p className="text-xs text-muted-foreground">{job.job_number}</p>
              </div>
              <Badge variant="outline">{job.status}</Badge>
            </div>
          ),
        )}
        {userCanOpenWfm && (
          <Link to={workforceTabPath('work')} className="text-xs text-primary hover:underline">
            Open Workforce →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
