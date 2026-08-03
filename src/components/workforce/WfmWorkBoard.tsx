import { Briefcase, LayoutGrid, List, MapPin, Plus, Trash2, Edit } from 'lucide-react'
import { WfmEmptyState } from '@/components/workforce/WfmEmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CustomerAccountPicker } from '@/components/customers/CustomerAccountPicker'
import type { Client } from '@/lib/customer-success-api'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import {
  getWfmStatusColor,
  statusToApi,
  type WfmLegacyJob,
  type WfmDisplayStatus,
} from '@/lib/wfm-job-utils'
import { WfmWorkKanban } from '@/components/workforce/WfmWorkKanban'
import { WfmJobIntegrationsPanel } from '@/components/workforce/WfmJobIntegrationsPanel'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { WorkforceTabLayoutProps } from '@/lib/workforce/workforce-widget-layout'
import type { ReactNode } from 'react'

export type WfmWorkViewMode = 'list' | 'board'

interface WfmWorkBoardProps {
  terms: WfmTerminology
  viewMode: WfmWorkViewMode
  jobs: WfmLegacyJob[]
  technicians: Array<{ name: string }>
  selectedJobIds: string[]
  isCreateJobOpen: boolean
  newJobTitle: string
  newJobDescription: string
  newJobAddress: string
  newJobTechnician: string
  newJobStartDate: string
  newJobEndDate: string
  newJobStatus: string
  newJobClientId: string
  editingJob: string | null
  editJobTitle: string
  editJobTechnician: string
  editJobStartDate: string
  editJobEndDate: string
  editJobStatus: string
  editJobLocation: string
  editJobDbId: string | null
  editJobClientId: string | null
  editJobInvoiceId: string | null
  editJobProjectId: string | null
  editJobTaskId: string | null
  onIntegrationsUpdated?: () => void
  onSelectAll: (checked: boolean) => void
  onSelectJob: (id: string, checked: boolean) => void
  onDeleteSelected: () => void
  onOpenJob: (job: WfmLegacyJob) => void
  onViewLocation: (jobId: string) => void
  onCreateDialogOpenChange: (open: boolean) => void
  onCreateJob: () => void
  onSaveJobEdit: () => void
  onEditDialogOpenChange: (open: boolean) => void
  onKanbanStatusChange: (job: WfmLegacyJob, status: WfmDisplayStatus) => Promise<void>
  setNewJobTitle: (v: string) => void
  setNewJobDescription: (v: string) => void
  setNewJobAddress: (v: string) => void
  setNewJobTechnician: (v: string) => void
  setNewJobStartDate: (v: string) => void
  setNewJobEndDate: (v: string) => void
  setNewJobStatus: (v: string) => void
  setNewJobClientId: (id: string, client: Client | null) => void
  setEditJobTitle: (v: string) => void
  setEditJobTechnician: (v: string) => void
  setEditJobStartDate: (v: string) => void
  setEditJobEndDate: (v: string) => void
  setEditJobStatus: (v: string) => void
  setEditJobLocation: (v: string) => void
  emphasizeLocation?: boolean
  createJobExtra?: ReactNode
  layout: WorkforceTabLayoutProps
}

export function WfmWorkBoard({
  terms,
  viewMode,
  jobs,
  technicians,
  selectedJobIds,
  isCreateJobOpen,
  newJobTitle,
  newJobDescription,
  newJobAddress,
  newJobTechnician,
  newJobStartDate,
  newJobEndDate,
  newJobStatus,
  newJobClientId,
  editingJob,
  editJobTitle,
  editJobTechnician,
  editJobStartDate,
  editJobEndDate,
  editJobStatus,
  editJobLocation,
  editJobDbId,
  editJobClientId,
  editJobInvoiceId,
  editJobProjectId,
  editJobTaskId,
  onIntegrationsUpdated,
  onSelectAll,
  onSelectJob,
  onDeleteSelected,
  onOpenJob,
  onViewLocation,
  onCreateDialogOpenChange,
  onCreateJob,
  onSaveJobEdit,
  onEditDialogOpenChange,
  onKanbanStatusChange,
  setNewJobTitle,
  setNewJobDescription,
  setNewJobAddress,
  setNewJobTechnician,
  setNewJobStartDate,
  setNewJobEndDate,
  setNewJobStatus,
  setNewJobClientId,
  setEditJobTitle,
  setEditJobTechnician,
  setEditJobStartDate,
  setEditJobEndDate,
  setEditJobStatus,
  setEditJobLocation,
  emphasizeLocation = false,
  layout,
}: WfmWorkBoardProps) {
  return (
    <div data-tour="wfm-jobs">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId !== 'jobs') return null
          return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>All {terms.workItemPlural}</CardTitle>
            <CardDescription>
              {viewMode === 'board'
                ? `Drag cards to update status — ${terms.workItemPlural.toLowerCase()} board`
                : `Manage all ${terms.workItemPlural.toLowerCase()} in one place`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectedJobIds.length > 0 && viewMode === 'list' && (
              <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedJobIds.length})
              </Button>
            )}
            <Dialog open={isCreateJobOpen} onOpenChange={onCreateDialogOpenChange}>
              <DialogTrigger asChild>
                <Button data-tour="wfm-new-job">
                  <Plus className="h-4 w-4 mr-2" />
                  {terms.newWorkItem}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{terms.newWorkItem}</DialogTitle>
                  <DialogDescription>Add a new {terms.workItemLower} to the system</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wfm-board-title">Title *</Label>
                    <Input
                      id="wfm-board-title"
                      placeholder={`Enter ${terms.workItemLower} title`}
                      value={newJobTitle}
                      onChange={(e) => setNewJobTitle(e.target.value)}
                    />
                  </div>
                  <CustomerAccountPicker
                    value={newJobClientId}
                    onChange={setNewJobClientId}
                    label="Link customer (optional)"
                  />
                  <div>
                    <Label htmlFor="wfm-board-description">Description</Label>
                    <Textarea
                      id="wfm-board-description"
                      value={newJobDescription}
                      onChange={(e) => setNewJobDescription(e.target.value)}
                    />
                  </div>
                  {emphasizeLocation && (
                    <div>
                      <Label htmlFor="wfm-board-address">{terms.locationLabel}</Label>
                      <Input
                        id="wfm-board-address"
                        placeholder="Street, city, state, zip"
                        value={newJobAddress}
                        onChange={(e) => setNewJobAddress(e.target.value)}
                      />
                    </div>
                  )}
                  <div>
                    <Label htmlFor="wfm-board-assign">{terms.assignLabel}</Label>
                    <Select value={newJobTechnician} onValueChange={setNewJobTechnician}>
                      <SelectTrigger id="wfm-board-assign">
                        <SelectValue placeholder={`Select ${terms.teamMember.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Unassigned">Unassigned</SelectItem>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.name} value={tech.name}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wfm-board-start">Start date *</Label>
                      <Input
                        id="wfm-board-start"
                        type="date"
                        value={newJobStartDate}
                        onChange={(e) => setNewJobStartDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="wfm-board-end">End date *</Label>
                      <Input
                        id="wfm-board-end"
                        type="date"
                        value={newJobEndDate}
                        onChange={(e) => setNewJobEndDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button className="w-full" onClick={onCreateJob}>
                    Create {terms.workItem}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {viewMode === 'board' ? (
          <WfmWorkKanban
            terms={terms}
            jobs={jobs}
            onJobClick={onOpenJob}
            onStatusChange={onKanbanStatusChange}
          />
        ) : jobs.length === 0 ? (
          <WfmEmptyState
            icon={Briefcase}
            title={`No ${terms.workItemPlural.toLowerCase()} yet`}
            description={`Create your first ${terms.workItemLower} to start scheduling and assigning work.`}
            actionLabel={terms.newWorkItem}
            onAction={() => onCreateDialogOpenChange(true)}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-12">
                  <Checkbox
                    checked={selectedJobIds.length === jobs.length && jobs.length > 0}
                    onCheckedChange={onSelectAll}
                  />
                </TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>{terms.teamMember}</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenJob(job)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedJobIds.includes(job.id)}
                      onCheckedChange={(checked) => onSelectJob(job.id, checked as boolean)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{job.id}</TableCell>
                  <TableCell>{job.title}</TableCell>
                  <TableCell>{job.technician}</TableCell>
                  <TableCell>{job.startDate}</TableCell>
                  <TableCell>{job.endDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getWfmStatusColor(job.status)}>
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onOpenJob(job)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      {emphasizeLocation && (
                        <Button variant="ghost" size="sm" onClick={() => onViewLocation(job.id)}>
                          <MapPin className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        )}

        <Dialog open={!!editingJob} onOpenChange={onEditDialogOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit {terms.workItem}</DialogTitle>
              <DialogDescription>Update {terms.workItemLower} details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="wfm-edit-title">Title *</Label>
                <Input id="wfm-edit-title" value={editJobTitle} onChange={(e) => setEditJobTitle(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="wfm-edit-assign">{terms.assignLabel}</Label>
                <Select value={editJobTechnician || 'Unassigned'} onValueChange={setEditJobTechnician}>
                  <SelectTrigger id="wfm-edit-assign">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.name} value={tech.name}>
                        {tech.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wfm-edit-start">Start date *</Label>
                  <Input
                    id="wfm-edit-start"
                    type="date"
                    value={editJobStartDate}
                    onChange={(e) => setEditJobStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="wfm-edit-end">End date *</Label>
                  <Input
                    id="wfm-edit-end"
                    type="date"
                    value={editJobEndDate}
                    onChange={(e) => setEditJobEndDate(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wfm-edit-status">Status</Label>
                <Select value={editJobStatus} onValueChange={setEditJobStatus}>
                  <SelectTrigger id="wfm-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unassigned">Unassigned</SelectItem>
                    <SelectItem value="Assigned">Assigned</SelectItem>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {emphasizeLocation && (
                <div>
                  <Label htmlFor="wfm-edit-address">{terms.locationLabel}</Label>
                  <Input
                    id="wfm-edit-address"
                    value={editJobLocation}
                    onChange={(e) => setEditJobLocation(e.target.value)}
                  />
                </div>
              )}
              {editJobDbId && (
                <WfmJobIntegrationsPanel
                  jobDbId={editJobDbId}
                  clientId={editJobClientId}
                  invoiceId={editJobInvoiceId}
                  projectId={editJobProjectId}
                  taskId={editJobTaskId}
                  onUpdated={onIntegrationsUpdated}
                />
              )}
              <Button className="w-full" onClick={onSaveJobEdit}>
                Save changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
          )
        }}
      />
    </div>
  )
}

export { statusToApi }
