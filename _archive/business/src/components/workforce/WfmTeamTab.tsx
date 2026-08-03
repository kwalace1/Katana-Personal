import { type ChangeEvent } from 'react'
import { UserPlus, FileText, Trash2, Edit, Loader2, RefreshCw, Link2, Users } from 'lucide-react'
import { WfmStatCard } from '@/components/workforce/WfmStatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { WfmTerminology } from '@/lib/wfm-terminology'
import type { WfmHrSyncResult } from '@/lib/wfm-api'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { WorkforceTabLayoutProps } from '@/lib/workforce/workforce-widget-layout'

export interface WfmTeamRow {
  name: string
  phone: string
  email?: string
  activeJobs: number
  status: string
  employee_id?: string | null
}

interface WfmTeamTabProps {
  terms: WfmTerminology
  technicians: WfmTeamRow[]
  selectedIndices: number[]
  isAddOpen: boolean
  isImportOpen: boolean
  newTechName: string
  newTechPhone: string
  newTechEmail: string
  importFile: File | null
  importPreview: Array<{ name: string; email: string; phone: string; role: string }>
  importResult: WfmHrSyncResult | { created: number; errors: string[] } | null
  importing: boolean
  syncing: boolean
  hrSyncResult: WfmHrSyncResult | null
  onSelectAll: (checked: boolean) => void
  onSelect: (index: number, checked: boolean) => void
  onDeleteSelected: () => void
  onEdit: (index: number) => void
  onAddOpenChange: (open: boolean) => void
  onImportOpenChange: (open: boolean) => void
  onAdd: () => void
  onImport: () => void
  onSyncFromHr: () => void
  onPhoneChange: (value: string) => void
  onImportFile: (e: ChangeEvent<HTMLInputElement>) => void
  setNewTechName: (v: string) => void
  setNewTechEmail: (v: string) => void
  layout: WorkforceTabLayoutProps
}

export function WfmTeamTab({
  terms,
  technicians,
  selectedIndices,
  isAddOpen,
  isImportOpen,
  newTechName,
  newTechPhone,
  newTechEmail,
  importFile,
  importPreview,
  importResult,
  importing,
  syncing,
  hrSyncResult,
  onSelectAll,
  onSelect,
  onDeleteSelected,
  onEdit,
  onAddOpenChange,
  onImportOpenChange,
  onAdd,
  onImport,
  onSyncFromHr,
  onPhoneChange,
  onImportFile,
  setNewTechName,
  setNewTechEmail,
  layout,
}: WfmTeamTabProps) {
  const linkedCount = technicians.filter((t) => t.employee_id).length
  const activeCount = technicians.filter((t) => t.status === 'Active').length
  const totalActiveJobs = technicians.reduce((sum, t) => sum + t.activeJobs, 0)

  return (
    <div data-tour="wfm-team">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'team_kpi_strip') {
            return (
              <div className="h-full grid grid-cols-2 md:grid-cols-4 gap-3 content-start">
                <WfmStatCard label="Roster size" value={technicians.length} icon={Users} />
                <WfmStatCard label="Active" value={activeCount} icon={Users} accent="success" />
                <WfmStatCard label="HR linked" value={linkedCount} icon={Link2} accent="primary" />
                <WfmStatCard
                  label="Active assignments"
                  value={totalActiveJobs}
                  icon={Users}
                  accent="blue"
                />
              </div>
            )
          }

          if (widgetId !== 'team_roster') return null

          return (
    <Card className="h-full overflow-auto">
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle>{terms.teamMemberPlural} management</CardTitle>
            <CardDescription>
              Manage your {terms.teamMemberPlural.toLowerCase()} — sync from HR to keep one roster
              {linkedCount > 0 && (
                <span className="ml-1 text-primary">
                  · {linkedCount} linked to HR
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={onSyncFromHr} disabled={syncing} data-tour="wfm-hr-sync">
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync from HR
            </Button>
            {selectedIndices.length > 0 && (
              <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ({selectedIndices.length})
              </Button>
            )}
            <Dialog open={isAddOpen} onOpenChange={onAddOpenChange}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add {terms.teamMember}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add {terms.teamMember}</DialogTitle>
                  <DialogDescription>Create a roster entry for assignments and time tracking</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="wfm-team-name">Full name *</Label>
                    <Input
                      id="wfm-team-name"
                      value={newTechName}
                      onChange={(e) => setNewTechName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wfm-team-phone">Phone</Label>
                    <Input
                      id="wfm-team-phone"
                      value={newTechPhone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      maxLength={14}
                    />
                  </div>
                  <div>
                    <Label htmlFor="wfm-team-email">Email</Label>
                    <Input
                      id="wfm-team-email"
                      type="email"
                      value={newTechEmail}
                      onChange={(e) => setNewTechEmail(e.target.value)}
                    />
                  </div>
                  <Button className="w-full" onClick={onAdd}>
                    Create {terms.teamMember}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isImportOpen} onOpenChange={onImportOpenChange}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Import CSV
                </Button>
              </DialogTrigger>
              <DialogContent size="md">
                <DialogHeader>
                  <DialogTitle>Import {terms.teamMemberPlural.toLowerCase()} from CSV</DialogTitle>
                  <DialogDescription>Columns: name, email, phone, role</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input type="file" accept=".csv" onChange={onImportFile} />
                  {importFile && (
                    <p className="text-xs text-muted-foreground">{importFile.name}</p>
                  )}
                  {importPreview.length > 0 && (
                    <div className="rounded-md border max-h-48 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Phone</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importPreview.map((row, i) => (
                            <TableRow key={i}>
                              <TableCell>{row.name}</TableCell>
                              <TableCell>{row.email}</TableCell>
                              <TableCell>{row.phone}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {importResult && (
                    <p className="text-sm">
                      <span className="text-green-600 font-medium">{importResult.created}</span> created
                      {'created' in importResult && importResult.errors?.length > 0 && (
                        <span className="text-destructive ml-2">{importResult.errors.length} errors</span>
                      )}
                    </p>
                  )}
                  <SwitchImportDivert
                    module="workforce"
                    entityType="wfm_technician"
                    sourceLabel="katana.workforce.csv_import"
                    file={importFile}
                    rows={importPreview.map((r) => ({ ...r }))}
                    disabled={!importFile && importPreview.length === 0}
                  />
                  <Button className="w-full" onClick={onImport} disabled={importPreview.length === 0 || importing}>
                    {importing ? 'Importing…' : 'Import'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        {hrSyncResult && (
          <p className="text-sm text-muted-foreground mt-2">
            Last sync: {hrSyncResult.created} created, {hrSyncResult.updated} updated
            {hrSyncResult.skipped > 0 && `, ${hrSyncResult.skipped} skipped (inactive)`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIndices.length === technicians.length && technicians.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Active {terms.workItemPlural}</TableHead>
              <TableHead>HR</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.map((tech, index) => (
              <TableRow key={`${tech.name}-${index}`}>
                <TableCell>
                  <Checkbox
                    checked={selectedIndices.includes(index)}
                    onCheckedChange={(checked) => onSelect(index, checked as boolean)}
                  />
                </TableCell>
                <TableCell className="font-medium">{tech.name}</TableCell>
                <TableCell>{tech.phone}</TableCell>
                <TableCell>{tech.activeJobs}</TableCell>
                <TableCell>
                  {tech.employee_id ? (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Link2 className="h-3 w-3" />
                      Linked
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">
                    {tech.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(index)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
          )
        }}
      />
    </div>
  )
}
