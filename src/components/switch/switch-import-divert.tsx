/**
 * Shared “Send to Switch” divert control for module Import dialogs.
 * Shown when org/env flag is on; native Import remains available.
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ExternalLink, Loader2, Upload } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import {
  divertImportToSwitch,
  isSwitchImportDivertEnabled,
  textToHandoffFile,
  type KyiHandoffTarget,
  type SwitchHandoffEntityType,
  type SwitchHandoffModule,
  type SwitchHandoffResponse,
} from '@/lib/switch-handoff'
import { toast } from 'sonner'

export interface SwitchImportDivertProps {
  module: SwitchHandoffModule
  entityType: SwitchHandoffEntityType
  sourceLabel: string
  /** Preferred: original File from the picker */
  file?: File | null
  /** When UI only has pasted CSV text */
  fileText?: string | null
  fileName?: string
  rows?: Record<string, unknown>[] | null
  context?: Record<string, unknown>
  upsertKey?: string | null
  target?: KyiHandoffTarget | null
  /** Disable until native form has enough input */
  disabled?: boolean
  className?: string
}

export function SwitchImportDivert({
  module,
  entityType,
  sourceLabel,
  file,
  fileText,
  fileName = 'import.csv',
  rows,
  context,
  upsertKey,
  target,
  disabled,
  className,
}: SwitchImportDivertProps) {
  const { organization } = useAuth()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SwitchHandoffResponse | null>(null)

  if (!isSwitchImportDivertEnabled(organization)) return null

  const canSend = !disabled && Boolean(file || (fileText && fileText.trim()) || (rows && rows.length > 0))

  const onSend = async () => {
    setBusy(true)
    setResult(null)
    try {
      const resolvedFile =
        file ?? (fileText?.trim() ? textToHandoffFile(fileText, fileName) : null)
      const res = await divertImportToSwitch({
        module,
        entity_type: entityType,
        source_label: sourceLabel,
        file: resolvedFile,
        rows: rows?.length ? rows : null,
        context,
        upsert_key: upsertKey ?? null,
        target: target ?? null,
        parsed: Boolean(rows?.length),
      })
      setResult(res)
      toast.success('Import created in Switch', {
        description: 'Open Switch to continue detect → map → preview.',
      })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Switch handoff failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={className ?? 'space-y-2 rounded-md border border-dashed p-3'}>
      <p className="text-xs text-muted-foreground">
        Optional: send this file to Switch for mapping and preview. Native Import still works below.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canSend || busy}
          onClick={() => void onSend()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          <span className="ml-2">Send to Switch</span>
        </Button>
        {result?.import_url ? (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={result.import_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              <span className="ml-2">Open in Switch</span>
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
