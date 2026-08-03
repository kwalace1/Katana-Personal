import { Check, Clock, Edit, Plus, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WfmStatCard } from '@/components/workforce/WfmStatCard'
import { WfmEmptyState } from '@/components/workforce/WfmEmptyState'
import { calculateWfmHours, getWfmTimesheetStatusColor } from '@/lib/wfm-timesheet-utils'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { WorkforceTabLayoutProps } from '@/lib/workforce/workforce-widget-layout'

export interface WfmTimesheetEntry {
  id: string
  technician: string
  date: string
  dateIso: string
  jobId: string
  jobTitle: string
  clockIn: string
  clockOut: string
  hours: number
  status: string
  notes: string
}

interface WfmTimeTabProps {
  terms: WfmTerminology
  timesheets: WfmTimesheetEntry[]
  technicians: Array<{ name: string }>
  jobs: Array<{ id: string; title: string }>
  selectedIds: string[]
  isAddOpen: boolean
  editingId: string | null
  approvingId: string | null
  newTechnician: string
  newJob: string
  newDate: string
  newClockIn: string
  newClockOut: string
  newNotes: string
  editTechnician: string
  editJob: string
  editDate: string
  editClockIn: string
  editClockOut: string
  editStatus: string
  editNotes: string
  onSelectAll: (checked: boolean) => void
  onSelect: (id: string, checked: boolean) => void
  onDeleteSelected: () => void
  onAddOpenChange: (open: boolean) => void
  onAdd: () => void
  onEdit: (id: string) => void
  onSaveEdit: () => void
  onEditOpenChange: (open: boolean) => void
  onApprove: (id: string) => void
  onReject: (id: string) => void
  setNewTechnician: (v: string) => void
  setNewJob: (v: string) => void
  setNewDate: (v: string) => void
  setNewClockIn: (v: string) => void
  setNewClockOut: (v: string) => void
  setNewNotes: (v: string) => void
  setEditDate: (v: string) => void
  setEditClockIn: (v: string) => void
  setEditClockOut: (v: string) => void
  setEditStatus: (v: string) => void
  setEditNotes: (v: string) => void
  layout: WorkforceTabLayoutProps
}

export function WfmTimeTab({
  terms,
  timesheets,
  technicians,
  jobs,
  selectedIds,
  isAddOpen,
  editingId,
  approvingId,
  newTechnician,
  newJob,
  newDate,
  newClockIn,
  newClockOut,
  newNotes,
  editTechnician,
  editJob,
  editDate,
  editClockIn,
  editClockOut,
  editStatus,
  editNotes,
  onSelectAll,
  onSelect,
  onDeleteSelected,
  onAddOpenChange,
  onAdd,
  onEdit,
  onSaveEdit,
  onEditOpenChange,
  onApprove,
  onReject,
  setNewTechnician,
  setNewJob,
  setNewDate,
  setNewClockIn,
  setNewClockOut,
  setNewNotes,
  setEditDate,
  setEditClockIn,
  setEditClockOut,
  setEditStatus,
  setEditNotes,
  layout,
}: WfmTimeTabProps) {
  const activeClockIns = timesheets.filter((t) => t.status === 'Clocked In').length
  const hoursToday = timesheets
    .filter((t) => new Date(t.date).toDateString() === new Date().toDateString())
    .reduce((sum, t) => sum + calculateWfmHours(t.clockIn, t.clockOut), 0)
  const totalHours = timesheets.reduce((sum, t) => sum + calculateWfmHours(t.clockIn, t.clockOut), 0)
  const pendingCount = timesheets.filter((t) => t.status === 'Pending Approval').length

  return (
    <div data-tour="wfm-timesheet">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'time_kpi_strip') {
            return (
              <div className="h-full grid grid-cols-2 md:grid-cols-4 gap-3 content-start">
                <WfmStatCard label="Active clock-ins" value={activeClockIns} icon={Clock} accent="success" />
                <WfmStatCard
                  label="Hours today"
                  value={hoursToday.toFixed(1)}
                  icon={Clock}
                  accent="blue"
                />
                <WfmStatCard label="Total hours" value={totalHours.toFixed(1)} icon={Clock} />
                <WfmStatCard
                  label="Pending approval"
                  value={pendingCount}
                  icon={Clock}
                  accent={pendingCount > 0 ? 'warning' : 'default'}
                />
              </div>
            )
          }

          if (widgetId !== 'timesheet') return null

          return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>Time tracking</CardTitle>
            <CardDescription>
              Review hours logged by {terms.teamMemberPlural.toLowerCase()} — approve entries for payroll
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIds.length})
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={onAddOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add timesheet entry</DialogTitle>
                  <DialogDescription>Record time for a {terms.teamMember.toLowerCase()}</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wfm-time-tech">{terms.teamMember} *</Label>
                    <Select value={newTechnician} onValueChange={setNewTechnician}>
                      <SelectTrigger id="wfm-time-tech">
                        <SelectValue placeholder={`Select ${terms.teamMember.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((tech, index) => (
                          <SelectItem key={index} value={tech.name}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wfm-time-job">{terms.workItem} *</Label>
                    <Select value={newJob} onValueChange={setNewJob}>
                      <SelectTrigger id="wfm-time-job">
                        <SelectValue placeholder={`Select ${terms.workItemLower}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.title}>
                            {job.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="wfm-time-date">Date *</Label>
                    <Input
                      id="wfm-time-date"
                      type="date"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="wfm-time-in">Clock in *</Label>
                      <Input
                        id="wfm-time-in"
                        type="time"
                        value={newClockIn}
                        onChange={(e) => setNewClockIn(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="wfm-time-out">Clock out</Label>
                      <Input
                        id="wfm-time-out"
                        type="time"
                        value={newClockOut}
                        onChange={(e) => setNewClockOut(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="wfm-time-notes">Notes</Label>
                    <Textarea
                      id="wfm-time-notes"
                      placeholder="Optional notes"
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={onAdd}>
                    Add entry
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {pendingCount > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {pendingCount} {pendingCount === 1 ? 'entry needs' : 'entries need'} your approval
            </span>
            <span className="text-muted-foreground"> — use the checkmarks in the table below.</span>
          </div>
        )}

        {timesheets.length === 0 ? (
          <WfmEmptyState
            icon={Clock}
            title="No time entries yet"
            description={`${terms.teamMemberPlural} can clock in from My work, or you can add entries manually.`}
            actionLabel="Add entry"
            onAction={() => onAddOpenChange(true)}
          />
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectedIds.length === timesheets.length && timesheets.length > 0}
                      onCheckedChange={onSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>{terms.teamMember}</TableHead>
                  <TableHead>{terms.workItem}</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Hours</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheets.map((timesheet) => {
                  const isPending = timesheet.status === 'Pending Approval'
                  const isActing = approvingId === timesheet.id
                  return (
                    <TableRow key={timesheet.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(timesheet.id)}
                          onCheckedChange={(checked) => onSelect(timesheet.id, checked as boolean)}
                        />
                      </TableCell>
                      <TableCell>{new Date(timesheet.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{timesheet.technician}</TableCell>
                      <TableCell className="max-w-[160px] truncate">{timesheet.jobTitle}</TableCell>
                      <TableCell>{timesheet.clockIn}</TableCell>
                      <TableCell>{timesheet.clockOut || '—'}</TableCell>
                      <TableCell className="tabular-nums">
                        {calculateWfmHours(timesheet.clockIn, timesheet.clockOut).toFixed(1)}h
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getWfmTimesheetStatusColor(timesheet.status)}>
                          {timesheet.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {isPending && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                disabled={isActing}
                                title="Approve"
                                onClick={() => onApprove(timesheet.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                disabled={isActing}
                                title="Reject"
                                onClick={() => onReject(timesheet.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(timesheet.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog open={editingId !== null} onOpenChange={onEditOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit timesheet entry</DialogTitle>
              <DialogDescription>Update time entry details</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>{terms.teamMember}</Label>
                <Input value={editTechnician} disabled />
              </div>
              <div>
                <Label>{terms.workItem}</Label>
                <Input value={editJob} disabled />
              </div>
              <div>
                <Label htmlFor="wfm-edit-date">Date</Label>
                <Input
                  id="wfm-edit-date"
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wfm-edit-in">Clock in</Label>
                  <Input
                    id="wfm-edit-in"
                    type="time"
                    value={editClockIn}
                    onChange={(e) => setEditClockIn(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="wfm-edit-out">Clock out</Label>
                  <Input
                    id="wfm-edit-out"
                    type="time"
                    value={editClockOut}
                    onChange={(e) => setEditClockOut(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wfm-edit-status">Status</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger id="wfm-edit-status">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Clocked In">Clocked In</SelectItem>
                    <SelectItem value="Clocked Out">Clocked Out</SelectItem>
                    <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="wfm-edit-notes">Notes</Label>
                <Textarea
                  id="wfm-edit-notes"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={onSaveEdit}>
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
