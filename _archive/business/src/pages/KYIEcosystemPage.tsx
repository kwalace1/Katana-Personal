import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
import {
  Building2,
  ChevronRight,
  Globe2,
  LineChart,
  Loader2,
  MapPin,
  Network,
  Search,
  Users,
  Sparkles,
  Wand2,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  associateGlobalInvestor,
  enrichSparseGlobalProfiles,
  getEcosystemStats,
  getInvestorCategoryDefs,
  searchGlobalInvestors,
  type KyiCategoryFacet,
  type KyiEcosystemStats,
  type KyiInvestorCategoryDef,
  type KYIGlobalInvestor,
} from '@/lib/kyi-ecosystem'
import { ensureOrganizationCompany, getCompanies, type KYICompany } from '@/lib/kyi-api'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  getKyiSurfaceConfig,
  KYI_MODULE_ID,
} from '@/lib/kyi/kyi-widget-layout'

const FACET_LABELS: Record<KyiCategoryFacet, string> = {
  stage: 'Stage',
  vehicle: 'Vehicle',
  thesis: 'Thesis',
  mandate: 'Mandate',
  horizon: 'Horizon',
  geo_scope: 'Geography',
}

export default function KYIEcosystemPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const surfaceConfig = getKyiSurfaceConfig('ecosystem')
  const {
    layout,
    isCustomizeMode,
    enterCustomize,
    saveAndExit,
    onLayoutChange,
    addWidget,
    removeWidget,
    availableWidgets,
    resetToDefault,
  } = useModuleWidgetLayout({
    moduleId: KYI_MODULE_ID,
    surfaceId: surfaceConfig.id,
    catalog: surfaceConfig.catalog,
    normalize: surfaceConfig.normalize,
    toBase: surfaceConfig.toBase,
    successMessage: `${surfaceConfig.label} layout saved`,
  })
  const [queryInput, setQueryInput] = useState(searchParams.get('q') ?? '')
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() => {
    const raw = searchParams.get('cats')
    return raw ? raw.split(',').filter(Boolean) : []
  })
  const [categories, setCategories] = useState<KyiInvestorCategoryDef[]>([])
  const [investors, setInvestors] = useState<KYIGlobalInvestor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [companies, setCompanies] = useState<KYICompany[]>([])
  const [companyId, setCompanyId] = useState<number | null>(null)
  const [associatingId, setAssociatingId] = useState<number | null>(null)
  const [stats, setStats] = useState<KyiEcosystemStats | null>(null)
  const [enriching, setEnriching] = useState(false)

  useEffect(() => {
    let cancelled = false
    getEcosystemStats()
      .then((s) => {
        if (!cancelled) setStats(s)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(queryInput.trim()), 300)
    return () => window.clearTimeout(t)
  }, [queryInput])

  useEffect(() => {
    let cancelled = false
    ensureOrganizationCompany()
      .then(() => getCompanies())
      .then((list) => {
        if (cancelled) return
        setCompanies(list)
        const fromUrl = Number(searchParams.get('companyId'))
        if (fromUrl && list.some((c) => c.id === fromUrl)) {
          setCompanyId(fromUrl)
        } else if (list[0]) {
          setCompanyId(list[0].id)
        }
      })
      .catch(() => {
        /* company optional for browse */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only seed company once
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await searchGlobalInvestors({
        query: query || undefined,
        categorySlugs: selectedSlugs.length ? selectedSlugs : undefined,
        companyId: companyId ?? undefined,
        limit: 50,
      })
      setInvestors(result.investors)
      setTotal(result.total_estimate)
      setCategories(result.categories.length ? result.categories : await getInvestorCategoryDefs())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load ecosystem')
      setInvestors([])
    } finally {
      setLoading(false)
    }
  }, [query, selectedSlugs, companyId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const next = new URLSearchParams()
    if (query) next.set('q', query)
    if (selectedSlugs.length) next.set('cats', selectedSlugs.join(','))
    if (companyId != null) next.set('companyId', String(companyId))
    setSearchParams(next, { replace: true })
  }, [query, selectedSlugs, companyId, setSearchParams])

  const categoriesByFacet = useMemo(() => {
    const map = new Map<KyiCategoryFacet, KyiInvestorCategoryDef[]>()
    for (const cat of categories) {
      const list = map.get(cat.facet) ?? []
      list.push(cat)
      map.set(cat.facet, list)
    }
    return map
  }, [categories])

  const toggleSlug = (slug: string) => {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    )
  }

  const handleAssociate = async (inv: KYIGlobalInvestor) => {
    if (companyId == null) {
      toast.error('Select your company first')
      return
    }
    setAssociatingId(inv.id)
    try {
      const row = await associateGlobalInvestor({
        globalInvestorId: inv.id,
        companyId,
      })
      toast.success(`Added ${inv.display_name} to your raise`, {
        description: 'On Targeted investors — private notes stay with your org.',
      })
      setInvestors((prev) =>
        prev.map((p) =>
          p.id === inv.id
            ? { ...p, associated_for_company: true, associated_investor_id: row.id }
            : p,
        ),
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add investor')
    } finally {
      setAssociatingId(null)
    }
  }

  return (
    <MotionPage className="p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            <Link to="/kyi" className="hover:text-foreground inline-flex items-center gap-1">
              <LineChart className="w-3.5 h-3.5" />
              Know Your Investor
            </Link>
            <span className="mx-1.5">/</span>
            Ecosystem
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 0 && (
            <div className="w-56">
              <Label htmlFor="ecosystem-company" className="sr-only">
                Company
              </Label>
              <Select
                value={companyId != null ? String(companyId) : undefined}
                onValueChange={(v) => setCompanyId(Number(v))}
              >
                <SelectTrigger id="ecosystem-company">
                  <SelectValue placeholder="Your company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="kyi-ecosystem-customize"
          />
          <Button variant="outline" asChild>
            <Link to={companyId ? `/kyi/intel?companyId=${companyId}` : '/kyi/intel'}>
              <Sparkles className="w-4 h-4 mr-1.5" />
              Raise intel
            </Link>
          </Button>
          <Button
            variant="outline"
            disabled={enriching}
            onClick={async () => {
              setEnriching(true)
              try {
                const { updated } = await enrichSparseGlobalProfiles(150)
                toast.success(
                  updated > 0
                    ? `Enriched ${updated} sparse profile${updated === 1 ? '' : 's'}`
                    : 'Directory already enriched',
                )
                await load()
                const s = await getEcosystemStats()
                setStats(s)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Enrichment failed')
              } finally {
                setEnriching(false)
              }
            }}
          >
            {enriching ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Wand2 className="w-4 h-4 mr-1.5" />
            )}
            Enrich directory
          </Button>
          <Button variant="outline" asChild>
            <Link to={companyId ? `/kyi/companies/${companyId}?tab=overview` : '/kyi'}>
              Back to workspace
            </Link>
          </Button>
        </div>
      </div>

      {isCustomizeMode ? (
        <div className="space-y-3">
          <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
          <div className="flex flex-wrap items-center gap-2">
            <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
            <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
              Reset layout
            </Button>
          </div>
        </div>
      ) : null}

      <ModuleWidgetCanvas
        widgets={layout.widgets}
        catalog={surfaceConfig.catalog}
        customizeMode={isCustomizeMode}
        onLayoutChange={onLayoutChange}
        onRemoveWidget={removeWidget}
        rowHeight={36}
        renderWidget={(widgetId): ReactNode => {
          if (widgetId === 'ecosystem_header') {
            return (
              <div className="h-full overflow-hidden rounded-xl border bg-card/50 p-5 md:p-6">
                <h1 className="text-2xl font-semibold flex items-center gap-2">
                  <Globe2 className="w-7 h-7" />
                  Investor ecosystem
                </h1>
                <p className="text-muted-foreground mt-1 max-w-2xl">
                  Shared investor directory across Katana. Associate someone with your raise without
                  creating a duplicate — your notes and pipeline stay private.
                </p>
                {stats && (
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                    <span className="rounded-full border bg-card/60 px-2.5 py-1 tabular-nums">
                      <span className="font-semibold text-foreground">
                        {stats.investor_count.toLocaleString()}
                      </span>{' '}
                      investors
                    </span>
                    <span className="rounded-full border bg-card/60 px-2.5 py-1 tabular-nums">
                      <span className="font-semibold text-foreground">{stats.category_count}</span>{' '}
                      categories
                    </span>
                    <span className="rounded-full border bg-card/60 px-2.5 py-1 tabular-nums">
                      <span className="font-semibold text-foreground">
                        {stats.contributing_org_estimate}
                      </span>{' '}
                      contributing orgs
                    </span>
                  </div>
                )}
              </div>
            )
          }

          if (widgetId === 'ecosystem_filters') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="w-4 h-4" />
                    Browse & filter
                  </CardTitle>
                  <CardDescription>
                    Categories are shared facets (stage, vehicle, thesis, mandate). Select any
                    combination.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Input
                    placeholder="Search name, firm, industry, location…"
                    value={queryInput}
                    onChange={(e) => setQueryInput(e.target.value)}
                  />
                  {[...categoriesByFacet.entries()].map(([facet, cats]) => (
                    <div key={facet} className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {FACET_LABELS[facet]}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {cats.map((cat) => {
                          const active = selectedSlugs.includes(cat.slug)
                          return (
                            <button
                              key={cat.slug}
                              type="button"
                              onClick={() => toggleSlug(cat.slug)}
                              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                                active
                                  ? 'border-primary/40 bg-primary/10 text-foreground font-medium'
                                  : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                              }`}
                            >
                              {cat.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {selectedSlugs.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedSlugs([])}>
                      Clear filters
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'ecosystem_directory') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
                  <div>
                    <CardTitle className="text-lg">Directory</CardTitle>
                    <CardDescription>
                      {loading ? 'Loading…' : `${total.toLocaleString()} investors match`}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  {error && (
                    <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
                      <p className="font-medium text-destructive">Cannot load ecosystem</p>
                      <p className="text-muted-foreground mt-1">{error}</p>
                      <p className="text-muted-foreground mt-2 text-xs">
                        If this is a new environment, run{' '}
                        <code className="rounded bg-muted px-1">
                          supabase-kyi-ecosystem-migration.sql
                        </code>{' '}
                        in the Supabase SQL Editor.
                      </p>
                    </div>
                  )}
                  {!error && loading && (
                    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Searching ecosystem…
                    </div>
                  )}
                  {!error && !loading && investors.length === 0 && (
                    <p className="text-muted-foreground py-12 text-center">
                      No investors match yet. Run the ecosystem migration to backfill from leads, or
                      add investors to your raise to grow the directory.
                    </p>
                  )}
                  {!error && !loading && investors.length > 0 && (
                    <ul className="space-y-2">
                      {investors.map((inv) => (
                        <li
                          key={inv.id}
                          className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/40 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            {inv.entity_type === 'firm' ? (
                              <Building2 className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <Users className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/kyi/ecosystem/${inv.id}${companyId ? `?companyId=${companyId}` : ''}`}
                              className="font-medium hover:underline inline-flex items-center gap-1"
                            >
                              {inv.display_name}
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                            </Link>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-sm text-muted-foreground">
                              {inv.firm && <span>{inv.firm}</span>}
                              {inv.title && <span>{inv.title}</span>}
                              {inv.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {inv.location}
                                </span>
                              )}
                              {(inv.tracked_by_org_count ?? 0) > 0 && (
                                <span className="inline-flex items-center gap-1 text-xs">
                                  <Network className="w-3 h-3" />
                                  Tracked by {inv.tracked_by_org_count}{' '}
                                  {inv.tracked_by_org_count === 1 ? 'company' : 'companies'}
                                </span>
                              )}
                            </div>
                            {(inv.categories?.length ?? 0) > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {inv.categories!.slice(0, 6).map((c) => (
                                  <Badge
                                    key={c.slug}
                                    variant="outline"
                                    className="text-[10px] font-normal"
                                  >
                                    {c.label}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="shrink-0">
                            {inv.associated_for_company ? (
                              <Button variant="secondary" size="sm" asChild>
                                <Link to={`/kyi/investors/${inv.associated_investor_id}`}>
                                  In your raise
                                </Link>
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                disabled={companyId == null || associatingId === inv.id}
                                onClick={() => void handleAssociate(inv)}
                              >
                                {associatingId === inv.id ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                    Adding…
                                  </>
                                ) : (
                                  'Add to our raise'
                                )}
                              </Button>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            )
          }

          return null
        }}
      />
    </MotionPage>
  )
}
