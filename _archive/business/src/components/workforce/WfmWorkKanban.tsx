import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  WFM_KANBAN_COLUMNS,
  kanbanColumnForJob,
  getWfmStatusColor,
  type WfmLegacyJob,
  type WfmDisplayStatus,
} from '@/lib/wfm-job-utils'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import { cn } from '@/lib/utils'

interface WfmWorkKanbanProps {
  terms: WfmTerminology
  jobs: WfmLegacyJob[]
  onJobClick: (job: WfmLegacyJob) => void
  onStatusChange: (job: WfmLegacyJob, newDisplayStatus: WfmDisplayStatus) => Promise<void>
}

export function WfmWorkKanban({ terms, jobs, onJobClick, onStatusChange }: WfmWorkKanbanProps) {
  const [draggedJob, setDraggedJob] = useState<WfmLegacyJob | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<WfmDisplayStatus | null>(null)

  const jobsByColumn = WFM_KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = jobs.filter((j) => kanbanColumnForJob(j) === col.id)
      return acc
    },
    {} as Record<WfmDisplayStatus, WfmLegacyJob[]>,
  )

  const handleDrop = async (columnId: WfmDisplayStatus) => {
    if (!draggedJob) return
    setDragOverColumn(null)
    if (kanbanColumnForJob(draggedJob) === columnId) {
      setDraggedJob(null)
      return
    }
    await onStatusChange(draggedJob, columnId)
    setDraggedJob(null)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4" data-tour="wfm-board">
      {WFM_KANBAN_COLUMNS.map((column) => {
        const columnJobs = jobsByColumn[column.id] ?? []
        const isDropTarget = dragOverColumn === column.id

        return (
          <div
            key={column.id}
            className={cn(
              'flex flex-col rounded-xl border min-h-[360px] transition-all',
              isDropTarget && 'border-primary ring-2 ring-primary/20 bg-primary/5 scale-[1.01]',
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverColumn(column.id)
            }}
            onDragLeave={() => setDragOverColumn(null)}
            onDrop={(e) => {
              e.preventDefault()
              void handleDrop(column.id)
            }}
          >
            <div className={cn('p-3 rounded-t-xl border-b', column.color)}>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">{column.label}</h3>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  {columnJobs.length}
                </Badge>
              </div>
            </div>
            <div className="p-2 space-y-2 flex-1 bg-muted/20 rounded-b-xl">
              {columnJobs.map((job) => (
                <div
                  key={job.id}
                  draggable
                  onDragStart={() => setDraggedJob(job)}
                  onDragEnd={() => setDraggedJob(null)}
                  onClick={() => onJobClick(job)}
                  className={cn(
                    'rounded-lg border bg-card p-3 cursor-grab active:cursor-grabbing',
                    'hover:shadow-md hover:border-primary/30 transition-all text-sm',
                    draggedJob?.id === job.id && 'opacity-40 scale-95',
                  )}
                >
                  <p className="font-medium line-clamp-2 leading-snug">{job.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono">{job.id}</p>
                  <div className="flex items-center justify-between mt-2.5 gap-2">
                    <span className="text-xs text-muted-foreground truncate">
                      {job.technician === 'Unassigned' ? (
                        <span className="text-amber-600">Unassigned</span>
                      ) : (
                        job.technician
                      )}
                    </span>
                    <Badge variant="outline" className={cn('text-[10px] shrink-0', getWfmStatusColor(job.status))}>
                      {job.status}
                    </Badge>
                  </div>
                  {job.startDate && (
                    <p className="text-[10px] text-muted-foreground mt-1.5">{job.startDate}</p>
                  )}
                </div>
              ))}
              {columnJobs.length === 0 && (
                <div className="flex items-center justify-center h-24 rounded-lg border border-dashed border-muted-foreground/20">
                  <p className="text-xs text-muted-foreground">Drop {terms.workItemPlural.toLowerCase()} here</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export { statusToApi } from '@/lib/wfm-job-utils'
