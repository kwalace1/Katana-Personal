import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { User, MapPin, Plus, Trash2, Upload, Target, Download, Network } from 'lucide-react'
import { KyiContactSegmentNav, type KyiContactSegment } from '@/components/kyi/KyiCompanyNav'
import {
  KYI_SIGNAL_LABELS,
  updateInvestorOutreachStatus,
  type KyiOutreachStatus,
  type KYIInvestor,
} from '@/lib/kyi-api'
import { exportTargetedInvestorsCsv } from '@/lib/kyi-export'
import { toast } from 'sonner'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
}

const OUTREACH_STATUSES: { value: KyiOutreachStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'passed', label: 'Passed' },
]

export interface KyiContactsTabContentProps {
  segment: KyiContactSegment
  onSegmentChange: (segment: KyiContactSegment) => void
  counts: { employees: number; current: number; targeted: number; network: number }
  companyId: number
  companyName: string
  employeeRoster: KYIInvestor[]
  filteredEmployees: KYIInvestor[]
  currentInvestorRoster: KYIInvestor[]
  personalNetworkRoster: KYIInvestor[]
  targetedInvestorRoster: KYIInvestor[]
  investorSegment: 'all' | 'current_investor' | 'prospect' | 'geo_target'
  onInvestorSegmentChange: (seg: 'all' | 'current_investor' | 'prospect' | 'geo_target') => void
  onImport: () => void
  onUploadNetwork: () => void
  onAddEmployee: () => void
  onAddCurrentInvestor: () => void
  onAddTargetedInvestor: () => void
  onDeleteInvestor: (id: number) => void
  onInvestorUpdated?: () => void
  onViewLead?: (leadId: number) => void
}

function InvestorRow({
  inv,
  index,
  onDelete,
  iconVariant = 'default',
}: {
  inv: KYIInvestor
  index: number
  onDelete: (id: number) => void
  iconVariant?: 'default' | 'targeted'
}) {
  return (
    <motion.div
      key={inv.id}
      custom={index + 1}
      variants={fadeUp}
      className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      <Link to={`/kyi/investors/${inv.id}`} className="flex items-center gap-4 flex-1 min-w-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            iconVariant === 'targeted' ? 'bg-amber-500/15' : 'bg-muted'
          }`}
        >
          {iconVariant === 'targeted' ? (
            <Target className="w-5 h-5 text-amber-600" />
          ) : (
            <User className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium">{inv.full_name}</p>
          {(inv.firm || inv.title) && (
            <p className="text-sm text-muted-foreground">
              {[inv.title, inv.firm].filter(Boolean).join(' · ')}
            </p>
          )}
          {inv.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {inv.location}
            </p>
          )}
          {inv.added_via_orbit && (
            <p className="text-xs text-muted-foreground mt-0.5">From Access Map</p>
          )}
        </div>
      </Link>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(inv.id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  )
}

function TargetedInvestorRow({
  inv,
  index,
  selected,
  onToggleSelect,
  onDelete,
  onStatusChange,
  onViewLead,
}: {
  inv: KYIInvestor
  index: number
  selected: boolean
  onToggleSelect: (id: number, checked: boolean) => void
  onDelete: (id: number) => void
  onStatusChange: (id: number, status: KyiOutreachStatus) => void
  onViewLead?: (leadId: number) => void
}) {
  const snap = inv.lead_snapshot
  const status = (inv.outreach_status ?? 'new') as KyiOutreachStatus

  return (
    <motion.div
      key={inv.id}
      custom={index + 1}
      variants={fadeUp}
      className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
    >
      <Checkbox
        checked={selected}
        onCheckedChange={(c) => onToggleSelect(inv.id, c === true)}
        className="mt-2"
      />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/kyi/investors/${inv.id}`} className="min-w-0">
            <p className="font-medium">{inv.full_name}</p>
            {(inv.firm || inv.title) && (
              <p className="text-sm text-muted-foreground">
                {[inv.title, inv.firm].filter(Boolean).join(' · ')}
              </p>
            )}
          </Link>
          {snap?.fit_percent != null && (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {snap.fit_percent}%
            </Badge>
          )}
        </div>
        {snap?.top_signals && snap.top_signals.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {snap.top_signals.slice(0, 2).map((key) => (
              <Badge key={key} variant="outline" className="text-xs">
                {KYI_SIGNAL_LABELS[key]?.label ?? key}
              </Badge>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={status} onValueChange={(v) => onStatusChange(inv.id, v as KyiOutreachStatus)}>
            <SelectTrigger className="h-8 w-[130px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inv.source_lead_id != null && onViewLead && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-8 px-0 text-xs"
              onClick={() => onViewLead(inv.source_lead_id!)}
            >
              View lead
            </Button>
          )}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(inv.id)}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </motion.div>
  )
}

export function KyiContactsTabContent({
  segment,
  onSegmentChange,
  counts,
  companyId,
  companyName,
  employeeRoster,
  filteredEmployees,
  currentInvestorRoster,
  personalNetworkRoster,
  targetedInvestorRoster,
  investorSegment,
  onInvestorSegmentChange,
  onImport,
  onUploadNetwork,
  onAddEmployee,
  onAddCurrentInvestor,
  onAddTargetedInvestor,
  onDeleteInvestor,
  onInvestorUpdated,
  onViewLead,
}: KyiContactsTabContentProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [bulkStatus, setBulkStatus] = useState<KyiOutreachStatus>('contacted')
  const [exporting, setExporting] = useState(false)

  const descriptions: Record<KyiContactSegment, string> = {
    employees: 'Employees linked from HR for warm intros during your raise.',
    network:
      'People you personally know. Powers warm paths for your org; optionally contributes identities to the shared ecosystem.',
    current: 'Investors already in your network for this company.',
    targeted: 'Prospects you are pursuing — track outreach status and export for your raise.',
  }

  const handleStatusChange = async (investorId: number, status: KyiOutreachStatus) => {
    try {
      await updateInvestorOutreachStatus(investorId, status)
      onInvestorUpdated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return
    try {
      await Promise.all(
        [...selectedIds].map((id) => updateInvestorOutreachStatus(id, bulkStatus)),
      )
      toast.success(`Updated ${selectedIds.size} investors`)
      setSelectedIds(new Set())
      onInvestorUpdated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Bulk update failed')
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      await exportTargetedInvestorsCsv(companyId, companyName)
      toast.success('CSV downloaded')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <motion.div initial="hidden" animate="visible" className="space-y-4">
      <motion.div custom={0} variants={fadeUp}>
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
            <div>
              <CardTitle className="text-lg">Contacts</CardTitle>
              <CardDescription>{descriptions[segment]}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {segment === 'targeted' && targetedInvestorRoster.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exporting}
                  onClick={handleExport}
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Export CSV
                </Button>
              )}
              {segment === 'network' && (
                <Button type="button" size="sm" className="flex items-center gap-2" onClick={onUploadNetwork}>
                  <Network className="w-4 h-4" />
                  Upload my network
                </Button>
              )}
              {segment !== 'targeted' && segment !== 'network' && (
                <Button type="button" variant="outline" size="sm" className="flex items-center gap-2" onClick={onImport}>
                  <Upload className="w-4 h-4" />
                  Import
                </Button>
              )}
              {segment === 'employees' && (
                <Button type="button" size="sm" className="flex items-center gap-2" onClick={onAddEmployee}>
                  <Plus className="w-4 h-4" />
                  Add employee
                </Button>
              )}
              {segment === 'current' && (
                <Button type="button" size="sm" className="flex items-center gap-2" onClick={onAddCurrentInvestor}>
                  <Plus className="w-4 h-4" />
                  Add investor
                </Button>
              )}
              {segment === 'targeted' && (
                <Button type="button" size="sm" className="flex items-center gap-2" onClick={onAddTargetedInvestor}>
                  <Plus className="w-4 h-4" />
                  Add targeted
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <KyiContactSegmentNav segment={segment} counts={counts} onSegmentChange={onSegmentChange} />

            {segment === 'targeted' && targetedInvestorRoster.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border bg-muted/30">
                <span className="text-xs text-muted-foreground">
                  {selectedIds.size} selected
                </span>
                <Select value={bulkStatus} onValueChange={(v) => setBulkStatus(v as KyiOutreachStatus)}>
                  <SelectTrigger className="h-8 w-[130px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {OUTREACH_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" size="sm" variant="secondary" disabled={selectedIds.size === 0} onClick={handleBulkApply}>
                  Apply to selected
                </Button>
              </div>
            )}

            {segment === 'employees' && (
              <>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ['all', 'All'],
                      ['current_investor', 'Current'],
                      ['prospect', 'Prospects'],
                      ['geo_target', 'Geo targets'],
                    ] as const
                  ).map(([key, label]) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={investorSegment === key ? 'default' : 'outline'}
                      onClick={() => onInvestorSegmentChange(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                {employeeRoster.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">No employees yet. Add from HR to map warm intro paths.</p>
                ) : filteredEmployees.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">No employees in this segment.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredEmployees.map((inv, i) => (
                      <InvestorRow key={inv.id} inv={inv} index={i} onDelete={onDeleteInvestor} />
                    ))}
                  </div>
                )}
              </>
            )}

            {segment === 'network' && (
              <>
                {personalNetworkRoster.length === 0 ? (
                  <div className="py-8 text-center space-y-3">
                    <p className="text-muted-foreground max-w-md mx-auto">
                      Upload a CSV of your personal connections. Partners in your org get warm-path
                      matches; with ecosystem contribute on, public identities appear in the shared
                      directory.
                    </p>
                    <Button type="button" onClick={onUploadNetwork}>
                      <Network className="w-4 h-4 mr-2" />
                      Upload my network
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {personalNetworkRoster.map((inv, i) => (
                      <InvestorRow key={inv.id} inv={inv} index={i} onDelete={onDeleteInvestor} />
                    ))}
                  </div>
                )}
              </>
            )}

            {segment === 'current' && (
              <>
                {currentInvestorRoster.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">
                    No current investors yet. Add manually or import a file with investor role.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {currentInvestorRoster.map((inv, i) => (
                      <InvestorRow key={inv.id} inv={inv} index={i} onDelete={onDeleteInvestor} />
                    ))}
                  </div>
                )}
              </>
            )}

            {segment === 'targeted' && (
              <>
                {targetedInvestorRoster.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">
                    No targeted investors yet. Add from Localized leads, Access Map, or here manually.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {targetedInvestorRoster.map((inv, i) => (
                      <TargetedInvestorRow
                        key={inv.id}
                        inv={inv}
                        index={i}
                        selected={selectedIds.has(inv.id)}
                        onToggleSelect={(id, checked) => {
                          setSelectedIds((prev) => {
                            const next = new Set(prev)
                            if (checked) next.add(id)
                            else next.delete(id)
                            return next
                          })
                        }}
                        onDelete={onDeleteInvestor}
                        onStatusChange={handleStatusChange}
                        onViewLead={onViewLead}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
