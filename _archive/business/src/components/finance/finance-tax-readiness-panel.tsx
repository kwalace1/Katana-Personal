import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Loader2, FileDown, FileText, AlertTriangle, Plus, Users } from 'lucide-react'
import {
  buildTaxPacketData,
  createVendor,
  downloadTaxPacketCsv,
  downloadTaxPacketPdf,
  formatCurrency,
  getEstimatedTaxReminders,
  getVendors,
  saveTaxPacketRecord,
  type EstimatedTaxReminder,
} from '@/lib/finance-tax-api'
import type { FinVendor, TaxPacketData } from '@/lib/finance-types'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { FinanceTabLayoutProps } from '@/lib/finance/finance-widget-layout'

interface FinanceTaxReadinessPanelProps {
  layout: FinanceTabLayoutProps
}

export function FinanceTaxReadinessPanel({ layout }: FinanceTaxReadinessPanelProps) {
  const currentYear = new Date().getFullYear()
  const [taxYear, setTaxYear] = useState(currentYear)
  const [packet, setPacket] = useState<TaxPacketData | null>(null)
  const [reminders, setReminders] = useState<EstimatedTaxReminder[]>([])
  const [vendors, setVendors] = useState<FinVendor[]>([])
  const [loading, setLoading] = useState(false)
  const [vendorName, setVendorName] = useState('')
  const [vendorTaxId, setVendorTaxId] = useState('')

  const loadVendors = useCallback(async () => {
    try {
      setVendors(await getVendors())
    } catch {
      setVendors([])
    }
  }, [])

  useEffect(() => {
    void loadVendors()
  }, [loadVendors])

  const buildPacket = async () => {
    setLoading(true)
    try {
      const [data, est] = await Promise.all([
        buildTaxPacketData(taxYear),
        getEstimatedTaxReminders(taxYear),
      ])
      setPacket(data)
      setReminders(est)
      await saveTaxPacketRecord(data)
      toast.success('Tax packet generated')
    } catch (err) {
      toast.error('Failed to build tax packet', {
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddVendor = async () => {
    if (!vendorName.trim()) return
    try {
      await createVendor({ name: vendorName.trim(), tax_id: vendorTaxId.trim() || undefined })
      setVendorName('')
      setVendorTaxId('')
      await loadVendors()
      toast.success('Vendor added')
    } catch (err) {
      toast.error('Could not add vendor', {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }

  return (
    <div data-tour="finance-tax">
      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={layout.catalog}
        customizeMode={layout.customizeMode}
        onLayoutChange={layout.onLayoutChange}
        onRemoveWidget={layout.onRemoveWidget}
        rowHeight={36}
        renderWidget={(widgetId) => {
          if (widgetId === 'tax_header') {
            return (
              <div className="h-full overflow-auto">
                <h2 className="text-lg font-medium">Tax readiness</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Year-end packet for your CPA, 1099 vendor tracking, and illustrative estimated tax
                  reminders.
                </p>
              </div>
            )
          }

          if (widgetId === 'tax_disclaimer') {
            return (
              <Card className="h-full border-amber-500/30 bg-amber-500/5">
                <CardContent className="pt-4 flex gap-3 text-xs text-muted-foreground">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <p>
                    Katana prepares organizational data for tax season. This is not tax advice and
                    does not file returns. Always have a qualified professional review before filing.
                  </p>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'tax_packet_actions') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Generate tax packet</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tax-year">Tax year</Label>
                    <Input
                      id="tax-year"
                      type="number"
                      value={taxYear}
                      onChange={(e) => setTaxYear(parseInt(e.target.value, 10) || currentYear)}
                    />
                  </div>
                  <Button onClick={buildPacket} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Build packet
                  </Button>
                  {packet && (
                    <>
                      <Button variant="outline" onClick={() => downloadTaxPacketCsv(packet)}>
                        <FileDown className="w-4 h-4 mr-2" />
                        Export CSV
                      </Button>
                      <Button variant="outline" onClick={() => void downloadTaxPacketPdf(packet)}>
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'tax_packet_summary') {
            if (!packet) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Build a tax packet to see the summary.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Packet summary — {packet.tax_year}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Entity</span>
                    <p className="font-medium">{packet.entity_label}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Net income</span>
                    <p className="font-medium">
                      {formatCurrency(packet.profit_and_loss.net_income)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Transactions</span>
                    <p className="font-medium">{packet.transaction_count}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">1099 vendors flagged</span>
                    <p className="font-medium">{packet.vendors_1099.length}</p>
                  </div>
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'vendors_1099') {
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    1099 vendors
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="Vendor name"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="max-w-xs"
                    />
                    <Input
                      placeholder="Tax ID (optional)"
                      value={vendorTaxId}
                      onChange={(e) => setVendorTaxId(e.target.value)}
                      className="max-w-xs"
                    />
                    <Button size="sm" onClick={handleAddVendor}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  {vendors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Add contractors you pay — assign vendor on transactions to track YTD payments.
                    </p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {vendors.map((v) => (
                        <li
                          key={v.id}
                          className="flex items-center justify-between border rounded-lg p-3"
                        >
                          <span>{v.name}</span>
                          {v.is_1099_eligible && <Badge variant="outline">1099 eligible</Badge>}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'estimated_tax') {
            if (reminders.length === 0) {
              return (
                <Card className="h-full">
                  <CardContent className="pt-6 text-sm text-muted-foreground">
                    Build a tax packet to see estimated tax reminders.
                  </CardContent>
                </Card>
              )
            }
            return (
              <Card className="h-full overflow-auto">
                <CardHeader>
                  <CardTitle className="text-base">Estimated tax reminders (illustrative)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {reminders.map((r) => (
                    <div
                      key={r.quarter}
                      className="flex justify-between gap-4 border-b pb-2 last:border-0"
                    >
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">Due {r.due_date}</p>
                      </div>
                      <p className="font-medium">{formatCurrency(r.suggested_payment)}</p>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">{reminders[0]?.disclaimer}</p>
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </div>
  )
}
