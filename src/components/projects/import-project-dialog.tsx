import { useState, useMemo, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload } from 'lucide-react'
import { parseTabularFile, type ParseFileResult } from '@/lib/file-parse-utils'
import { buildProjectImportPreview, executePmProjectImport } from '@/lib/pm-project-import'
import type { Project } from '@/lib/project-data'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { toast } from 'sonner'

interface ImportProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Current user display for created_by */
  createdBy?: { name: string; avatar: string }
  onImported?: () => void
}

export function ImportProjectDialog({ open, onOpenChange, createdBy, onImported }: ImportProjectDialogProps) {
  const [parseResult, setParseResult] = useState<ParseFileResult | null>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [overrideName, setOverrideName] = useState('')
  const [overrideStatus, setOverrideStatus] = useState<Project['status']>('active')
  const [overrideDeadline, setOverrideDeadline] = useState('')

  useEffect(() => {
    if (!open) {
      setParseResult(null)
      setPickedFile(null)
      setOverrideName('')
      setOverrideStatus('active')
      setOverrideDeadline('')
    }
  }, [open])

  const preview = useMemo(() => {
    if (!parseResult?.ok) return null
    return buildProjectImportPreview(parseResult.sheets, {
      name: overrideName.trim() || undefined,
      status: overrideStatus,
      deadline: overrideDeadline.trim() || undefined,
    })
  }, [parseResult, overrideName, overrideStatus, overrideDeadline])

  const onPickFile = async (f: File | null) => {
    if (!f) {
      setParseResult(null)
      setPickedFile(null)
      return
    }
    setPickedFile(f)
    const outcome = await parseTabularFile(f)
    if (!outcome.ok) {
      toast.error(outcome.error)
      setParseResult(null)
      return
    }
    setParseResult(outcome)
  }

  const runImport = async () => {
    if (!parseResult?.ok || !preview) return
    if (!preview.mergedMeta) {
      toast.error('Enter a project name or add a Project sheet with a name.')
      return
    }
    if (preview.taskRowCount === 0) {
      toast.error('No task rows found. Check column headers (e.g. Title).')
      return
    }
    setBusy(true)
    try {
      const res = await executePmProjectImport({
        sheets: parseResult.sheets,
        override: {
          name: overrideName.trim() || undefined,
          status: overrideStatus,
          deadline: overrideDeadline.trim() || undefined,
        },
        createdBy,
      })
      toast.success('Project imported', {
        description: `${res.tasks.created} task${res.tasks.created === 1 ? '' : 's'} created.`,
      })
      if (res.tasks.errors.length) {
        toast.message('Some rows were skipped', { description: res.tasks.errors.slice(0, 2).join(' · ') })
      }
      onImported?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import project</DialogTitle>
          <DialogDescription>
            Use an Excel workbook with a <strong>Project</strong> sheet (one row: name, status, deadline, description,
            owner) and a <strong>Tasks</strong> sheet (columns like Title, Status, Priority, Assignee, Deadline). Or
            upload a single CSV of tasks and set the project name below.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>File (.csv, .xlsx)</Label>
            <Input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)} />
          </div>
          <div className="grid gap-2">
            <Label>Project name override (optional if file has a Project sheet)</Label>
            <Input
              placeholder="e.g. Q2 Migration"
              value={overrideName}
              onChange={(e) => setOverrideName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select value={overrideStatus} onValueChange={(v) => setOverrideStatus(v as Project['status'])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on-hold">On hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Deadline override</Label>
              <Input type="date" value={overrideDeadline} onChange={(e) => setOverrideDeadline(e.target.value)} />
            </div>
          </div>
          {preview && (
            <div className="rounded-md border border-border p-3 text-sm space-y-2">
              <p className="font-medium">Preview</p>
              {preview.mergedMeta ? (
                <ul className="text-muted-foreground space-y-1 text-xs">
                  <li>
                    <span className="text-foreground font-medium">Name:</span> {preview.mergedMeta.name}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Status:</span> {preview.mergedMeta.status}
                  </li>
                  <li>
                    <span className="text-foreground font-medium">Deadline:</span> {preview.mergedMeta.deadline}
                  </li>
                  {preview.mergedMeta.ownerName ? (
                    <li>
                      <span className="text-foreground font-medium">Owner:</span> {preview.mergedMeta.ownerName}
                    </li>
                  ) : null}
                  <li>
                    <span className="text-foreground font-medium">Tasks:</span> {preview.taskRowCount} row
                    {preview.taskRowCount === 1 ? '' : 's'}
                  </li>
                </ul>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">Set a project name to continue.</p>
              )}
              {preview.taskPreview.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-foreground mb-1">First tasks</p>
                  <ul className="text-xs text-muted-foreground max-h-28 overflow-y-auto space-y-0.5">
                    {preview.taskPreview.map((t, i) => (
                      <li key={i}>
                        {t.title} · {t.status} · {t.deadline}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <SwitchImportDivert
            module="projects"
            entityType="project"
            sourceLabel="katana.pm.project_import"
            file={pickedFile}
            rows={preview?.taskPreview.map((t) => ({ ...t })) ?? null}
            context={{
              project_name: (preview?.mergedMeta?.name ?? overrideName.trim()) || null,
              status: overrideStatus,
              deadline: overrideDeadline.trim() || null,
            }}
            disabled={!pickedFile}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void runImport()} disabled={!parseResult?.ok || busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            <span className="ml-2">Import</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
