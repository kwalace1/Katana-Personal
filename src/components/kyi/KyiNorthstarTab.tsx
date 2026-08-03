import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { EmptyState } from '@/components/ui/empty-state'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BookOpen,
  ChevronDown,
  Compass,
  Download,
  Link2,
  Loader2,
  Plus,
  Search,
  Star,
  Target,
  Upload,
  Users,
  Settings,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getNorthstarFramework,
  getNorthstarInvestors,
  getNorthstarPipelineSummary,
  downloadNorthstarCsvTemplate,
  pipelineStageLabel,
  stageBadgeClass,
  tierBadgeClass,
  scorecardPercent,
  type KyiNorthstarFramework,
  type KyiNorthstarInvestor,
  type KyiNorthstarPipelineSummary,
} from '@/lib/kyi-northstar'
import { getInvestorTypeProfiles, type KYICompanyDetail, type KYIInvestorTypeProfile } from '@/lib/kyi-api'
import { KyiNorthstarSettingsSheet } from '@/components/kyi/KyiNorthstarSettingsSheet'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { KyiTabLayoutProps } from '@/lib/kyi/kyi-widget-layout'

export interface KyiNorthstarTabProps {
  companyId: number
  companyName: string
  company: KYICompanyDetail
  onImport: () => void
  onAddInvestor: () => void
  /** Bump when investors list changes (import, add, delete) to refresh pipeline. */
  refreshKey?: number
  layout?: KyiTabLayoutProps
}

function StatCard({
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  value: React.ReactNode
  label: string
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tabular-nums leading-none">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function KyiNorthstarTab({ companyId, companyName, company, onImport, onAddInvestor, refreshKey = 0, layout }: KyiNorthstarTabProps) {
  const [loading, setLoading] = useState(true)
  const [framework, setFramework] = useState<KyiNorthstarFramework | null>(null)
  const [investors, setInvestors] = useState<KyiNorthstarInvestor[]>([])
  const [summary, setSummary] = useState<KyiNorthstarPipelineSummary | null>(null)
  const [typeProfiles, setTypeProfiles] = useState<KYIInvestorTypeProfile[]>([])
  const [stageFilter, setStageFilter] = useState<string>('all')
  const [tierFilter, setTierFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [frameworkOpen, setFrameworkOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [fw, invs, sum, profiles] = await Promise.all([
        getNorthstarFramework(companyId),
        getNorthstarInvestors(companyId),
        getNorthstarPipelineSummary(companyId),
        getInvestorTypeProfiles(companyId).catch(() => []),
      ])
      setFramework(fw)
      setInvestors(invs)
      setSummary(sum)
      setTypeProfiles(profiles)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load Northstar data')
    } finally {
      setLoading(false)
    }
  }, [companyId, refreshKey])

  useEffect(() => {
    void load()
  }, [load])

  const categories = useMemo(() => {
    const set = new Set<string>()
    for (const inv of investors) {
      if (inv.investor_type) set.add(inv.investor_type)
    }
    return [...set].sort()
  }, [investors])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return investors.filter((inv) => {
      if (stageFilter !== 'all' && (inv.northstar_pipeline_stage ?? 'research') !== stageFilter) return false
      if (tierFilter !== 'all' && String(inv.northstar_tier ?? '') !== tierFilter) return false
      if (categoryFilter !== 'all' && (inv.investor_type ?? '') !== categoryFilter) return false
      if (!q) return true
      return (
        inv.full_name.toLowerCase().includes(q) ||
        (inv.firm ?? '').toLowerCase().includes(q) ||
        (inv.investor_type ?? '').toLowerCase().includes(q) ||
        (inv.northstar_next_step ?? '').toLowerCase().includes(q)
      )
    })
  }, [investors, stageFilter, tierFilter, categoryFilter, search])

  const hasActiveFilters =
    stageFilter !== 'all' || tierFilter !== 'all' || categoryFilter !== 'all' || search.trim().length > 0

  const clearFilters = () => {
    setStageFilter('all')
    setTierFilter('all')
    setCategoryFilter('all')
    setSearch('')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const headerSection = (
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between h-full overflow-hidden">
      <div className="space-y-1 max-w-2xl">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Compass className="w-5 h-5 text-primary" />
          Investor Northstar
        </h2>
        <p className="text-sm text-muted-foreground">
          Track {companyName}&apos;s investor pipeline — prioritize strategic partners, not just capital.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setSettingsOpen(true)}>
          <Settings className="w-4 h-4 mr-2" />
          Framework
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={downloadNorthstarCsvTemplate}>
          <Download className="w-4 h-4 mr-2" />
          CSV template
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onImport}>
          <Upload className="w-4 h-4 mr-2" />
          Import CSV
        </Button>
        <Button type="button" size="sm" onClick={onAddInvestor}>
          <Plus className="w-4 h-4 mr-2" />
          Add investor
        </Button>
      </div>
    </div>
  )

  const kpisSection = summary ? (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 h-full overflow-hidden content-start">
      <StatCard
        icon={Users}
        iconClass="bg-blue-500/10 text-blue-600 dark:text-blue-400"
        value={summary.total}
        label="Tracked investors"
      />
      <StatCard
        icon={Target}
        iconClass="bg-amber-500/10 text-amber-600 dark:text-amber-400"
        value={summary.by_tier['1'] ?? 0}
        label="Tier 1 — pursue now"
      />
      <StatCard
        icon={Star}
        iconClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        value={summary.avg_score != null && framework ? `${summary.avg_score}/${framework.scorecard_max}` : summary.avg_score != null ? `${summary.avg_score}` : '—'}
        label="Avg scorecard"
      />
      <StatCard
        icon={Link2}
        iconClass="bg-violet-500/10 text-violet-600 dark:text-violet-400"
        value={
          investors.filter((i) => i.northstar_warm_intro === true).length
        }
        label="Warm intros available"
      />
    </div>
  ) : (
    <div className="flex h-full items-center justify-center rounded-xl border bg-card/50 p-4">
      <p className="text-sm text-muted-foreground">No pipeline summary yet</p>
    </div>
  )

  const pipelineSection = (
    <Card className="h-full overflow-hidden">
      <CardHeader className="space-y-4 pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Outreach pipeline</CardTitle>
            <CardDescription>
              {filtered.length === investors.length
                ? `${investors.length} investor${investors.length === 1 ? '' : 's'}`
                : `${filtered.length} of ${investors.length} shown`}
            </CardDescription>
          </div>
          {hasActiveFilters && (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
              <X className="w-3.5 h-3.5 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {summary && investors.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setStageFilter('all')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                stageFilter === 'all'
                  ? 'border-primary bg-primary/10 text-foreground font-medium'
                  : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
              )}
            >
              All
              <span className="tabular-nums opacity-70">{summary.total}</span>
            </button>
            {framework?.pipeline_stages.map((s) => {
              const count = summary.by_stage[s.value] ?? 0
              if (count === 0 && stageFilter !== s.value) return null
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStageFilter(stageFilter === s.value ? 'all' : s.value)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
                    stageFilter === s.value
                      ? cn('font-medium', stageBadgeClass(s.value))
                      : 'border-border bg-background text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {s.label}
                  <span className="tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name, firm, category, next step…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={tierFilter} onValueChange={setTierFilter}>
            <SelectTrigger className="h-9 w-full sm:w-[130px] text-sm">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              {framework?.tiers.map((t) => (
                <SelectItem key={t.value} value={String(t.value)}>
                  Tier {t.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {categories.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9 w-full sm:w-[180px] text-sm">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState
            compact
            title={investors.length === 0 ? 'No investors yet' : 'No matches'}
            description={
              investors.length === 0
                ? 'Import a Northstar CSV or add investors to start tracking outreach.'
                : 'Try adjusting your filters or search.'
            }
            icon={Compass}
            action={
              investors.length === 0 ? (
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button type="button" variant="outline" size="sm" onClick={onImport}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button type="button" size="sm" onClick={onAddInvestor}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add investor
                  </Button>
                </div>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[160px]">Investor</TableHead>
                  <TableHead className="min-w-[120px]">Category</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="min-w-[140px]">Next step</TableHead>
                  <TableHead>Intro</TableHead>
                  <TableHead className="text-right whitespace-nowrap">Prob.</TableHead>
                  <TableHead className="min-w-[100px]">Score</TableHead>
                  <TableHead className="whitespace-nowrap">Contact</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const stage = inv.northstar_pipeline_stage ?? 'research'
                  return (
                    <TableRow key={inv.id} className="group">
                      <TableCell>
                        <Link
                          to={`/kyi/investors/${inv.id}?tab=northstar`}
                          className="font-medium hover:underline text-foreground"
                        >
                          {inv.full_name}
                        </Link>
                        {inv.firm && (
                          <p className="text-xs text-muted-foreground truncate max-w-[180px]">{inv.firm}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground line-clamp-2 max-w-[140px]">
                          {inv.investor_type ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('text-[10px] font-normal whitespace-nowrap', stageBadgeClass(stage))}
                        >
                          {pipelineStageLabel(stage, framework?.pipeline_stages)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {inv.northstar_tier != null ? (
                          <Badge
                            variant="outline"
                            className={cn('text-[10px] font-medium', tierBadgeClass(inv.northstar_tier))}
                          >
                            T{inv.northstar_tier}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs line-clamp-2 max-w-[160px]">
                          {inv.northstar_next_step ?? '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {inv.northstar_warm_intro == null ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : inv.northstar_warm_intro ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                            Yes
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">No</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {inv.northstar_probability != null ? `${inv.northstar_probability}%` : '—'}
                      </TableCell>
                      <TableCell>
                        {inv.score_total > 0 ? (
                          <div className="flex items-center gap-2 min-w-[80px]">
                            <Progress value={scorecardPercent(inv.score_total, framework?.scorecard_max ?? 50)} className="h-1.5 flex-1" />
                            <span className="text-xs tabular-nums text-muted-foreground w-8 text-right">
                              {inv.score_total}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                        {inv.northstar_last_contact_at
                          ? new Date(inv.northstar_last_contact_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          {framework?.tiers.map((t) => t.label).join(' · ')}
        </p>
      </CardContent>
    </Card>
  )

  const frameworkSection = framework ? (
    <Collapsible open={frameworkOpen} onOpenChange={setFrameworkOpen} className="h-full overflow-hidden">
      <Card className="h-full overflow-hidden">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-muted/30 transition-colors rounded-t-lg"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Strategy & investor categories</p>
                <p className="text-xs text-muted-foreground">
                  Evaluation priorities, ideal profile, and the 9 Northstar categories
                </p>
              </div>
            </div>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200',
                frameworkOpen && 'rotate-180',
              )}
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4 border-t">
            <div className="grid gap-4 lg:grid-cols-2 pt-4">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Investor strategy</h3>
                  <p className="text-xs text-muted-foreground">
                    Evaluation priorities — money alone is not the deciding factor.
                  </p>
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-sm">
                  {framework.strategy_priorities.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ol>
                {framework.strategy_notes && (
                  <p className="text-xs text-muted-foreground border-t pt-3 italic">{framework.strategy_notes}</p>
                )}
              </div>
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold">Ideal investor profile</h3>
                  <p className="text-xs text-muted-foreground">What the ideal partner should bring beyond capital.</p>
                </div>
                <ul className="space-y-1.5 text-sm">
                  {framework.ideal_profile_traits.map((t, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {typeProfiles.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold">Target categories ({typeProfiles.length})</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {typeProfiles.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-lg border p-3 text-sm hover:bg-muted/30 transition-colors"
                    >
                      <p className="font-medium leading-snug">{p.type}</p>
                      {p.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{p.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  ) : (
    <div className="flex h-full items-center justify-center rounded-xl border bg-card/50 p-4">
      <p className="text-sm text-muted-foreground">No framework configured yet</p>
    </div>
  )

  const settingsSheet = (
    <KyiNorthstarSettingsSheet
      open={settingsOpen}
      onOpenChange={setSettingsOpen}
      company={company}
      onSaved={() => void load()}
    />
  )

  if (layout) {
    return (
      <div data-tour="kyi-northstar">
        <ModuleWidgetCanvas
          widgets={layout.widgets}
          catalog={layout.catalog}
          customizeMode={layout.customizeMode}
          onLayoutChange={layout.onLayoutChange}
          onRemoveWidget={layout.onRemoveWidget}
          rowHeight={36}
          renderWidget={(widgetId) => {
            if (widgetId === 'northstar_header') return headerSection
            if (widgetId === 'northstar_kpis') return kpisSection
            if (widgetId === 'northstar_pipeline') return pipelineSection
            if (widgetId === 'northstar_framework') return frameworkSection
            return (
              <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                Unknown widget
              </div>
            )
          }}
        />
        {settingsSheet}
      </div>
    )
  }

  return (
    <div className="space-y-6" data-tour="kyi-northstar">
      {headerSection}
      {summary ? kpisSection : null}
      {pipelineSection}
      {framework ? frameworkSection : null}
      {settingsSheet}
    </div>
  )
}
