import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, FileText } from 'lucide-react'
import { parseStatementFile } from '@/lib/finance-statement-parser'
import { importStatementTransactions, uploadStatementFile } from '@/lib/finance-api'
import type { FinFinancialAccount } from '@/lib/finance-types'
import type { ParsedStatementRow } from '@/lib/finance-statement-parser'
import { SwitchImportDivert } from '@/components/switch/switch-import-divert'

interface FinanceStatementImportProps {
  financialAccounts: FinFinancialAccount[]
  onImported: () => void
}

export function FinanceStatementImport({ financialAccounts, onImported }: FinanceStatementImportProps) {
  const [financialAccountId, setFinancialAccountId] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<ParsedStatementRow[]>([])
  const [warnings, setWarnings] = useState<string[]>([])

  const handleFileChange = async (f: File | null) => {
    setFile(f)
    setPreview([])
    setWarnings([])
    if (!f) return
    setParsing(true)
    try {
      const result = await parseStatementFile(f)
      setPreview(result.rows.slice(0, 50))
      setWarnings(result.warnings)
      if (result.rows.length > 0 && !periodEnd) {
        const dates = result.rows.map((r) => r.transaction_date).sort()
        setPeriodStart(dates[0])
        setPeriodEnd(dates[dates.length - 1])
      }
    } catch (err) {
      toast.error('Parse failed', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!file || !financialAccountId || !periodStart || !periodEnd) {
      toast.error('Select account, period dates, and a file')
      return
    }
    if (preview.length === 0) {
      toast.error('No transactions to import')
      return
    }

    setImporting(true)
    try {
      const parseResult = await parseStatementFile(file)
      const statement = await uploadStatementFile(
        file,
        financialAccountId,
        periodStart,
        periodEnd,
        closingBalance ? parseFloat(closingBalance) : undefined,
      )
      const { imported, skipped } = await importStatementTransactions(
        financialAccountId,
        parseResult.rows,
        statement.id,
      )
      toast.success(`Imported ${imported} transaction${imported === 1 ? '' : 's'}`, {
        description: skipped > 0 ? `${skipped} duplicate${skipped === 1 ? '' : 's'} skipped` : undefined,
      })
      setFile(null)
      setPreview([])
      setWarnings([])
      onImported()
    } catch (err) {
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setImporting(false)
    }
  }

  if (financialAccounts.length === 0) return null

  return (
    <Card data-tour="finance-import">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Import bank statement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload a CSV or PDF bank statement. CSV exports from your bank work best; PDF parsing is
          best-effort.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Bank account</Label>
            <Select value={financialAccountId} onValueChange={setFinancialAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {financialAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="stmt-file">Statement file</Label>
            <Input
              id="stmt-file"
              type="file"
              accept=".csv,.pdf,text/csv,application/pdf"
              onChange={(e) => void handleFileChange(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-start">Period start</Label>
            <Input
              id="period-start"
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="period-end">Period end</Label>
            <Input
              id="period-end"
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="closing-bal">Statement ending balance (optional)</Label>
            <Input
              id="closing-bal"
              type="number"
              step="0.01"
              placeholder="For reconciliation"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
            />
          </div>
        </div>

        {parsing && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Parsing statement…
          </div>
        )}

        {warnings.map((w) => (
          <p key={w} className="text-xs text-amber-600 dark:text-amber-400">
            {w}
          </p>
        ))}

        {preview.length > 0 && (
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-3 py-2 text-xs font-medium flex items-center gap-2">
              <FileText className="w-3 h-3" />
              Preview ({preview.length} row{preview.length === 1 ? '' : 's'}
              {preview.length >= 50 ? ', showing first 50' : ''})
            </div>
            <div className="max-h-48 overflow-y-auto text-xs">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Date</th>
                    <th className="text-left p-2">Description</th>
                    <th className="text-right p-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="p-2 whitespace-nowrap">{row.transaction_date}</td>
                      <td className="p-2 truncate max-w-[200px]">{row.description}</td>
                      <td className="p-2 text-right">{row.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <SwitchImportDivert
          module="finance"
          entityType="fin_bank_transaction"
          sourceLabel="katana.finance.statement_import"
          file={file}
          rows={preview.map((r) => ({ ...r }))}
          context={{
            financial_account_id: financialAccountId || null,
            period_start: periodStart || null,
            period_end: periodEnd || null,
            closing_balance: closingBalance ? Number(closingBalance) : null,
          }}
          disabled={!file || !financialAccountId || !periodStart || !periodEnd}
        />

        <Button onClick={handleImport} disabled={importing || preview.length === 0}>
          {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Import transactions
        </Button>
      </CardContent>
    </Card>
  )
}
