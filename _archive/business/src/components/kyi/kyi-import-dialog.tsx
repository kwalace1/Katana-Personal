'use client'

import { useState, useRef, useMemo, useEffect } from 'react'
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
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Network } from 'lucide-react'
import { validateFile } from '@/lib/validation'
import { parseTabularFile, type ParsedSheet } from '@/lib/file-parse-utils'
import {
  detectKyiMapping,
  previewKyiImport,
  executeKyiImport,
  type KyiImportTarget,
  type KyiColumnMapping,
} from '@/lib/kyi-file-import'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'
import { toast } from 'sonner'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface KyiImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: number
  onImported?: () => void
  defaultTarget?: KyiImportTarget
}

export function KyiImportDialog({
  open,
  onOpenChange,
  companyId,
  onImported,
  defaultTarget = 'investors',
}: KyiImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [sheet, setSheet] = useState<ParsedSheet | null>(null)
  const [mapping, setMapping] = useState<KyiColumnMapping | null>(null)
  const [target, setTarget] = useState<KyiImportTarget>(defaultTarget)
  const [categorySlug, setCategorySlug] = useState('')
  const [contributeToEcosystem, setContributeToEcosystem] = useState(true)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (open) {
      setTarget(defaultTarget)
      setContributeToEcosystem(true)
    }
  }, [open, defaultTarget])

  const preview = useMemo(() => {
    if (!sheet || !mapping) return null
    return previewKyiImport(sheet, mapping, 8)
  }, [sheet, mapping])

  const reset = () => {
    setFile(null)
    setParseError(null)
    setSheet(null)
    setMapping(null)
    setTarget(defaultTarget)
    setCategorySlug('')
    setContributeToEcosystem(true)
    setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const processFile = async (f: File) => {
    setParseError(null)
    const v = validateFile(f)
    if (!v.valid) {
      setParseError(v.error ?? 'Invalid file')
      return
    }
    const ext = f.name.toLowerCase()
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setParseError('Use a .csv, .xlsx, or .xls file.')
      return
    }
    setFile(f)
    const parsed = await parseTabularFile(f)
    if (!parsed.ok) {
      setParseError(parsed.error)
      setSheet(null)
      setMapping(null)
      return
    }
    const first = parsed.sheets[0]
    if (!first.headers.length) {
      setParseError('No header row found.')
      setSheet(null)
      setMapping(null)
      return
    }
    setSheet(first)
    setMapping(detectKyiMapping(first.headers))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void processFile(f)
  }

  const handleImport = async () => {
    if (!sheet) return
    if (target !== 'northstar' && !mapping) return
    setImporting(true)
    try {
      const res = await executeKyiImport({
        companyId,
        target,
        sheet,
        mapping: mapping ?? detectKyiMapping(sheet.headers),
        dataCategorySlug: target === 'leads' ? categorySlug.trim() || null : null,
        contributeToEcosystem: target === 'personal_network' ? contributeToEcosystem : undefined,
      })
      if (res.inserted > 0) {
        const ecoNote =
          target === 'personal_network' && contributeToEcosystem && res.contributed > 0
            ? ` · ${res.contributed} added to shared ecosystem`
            : ''
        toast.success(
          `Imported ${res.inserted} connection${res.inserted === 1 ? '' : 's'}${ecoNote}`,
        )
      }
      if (res.failed > 0) {
        toast.warning(`${res.failed} row${res.failed === 1 ? '' : 's'} skipped or failed`)
      }
      if (res.errors.length) {
        toast.message('Import details', { description: res.errors.slice(0, 5).join('\n') })
      }
      onImported?.()
      handleOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const isPersonal = target === 'personal_network'

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="md" className="flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPersonal ? (
              <>
                <Network className="w-5 h-5 text-primary" />
                Upload my network
              </>
            ) : (
              'Import data'
            )}
          </DialogTitle>
          <DialogDescription>
            {isPersonal ? (
              <>
                Upload a CSV or Excel of people you know (LinkedIn export, CRM contacts, etc.).
                Contacts stay private to your organization for warm paths. Optionally contribute
                public identity (name, firm, title) to the shared investor ecosystem so partners can
                discover them — your notes and “I know them” edge stay private.
              </>
            ) : (
              <>
                Upload a CSV or Excel file. Leads are imported into your organization's KYI lead set
                (platform-curated catalog may still appear as read-only). Investors are added to this
                company. Northstar imports include categories, pipeline stage, tiers, and scorecards.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-hidden flex-1 min-h-0 flex flex-col">
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
            }`}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void processFile(f)
              }}
            />
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">
              {file ? file.name : 'Drag a file here or choose one'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4 mr-2" />
              Choose file
            </Button>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{parseError}</span>
            </div>
          )}

          {sheet && mapping && (
            <>
              <div className="space-y-2">
                <Label>Import as</Label>
                <RadioGroup
                  value={target}
                  onValueChange={(v) => setTarget(v as KyiImportTarget)}
                  className="flex flex-col gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="personal_network" id="kyi-imp-network" />
                    <Label htmlFor="kyi-imp-network" className="font-normal cursor-pointer">
                      My personal network (warm paths + optional ecosystem contribute)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="leads" id="kyi-imp-leads" />
                    <Label htmlFor="kyi-imp-leads" className="font-normal cursor-pointer">
                      Leads (your organization's lead set)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="investors" id="kyi-imp-inv" />
                    <Label htmlFor="kyi-imp-inv" className="font-normal cursor-pointer">
                      Investors (this company)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="northstar" id="kyi-imp-ns" />
                    <Label htmlFor="kyi-imp-ns" className="font-normal cursor-pointer">
                      Northstar pipeline (categories, scorecard, tiers)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {isPersonal && (
                <div className="flex items-start justify-between gap-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="space-y-1 min-w-0">
                    <Label htmlFor="kyi-contribute-eco" className="text-sm font-medium cursor-pointer">
                      Contribute to shared investor ecosystem
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Publishes name, firm, title, and profile URL so partners and other Katana orgs
                      can discover these people. Requires firm, email, or LinkedIn/profile URL on the
                      row. Your private notes stay with your org.
                    </p>
                  </div>
                  <Switch
                    id="kyi-contribute-eco"
                    checked={contributeToEcosystem}
                    onCheckedChange={setContributeToEcosystem}
                    className="shrink-0 mt-0.5"
                  />
                </div>
              )}

              {target === 'leads' && (
                <div className="space-y-2">
                  <Label htmlFor="kyi-cat-slug">Optional tag / category (stored on lead tags)</Label>
                  <Input
                    id="kyi-cat-slug"
                    placeholder="e.g. swing_data"
                    value={categorySlug}
                    onChange={(e) => setCategorySlug(e.target.value)}
                  />
                </div>
              )}

              {preview && (
                <div className="space-y-2 min-h-0 flex-1 flex flex-col">
                  <p className="text-sm text-muted-foreground">
                    {preview.validRows} valid row{preview.validRows === 1 ? '' : 's'}
                    {preview.issues.length > 0
                      ? ` · ${preview.issues.length} row${preview.issues.length === 1 ? '' : 's'} with issues`
                      : ''}
                  </p>
                  {preview.issues.length > 0 && (
                    <ScrollArea className="h-24 rounded-md border p-2 text-xs">
                      {preview.issues.slice(0, 30).map((iss) => (
                        <div key={iss.rowIndex}>
                          Row {iss.rowIndex}: {iss.message}
                        </div>
                      ))}
                    </ScrollArea>
                  )}
                  <Label className="text-xs text-muted-foreground">Preview (first rows)</Label>
                  <ScrollArea className="h-40 rounded-md border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          {sheet.headers.slice(0, 8).map((h) => (
                            <th key={h} className="text-left p-2 font-medium truncate max-w-[120px]">
                              {h || '—'}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.rows.slice(0, 6).map((row, ri) => (
                          <tr key={ri} className="border-b border-border/60">
                            {row.slice(0, 8).map((c, ci) => (
                              <td key={ci} className="p-2 truncate max-w-[120px]">
                                {c}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </ScrollArea>
                </div>
              )}
            </>
          )}
          <SwitchImportDivert
            module="kyi"
            entityType={
              target === 'leads'
                ? 'kyi_investor_lead'
                : target === 'northstar'
                  ? 'kyi_northstar_investor'
                  : 'kyi_investor'
            }
            sourceLabel="katana.kyi.file_import"
            file={file}
            target={target === 'personal_network' ? 'investors' : target}
            context={{ company_id: companyId }}
            disabled={!file}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={
              !sheet ||
              (!mapping && target !== 'northstar') ||
              (target !== 'northstar' && (!preview || preview.validRows === 0)) ||
              (target === 'northstar' && sheet.rows.length === 0) ||
              importing
            }
          >
            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isPersonal ? 'Upload network' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
