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
import { Label } from '@/components/ui/label'
import { Loader2, Upload } from 'lucide-react'
import { parseTabularFile, type ParseFileResult, type ParsedSheet } from '@/lib/file-parse-utils'
import {
  detectPmTaskMapping,
  buildPmImportPreview,
  executePmTaskImport,
  type PmTaskColumnMapping,
} from '@/lib/pm-file-import'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { toast } from 'sonner'

interface ImportDataDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onImported?: () => void
}

export function ImportDataDialog({ open, onOpenChange, projectId, onImported }: ImportDataDialogProps) {
  const [parseResult, setParseResult] = useState<ParseFileResult | null>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [sheetIndex, setSheetIndex] = useState(0)
  const [busy, setBusy] = useState(false)

  const activeSheet: ParsedSheet | null =
    parseResult?.ok && parseResult.sheets[sheetIndex] ? parseResult.sheets[sheetIndex] : null

  const mapping: PmTaskColumnMapping | null = useMemo(() => {
    if (!activeSheet?.headers?.length) return null
    return detectPmTaskMapping(activeSheet.headers)
  }, [activeSheet])

  const preview = useMemo(() => {
    if (!activeSheet || !mapping) return []
    return buildPmImportPreview(activeSheet, mapping, 15)
  }, [activeSheet, mapping])

  useEffect(() => {
    if (!open) {
      setParseResult(null)
      setPickedFile(null)
      setSheetIndex(0)
    }
  }, [open])

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
    setSheetIndex(0)
  }

  const runImport = async () => {
    if (!parseResult?.ok || !activeSheet || !mapping) return
    if (mapping.title < 0) {
      toast.error('Could not detect a title column.')
      return
    }
    setBusy(true)
    try {
      const res = await executePmTaskImport(projectId, activeSheet, mapping)
      if (res.created === 0 && res.errors.length) {
        toast.error(res.errors[0] ?? 'Import failed')
        return
      }
      if (res.errors.length) {
        toast.message(`Imported ${res.created} tasks`, {
          description: res.errors.slice(0, 2).join(' · '),
        })
      } else {
        toast.success(`Imported ${res.created} task${res.created === 1 ? '' : 's'}`)
      }
      onImported?.()
      onOpenChange(false)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import tasks</DialogTitle>
          <DialogDescription>
            CSV or Excel with columns for title (required), and optionally status, priority, assignee, deadline, and
            description.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>File</Label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              className="text-sm"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          {parseResult?.ok && parseResult.sheets.length > 1 && (
            <div className="grid gap-2">
              <Label>Sheet</Label>
              <select
                className="border border-border rounded-md bg-background px-2 py-1 text-sm"
                value={sheetIndex}
                onChange={(e) => setSheetIndex(Number(e.target.value))}
              >
                {parseResult.sheets.map((s, i) => (
                  <option key={i} value={i}>
                    {s.sheetName ?? `Sheet ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
          {preview.length > 0 && (
            <div className="rounded-md border border-border p-3 text-xs space-y-2">
              <p className="font-medium text-foreground">Preview</p>
              <ul className="space-y-1 max-h-48 overflow-y-auto text-muted-foreground">
                {preview.map((p, i) => (
                  <li key={i}>
                    <span className="text-foreground font-medium">{p.title}</span>
                    {' · '}
                    {p.status} · {p.priority}
                    {p.assignee ? ` · ${p.assignee}` : ''} · {p.deadline}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SwitchImportDivert
            module="projects"
            entityType="task"
            sourceLabel="katana.pm.task_import"
            file={pickedFile}
            rows={preview.map((p) => ({ ...p }))}
            context={{ project_id: projectId }}
            disabled={!pickedFile}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void runImport()} disabled={!parseResult?.ok || busy}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="ml-2">Import</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
