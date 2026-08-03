import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { motion } from 'framer-motion'
import { MotionPage } from '@/components/motion-page'
import { toast } from 'sonner'
import {
  Building2,
  Loader2,
  MapPin,
  Briefcase,
  Globe,
  Plus,
  Trash2,
  Target,
  Upload,
  Download,
  UserPlus,
} from 'lucide-react'

import { KyiImportDialog } from '@/components/kyi/kyi-import-dialog'
import { KyiNorthstarTab } from '@/components/kyi/KyiNorthstarTab'
import { KyiOverviewTab } from '@/components/kyi/KyiOverviewTab'
import { AddEmployeeFromHrDialog } from '@/components/kyi/add-employee-from-hr-dialog'
import { SignalFilter } from '@/components/kyi/signal-badges'
import { KyiCompanyNav, type KyiContactSegment } from '@/components/kyi/KyiCompanyNav'
import { KyiContactsTabContent } from '@/components/kyi/KyiContactsTabContent'
import { KyiLeadDetailDrawer } from '@/components/kyi/KyiLeadDetailDrawer'
import { ModuleHelpButton } from '@/components/tour/module-help-button'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import {
  KYI_MODULE_ID,
  getKyiCompanySurfaceConfig,
  getKyiSurfaceConfig,
  type KyiTabLayoutProps,
} from '@/lib/kyi/kyi-widget-layout'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
  }),
}
import { AccessMapPage } from '@/components/kyi/AccessMapPage'
import {
  getCompany,
  getCompanyInvestors,
  getGeoSettings,
  updateGeoSettings,
  getLeads,
  triggerRefreshNow,
  triggerGeocodeNow,
  kyiGeocodeProgress,
  createInvestor,
  deleteCompany,
  deleteInvestor,
  getCompanyNotesHistory,
  buildTargetedInvestorAddUrl,
  buildLeadSnapshotFromLead,
  findInvestorByLeadOrName,
  getLeadById,
  getCompanyRaiseSummary,
  getCompanyGeoTargets,
  addCompanyGeoTargetFromLabel,
  deleteCompanyGeoTarget,
  getInvestorTypeProfiles,
  getWarmPathForLead,
  GEO_LEVEL_TO_MILES,
  KYI_LEAD_FILTER_PRESETS,
  KYI_SIGNAL_LABELS,
  type KyiLeadFilterPresetId,
  type KyiCompanyRaiseSummary,
  type KYICompanyGeoTarget,
  type KYICompanyDetail,
  type KYIInvestor,
  type GeoSettingsResponse,
  type KYILead,
  type KYINotesHistoryEntry,
  type KyiWarmPath,
} from '@/lib/kyi-api'
import { suggestGlobalInvestorsForCompany, type KYIGlobalInvestor } from '@/lib/kyi-ecosystem'
import { exportLocalizedLeadsCsvFromApi } from '@/lib/kyi-export'

const emptyInvestorForm = {
  full_name: '',
  email: '',
  phone: '',
  location: '',
  industry: '',
  firm: '',
  title: '',
  profile_url: '',
  notes: '',
}

const SOURCE_NAME_TO_SIGNAL_KEY: Record<string, string> = {
  fec_donors: 'fec_donor',
  fec_donor: 'fec_donor',
  finra: 'finra_brokercheck',
  brokercheck: 'finra_brokercheck',
  corp_registry: 'business_registry',
  registry: 'business_registry',
  uk_filing: 'companies_house',
  press: 'press_release',
  news: 'news_sentiment',
}

function normalizeSourceKey(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

function signalKeyFromSourceName(sourceName: string): string | null {
  const normalized = normalizeSourceKey(sourceName)
  const mapped = SOURCE_NAME_TO_SIGNAL_KEY[normalized] ?? normalized
  return mapped in KYI_SIGNAL_LABELS ? mapped : null
}

function rawSourceFilterKey(sourceName: string): string {
  return `raw:${normalizeSourceKey(sourceName)}`
}

function getLeadSourceNames(lead: KYILead): string[] {
  const names = new Set<string>()
  for (const src of lead.sources ?? []) {
    if (typeof src?.source_name !== 'string') continue
    const name = src.source_name.trim()
    if (name) names.add(name)
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

function leadFilterKeys(lead: KYILead): Set<string> {
  const keys = new Set<string>()
  const leadSources = lead.sources ?? []
  const hasSources = leadSources.length > 0
  for (const src of leadSources) {
    const sourceName = typeof src?.source_name === 'string' ? src.source_name : ''
    if (!sourceName.trim()) continue
    keys.add(rawSourceFilterKey(sourceName))
    const mappedKey = signalKeyFromSourceName(sourceName)
    if (mappedKey) keys.add(mappedKey)
  }
  // Fall back to signal flags only when no source provenance exists.
  if (!hasSources && lead.signals) {
    for (const [key, value] of Object.entries(lead.signals)) {
      if (value === true) keys.add(key)
    }
  }
  return keys
}

function leadMatchesAnySignalFilter(lead: KYILead, filters: Set<string>): boolean {
  if (filters.size === 0) return true
  const keys = leadFilterKeys(lead)
  for (const filter of filters) {
    if (keys.has(filter)) return true
  }
  return false
}

export default function KYICompanyPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const companyId = id ? parseInt(id, 10) : NaN
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTab = searchParams.get('tab') || 'overview'
  const LEGACY_CONTACT_TAB: Record<string, KyiContactSegment> = {
    employees: 'employees',
    'current-investors': 'current',
    'targeted-investors': 'targeted',
  }
  const initialTab = (() => {
    if (rawTab === 'investors') return 'contacts'
    if (rawTab in LEGACY_CONTACT_TAB) return 'contacts'
    if (['overview', 'contacts', 'leads', 'geo', 'accessmap', 'northstar'].includes(rawTab)) return rawTab
    return 'overview'
  })()
  const contactSegment: KyiContactSegment = (() => {
    const seg = searchParams.get('segment')
    if (seg === 'employees' || seg === 'current' || seg === 'targeted' || seg === 'network') return seg
    if (rawTab in LEGACY_CONTACT_TAB) return LEGACY_CONTACT_TAB[rawTab]
    return 'employees'
  })()
  const surfaceConfig = useMemo(() => getKyiCompanySurfaceConfig(initialTab), [initialTab])
  const activeSurface = surfaceConfig ?? getKyiSurfaceConfig('overview')
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
    surfaceId: activeSurface.id,
    catalog: activeSurface.catalog,
    normalize: activeSurface.normalize,
    toBase: activeSurface.toBase,
    successMessage: `${activeSurface.label} layout saved`,
  })
  const tabLayout: KyiTabLayoutProps | undefined = surfaceConfig
    ? {
        widgets: layout.widgets,
        catalog: surfaceConfig.catalog,
        customizeMode: isCustomizeMode,
        onLayoutChange,
        onRemoveWidget: removeWidget,
      }
    : undefined
  const customizeChrome =
    surfaceConfig && isCustomizeMode ? (
      <div className="space-y-3 mb-4">
        <ModuleCustomizeHint surfaceLabel={surfaceConfig.label} />
        <div className="flex flex-wrap items-center gap-2">
          <WidgetCatalogDialog available={availableWidgets} onAdd={addWidget} />
          <Button type="button" variant="ghost" size="sm" onClick={resetToDefault}>
            Reset layout
          </Button>
        </div>
      </div>
    ) : null
  const [company, setCompany] = useState<KYICompanyDetail | null>(null)
  const [investors, setInvestors] = useState<KYIInvestor[]>([])
  const [addInvestorOpen, setAddInvestorOpen] = useState(false)
  const [addEmployeeFromHrOpen, setAddEmployeeFromHrOpen] = useState(false)
  const [kyiImportOpen, setKyiImportOpen] = useState(false)
  const [kyiImportDefaultTarget, setKyiImportDefaultTarget] = useState<
    'investors' | 'leads' | 'northstar' | 'personal_network'
  >('investors')
  const [addInvestorSaving, setAddInvestorSaving] = useState(false)
  const [addInvestorForm, setAddInvestorForm] = useState(emptyInvestorForm)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteDeleting, setDeleteDeleting] = useState(false)
  const [deleteInvestorId, setDeleteInvestorId] = useState<number | null>(null)
  const [deleteInvestorDeleting, setDeleteInvestorDeleting] = useState(false)
  const [geo, setGeo] = useState<GeoSettingsResponse | null>(null)
  const [geoSaving, setGeoSaving] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoForm, setGeoForm] = useState<{
    location_label: string
    radius_miles: number
    geo_segment_level: string
  }>({
    location_label: '',
    radius_miles: 50,
    geo_segment_level: 'local',
  })
  const [leads, setLeads] = useState<KYILead[] | null>(null)
  const [leadStats, setLeadStats] = useState<{
    total_count: number
    filtered_count: number
    displayed_count: number
    needs_geocoding_count: number
  } | null>(null)
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [leadsError, setLeadsError] = useState<string | null>(null)
  const [leadsFilters, setLeadsFilters] = useState<{
    thinning: string
    minScore: number | null
    categorySlug: string
    fuzzyDedup: boolean
  }>({
    thinning: 'top_10_percent',
    minScore: null,
    categorySlug: '',
    fuzzyDedup: false,
  })
  const [filterPresets, setFilterPresets] = useState<Set<KyiLeadFilterPresetId>>(new Set())
  const [sectorRelevantOnly, setSectorRelevantOnly] = useState(false)
  const [leadDrawerId, setLeadDrawerId] = useState<number | null>(null)
  const [pendingSourceLeadId, setPendingSourceLeadId] = useState<number | null>(null)
  const [pendingLeadSnapshot, setPendingLeadSnapshot] = useState<ReturnType<typeof buildLeadSnapshotFromLead> | null>(null)
  const [raiseSummary, setRaiseSummary] = useState<KyiCompanyRaiseSummary | null>(null)
  const [ecosystemMatches, setEcosystemMatches] = useState<
    Array<KYIGlobalInvestor & { match_score: number; match_reasons: string[] }>
  >([])
  const [ecosystemMatchesLoading, setEcosystemMatchesLoading] = useState(false)
  const [raiseForm, setRaiseForm] = useState({
    raise_stage: '',
    raise_target_amount: '',
    sector_tags: '',
    preferred_investor_types: [] as string[],
  })
  const [raiseSaving, setRaiseSaving] = useState(false)
  const [typeProfileOptions, setTypeProfileOptions] = useState<string[]>([])
  const [geoTargets, setGeoTargets] = useState<KYICompanyGeoTarget[]>([])
  const [warmPaths, setWarmPaths] = useState<Map<number, KyiWarmPath>>(new Map())
  const [signalFilters, setSignalFilters] = useState<Set<string>>(new Set())
  const [investorSegment, setInvestorSegment] = useState<'all' | 'current_investor' | 'prospect' | 'geo_target'>('all')
  const [addInvestorRole, setAddInvestorRole] = useState<'employee' | 'investor'>('investor')
  const [addInvestorAdminOverride, setAddInvestorAdminOverride] = useState(false)
  const [addInvestorSegmentType, setAddInvestorSegmentType] = useState('current_investor')
  const [addInvestorViaOrbit, setAddInvestorViaOrbit] = useState(false)
  const [pipelineMessage, setPipelineMessage] = useState<string | null>(null)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeProgress, setGeocodeProgress] = useState<{
    initial: number
    current: number
    status: 'running' | 'done'
  } | null>(null)
  // Progress bar: processed = attempted, geocoded = Open-Meteo returned coords, done = saved to DB
  const [geocodeBatchProcessed, setGeocodeBatchProcessed] = useState(0)
  const [geocodeBatchGeocoded, setGeocodeBatchGeocoded] = useState(0)
  const [geocodeBatchDone, setGeocodeBatchDone] = useState(0)
  const [geocodeBatchFailed, setGeocodeBatchFailed] = useState(0)
  const [geocodeBatchUnresolvable, setGeocodeBatchUnresolvable] = useState(0)
  const [geocodeBatchSize, setGeocodeBatchSize] = useState(0)
  const [geocodeNeedsCount, setGeocodeNeedsCount] = useState<number | null>(null)
  const [notesHistory, setNotesHistory] = useState<KYINotesHistoryEntry[]>([])
  const [notesSearch, setNotesSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const investorTypeMix = useMemo(() => {
    const m = new Map<string, number>()
    for (const inv of investors) {
      const t = (inv.investor_type ?? '').trim()
      if (!t) continue
      m.set(t, (m.get(t) ?? 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [investors])

  const investorsWithStrategyNotes = useMemo(
    () => investors.filter((i) => (i.notes ?? '').trim().length > 0).length,
    [investors],
  )

  const employeeRoster = useMemo(
    () => investors.filter((inv) => (inv.user_role_classification ?? 'employee') === 'employee'),
    [investors],
  )
  const personalNetworkRoster = useMemo(
    () =>
      investors.filter(
        (inv) =>
          inv.user_role_classification === 'investor' &&
          (inv.segment_type ?? '') === 'personal_network',
      ),
    [investors],
  )
  const currentInvestorRoster = useMemo(
    () =>
      investors.filter(
        (inv) =>
          inv.user_role_classification === 'investor' &&
          (inv.segment_type ?? 'current_investor') !== 'targeted_investor' &&
          (inv.segment_type ?? '') !== 'personal_network',
      ),
    [investors],
  )
  const targetedInvestorRoster = useMemo(
    () =>
      investors.filter(
        (inv) =>
          inv.user_role_classification === 'investor' &&
          (inv.segment_type ?? '') === 'targeted_investor',
      ),
    [investors],
  )
  const networkContributedCount = useMemo(
    () => personalNetworkRoster.filter((inv) => inv.global_investor_id != null).length,
    [personalNetworkRoster],
  )
  const filteredEmployees = useMemo(() => {
    if (investorSegment === 'all') return employeeRoster
    return employeeRoster.filter((inv) => (inv.segment_type ?? 'current_investor') === investorSegment)
  }, [employeeRoster, investorSegment])

  const overviewGeoCoveragePct = useMemo(() => {
    if (!leadStats || leadStats.total_count <= 0) return null
    return Math.round(
      ((leadStats.total_count - leadStats.needs_geocoding_count) / leadStats.total_count) * 100,
    )
  }, [leadStats])

  const goToCompanyTab = useCallback(
    (tab: string, segment?: KyiContactSegment) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.set('tab', tab)
          if (tab === 'contacts' && segment) next.set('segment', segment)
          else if (tab !== 'contacts') next.delete('segment')
          return next
        },
        { replace: true },
      )
    },
    [setSearchParams],
  )

  const setContactSegment = useCallback(
    (segment: KyiContactSegment) => goToCompanyTab('contacts', segment),
    [goToCompanyTab],
  )

  useEffect(() => {
    if (!(rawTab in LEGACY_CONTACT_TAB)) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', 'contacts')
        next.set('segment', LEGACY_CONTACT_TAB[rawTab])
        return next
      },
      { replace: true },
    )
  }, [rawTab, setSearchParams])

  const availableSignalFilters = useMemo(() => {
    const next = new Set<string>()
    if (!leads?.length) return next
    for (const lead of leads) {
      for (const key of leadFilterKeys(lead)) next.add(key)
    }
    return next
  }, [leads])

  const signalFilterOptions = useMemo(() => {
    const byKey = new Map<string, { key: string; label: string; category: string; color: string; count?: number }>()
    const counts = new Map<string, number>()
    for (const lead of leads ?? []) {
      for (const key of leadFilterKeys(lead)) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }

    // Always keep original preset categories visible as the primary filters.
    for (const [key, meta] of Object.entries(KYI_SIGNAL_LABELS)) {
      const count = counts.get(key) ?? 0
      if (count <= 0) continue
      byKey.set(key, { key, label: meta.label, category: meta.category, color: meta.color, count })
    }

    // Also expose unmapped/raw sources in case a provider name doesn't map yet.
    for (const lead of leads ?? []) {
      for (const src of lead.sources ?? []) {
        const sourceName = typeof src?.source_name === 'string' ? src.source_name.trim() : ''
        if (!sourceName) continue
        const mappedKey = signalKeyFromSourceName(sourceName)
        if (mappedKey) continue
        const key = rawSourceFilterKey(sourceName)
        if (byKey.has(key)) continue
        byKey.set(key, {
          key,
          label: sourceName,
          category: 'Integrated Sources',
          color: 'gray',
          count: counts.get(key) ?? 0,
        })
      }
    }

    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [leads])

  const visibleFilterKeys = useMemo(
    () => new Set(signalFilterOptions.map((opt) => opt.key)),
    [signalFilterOptions],
  )

  const inRadiusSourceBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    for (const lead of leads ?? []) {
      for (const src of lead.sources ?? []) {
        if (typeof src?.source_name !== 'string') continue
        const sourceName = src.source_name.trim()
        if (!sourceName) continue
        counts.set(sourceName, (counts.get(sourceName) ?? 0) + 1)
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([source, count]) => ({ source, count }))
  }, [leads])

  useEffect(() => {
    if (signalFilters.size === 0) return
    setSignalFilters((prev) => {
      const pruned = new Set([...prev].filter((sig) => visibleFilterKeys.has(sig)))
      return pruned.size === prev.size ? prev : pruned
    })
  }, [signalFilters.size, visibleFilterKeys])

  const filteredLeadsCount = useMemo(() => {
    if (!leads?.length) return 0
    if (signalFilters.size === 0) return leads.length
    return leads.filter((l) => leadMatchesAnySignalFilter(l, signalFilters)).length
  }, [leads, signalFilters])

  const leadsByState = useMemo(() => {
    if (!leads?.length) return [] as { state: string; items: KYILead[] }[]
    let filtered = leads
    if (signalFilters.size > 0) {
      filtered = leads.filter((l) => leadMatchesAnySignalFilter(l, signalFilters))
    }
    const m = new Map<string, KYILead[]>()
    for (const l of filtered) {
      const s = (l.state ?? '').trim() || '—'
      const arr = m.get(s) ?? []
      arr.push(l)
      m.set(s, arr)
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([state, items]) => ({ state, items }))
  }, [leads, signalFilters])

  useEffect(() => {
    if (!id || Number.isNaN(companyId)) {
      setError('Invalid company')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([
      getCompany(companyId),
      getCompanyInvestors(companyId),
      getGeoSettings(companyId).catch(() => null),
      getCompanyNotesHistory(companyId).catch(() => [] as KYINotesHistoryEntry[]),
    ])
      .then(([companyData, investorsData, geoData, notesData]) => {
        if (cancelled) return
        setCompany(companyData)
        setRaiseForm({
          raise_stage: companyData.raise_stage ?? '',
          raise_target_amount:
            companyData.raise_target_amount != null
              ? String(companyData.raise_target_amount)
              : '',
          sector_tags: (companyData.sector_tags ?? []).join(', '),
          preferred_investor_types: companyData.preferred_investor_types ?? [],
        })
        setInvestors(investorsData)
        setNotesHistory(notesData)
        if (geoData) {
          setGeo(geoData)
          if (geoData.settings) {
            const lvl = geoData.settings.geo_segment_level ?? 'local'
            const rawR = geoData.settings.radius_miles
            const r =
              typeof rawR === 'number' && Number.isFinite(rawR) && rawR > 0
                ? Math.min(250, Math.max(5, Math.round(rawR)))
                : 50
            setGeoForm({
              location_label: geoData.settings.location_label,
              radius_miles: r,
              geo_segment_level: lvl,
            })
          }
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, companyId])

  const loadLeads = useCallback(async () => {
    if (!companyId) return
    setLeadsLoading(true)
    setLeadsError(null)
    try {
      const data = await getLeads(companyId, {
        thinning: leadsFilters.thinning,
        min_score: leadsFilters.minScore,
        dataCategorySlug: leadsFilters.categorySlug.trim() || null,
        fuzzyDedup: leadsFilters.fuzzyDedup,
        filterPresets: filterPresets.size > 0 ? [...filterPresets] : undefined,
        sectorRelevantOnly,
      })
      setLeads(data.leads)
      setLeadStats({
        total_count: data.total_count,
        filtered_count: data.filtered_count,
        displayed_count: data.displayed_count,
        needs_geocoding_count: data.needs_geocoding_count,
      })
      setGeocodeProgress((prev) => {
        if (!prev || prev.status === 'done') return prev
        const current = data.needs_geocoding_count
        const status = current === 0 ? 'done' : prev.status
        return {
          ...prev,
          current,
          status,
        }
      })
    } catch (e) {
      setLeadsError(e instanceof Error ? e.message : 'Failed to load leads')
    } finally {
      setLeadsLoading(false)
    }
  }, [
    companyId,
    leadsFilters.thinning,
    leadsFilters.minScore,
    leadsFilters.categorySlug,
    leadsFilters.fuzzyDedup,
    filterPresets,
    sectorRelevantOnly,
  ])

  const refreshRaiseSummary = useCallback(() => {
    if (Number.isNaN(companyId)) return
    getCompanyRaiseSummary(companyId).then(setRaiseSummary).catch(() => setRaiseSummary(null))
  }, [companyId])

  useEffect(() => {
    refreshRaiseSummary()
  }, [refreshRaiseSummary, investors.length])

  useEffect(() => {
    if (Number.isNaN(companyId)) return
    let cancelled = false
    setEcosystemMatchesLoading(true)
    suggestGlobalInvestorsForCompany(companyId, 6)
      .then((rows) => {
        if (!cancelled) setEcosystemMatches(rows)
      })
      .catch(() => {
        if (!cancelled) setEcosystemMatches([])
      })
      .finally(() => {
        if (!cancelled) setEcosystemMatchesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId, raiseForm.raise_stage, raiseForm.sector_tags, investors.length])

  useEffect(() => {
    if (Number.isNaN(companyId)) return
    getInvestorTypeProfiles(companyId)
      .then((p) => setTypeProfileOptions(p.map((x) => x.type)))
      .catch(() => {})
  }, [companyId])

  useEffect(() => {
    if (Number.isNaN(companyId)) return
    getCompanyGeoTargets(companyId, { additionalOnly: true }).then(setGeoTargets).catch(() => setGeoTargets([]))
  }, [companyId, geo?.configured])

  useEffect(() => {
    if (!leads?.length || Number.isNaN(companyId)) {
      setWarmPaths(new Map())
      return
    }
    let cancelled = false
    const sample = leads.slice(0, 24)
    Promise.all(
      sample.map((l) =>
        getWarmPathForLead(companyId, {
          id: l.id,
          display_name: l.display_name,
          firm: (l.metadata?.firm as string | undefined) ?? null,
        }).then((path) => [l.id, path] as const),
      ),
    ).then((pairs) => {
      if (cancelled) return
      setWarmPaths(new Map(pairs))
    })
    return () => {
      cancelled = true
    }
  }, [leads, companyId])

  useEffect(() => {
    if (!Number.isNaN(companyId)) {
      void loadLeads()
    }
  }, [companyId, loadLeads])

  // Poll leads every 3s while geocoding so "X / Y geocoded" updates. Depend only on status
  // so we don't tear down the interval every time current changes.
  const geocodeRunning = geocodeProgress?.status === 'running'
  useEffect(() => {
    if (!geocodeRunning || !companyId) return

    let cancelled = false
    const poll = async () => {
      if (cancelled) return
      try {
        const data = await getLeads(companyId, {
          thinning: leadsFilters.thinning,
          min_score: leadsFilters.minScore,
          dataCategorySlug: leadsFilters.categorySlug.trim() || null,
          fuzzyDedup: leadsFilters.fuzzyDedup,
        })
        setLeads(data.leads)
        setLeadStats({
          total_count: data.total_count,
          filtered_count: data.filtered_count,
          displayed_count: data.displayed_count,
          needs_geocoding_count: data.needs_geocoding_count,
        })
        const needs = data.needs_geocoding_count
        setGeocodeNeedsCount(needs)
        setGeocodeProgress((prev) => {
          if (!prev || prev.status === 'done') return prev
          const status = needs === 0 ? 'done' : 'running'
          return { ...prev, current: needs, status }
        })
        if (needs === 0) {
          setPipelineMessage('Geocoding complete. All leads have coordinates.')
        }
      } catch (e) {
        if (!cancelled) {
          setPipelineError(e instanceof Error ? e.message : 'Failed to refresh leads during geocoding')
        }
      }
    }

    poll()
    const interval = window.setInterval(poll, geocodeRunning ? 8000 : 30000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [companyId, geocodeRunning, leadsFilters.thinning, leadsFilters.minScore, leadsFilters.categorySlug, leadsFilters.fuzzyDedup])

  const handleSaveGeo = async () => {
    if (!companyId) return
    setGeoSaving(true)
    setGeoError(null)
    try {
      const res = await updateGeoSettings(companyId, {
        location_label: geoForm.location_label,
        radius_miles: geoForm.radius_miles,
        geo_segment_level: geoForm.geo_segment_level,
      })
      setGeo((prev) =>
        prev
          ? {
              ...prev,
              configured: true,
              settings: res.settings,
            }
          : {
              configured: true,
              client_id: companyId,
              client_name: company?.name ?? '',
              settings: res.settings,
            },
      )
      void loadLeads()
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Could not save geo settings')
    } finally {
      setGeoSaving(false)
    }
  }

  const fetchInvestors = () => {
    if (Number.isNaN(companyId)) return
    getCompanyInvestors(companyId).then(setInvestors).catch(() => {})
  }

  const handleAddInvestor = async () => {
    const full_name = addInvestorForm.full_name.trim()
    if (!full_name || Number.isNaN(companyId)) return
    setAddInvestorSaving(true)
    try {
      await createInvestor({
        company_id: companyId,
        full_name,
        email: addInvestorForm.email.trim() || undefined,
        phone: addInvestorForm.phone.trim() || undefined,
        location: addInvestorForm.location.trim() || undefined,
        industry: addInvestorForm.industry.trim() || undefined,
        firm: addInvestorForm.firm.trim() || undefined,
        title: addInvestorForm.title.trim() || undefined,
        profile_url: addInvestorForm.profile_url.trim() || undefined,
        notes: addInvestorForm.notes.trim() || undefined,
        user_role_classification: addInvestorRole,
        added_via_orbit: addInvestorViaOrbit,
        admin_override_investor_role: addInvestorAdminOverride,
        segment_type: addInvestorSegmentType,
        source_lead_id: pendingSourceLeadId ?? undefined,
        lead_snapshot: pendingLeadSnapshot ?? undefined,
      })
      toast.success(
        addInvestorSegmentType === 'targeted_investor'
          ? 'Added to targeted investors'
          : addInvestorRole === 'investor'
            ? 'Investor added'
            : 'Employee added',
      )
      fetchInvestors()
      if (addInvestorSegmentType === 'targeted_investor') {
        goToCompanyTab('contacts', 'targeted')
      }
      setAddInvestorOpen(false)
      setAddInvestorForm(emptyInvestorForm)
      setAddInvestorRole('investor')
      setAddInvestorAdminOverride(false)
      setAddInvestorSegmentType('current_investor')
      setAddInvestorViaOrbit(false)
      setPendingSourceLeadId(null)
      setPendingLeadSnapshot(null)
      refreshRaiseSummary()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add investor')
    } finally {
      setAddInvestorSaving(false)
    }
  }

  const handleDeleteCompany = async () => {
    if (Number.isNaN(companyId) || company?.id === 1) return
    setDeleteDeleting(true)
    try {
      await deleteCompany(companyId)
      navigate('/kyi')
    } finally {
      setDeleteDeleting(false)
      setDeleteConfirmOpen(false)
    }
  }

  const handleDeleteInvestor = async () => {
    if (deleteInvestorId == null) return
    setDeleteInvestorDeleting(true)
    try {
      await deleteInvestor(deleteInvestorId)
      setInvestors((prev) => prev.filter((inv) => inv.id !== deleteInvestorId))
    } finally {
      setDeleteInvestorDeleting(false)
      setDeleteInvestorId(null)
    }
  }

  const handleRefreshNow = async () => {
    setRefreshing(true)
    setPipelineMessage(null)
    setPipelineError(null)
    try {
      const res = await triggerRefreshNow()
      setPipelineMessage(res.message || 'Refresh started. Reload leads in a few minutes.')
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : 'Failed to start refresh')
    } finally {
      setRefreshing(false)
    }
  }

  // Listen for per-lead updates (processed = attempted, geocoded = got coords, updated = saved)
  useEffect(() => {
    const onTick = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && typeof d.processed === 'number') {
        setGeocodeBatchProcessed(d.processed)
        setGeocodeBatchGeocoded(d.geocoded ?? 0)
        setGeocodeBatchDone(d.updated ?? 0)
        setGeocodeBatchFailed(d.failed ?? 0)
        setGeocodeBatchUnresolvable(d.unresolvable ?? 0)
        if (typeof d.batchSize === 'number') setGeocodeBatchSize(d.batchSize)
        if (d.done) {
          setGeocodeProgress((prev) => (prev ? { ...prev, status: 'done' } : prev))
          void loadLeads()
          const saved = d.updated ?? 0
          const geocoded = d.geocoded ?? 0
          const dbFail = d.failed ?? 0
          const unresolvable = d.unresolvable ?? 0
          const parts: string[] = []
          if (saved > 0) parts.push(`${saved} saved`)
          if (unresolvable > 0) parts.push(`${unresolvable} could not be resolved`)
          if (dbFail > 0) parts.push(`${dbFail} DB write failures`)
          if (saved > 0 || geocoded > 0) {
            setPipelineMessage(`Geocoding complete: ${geocoded} geocoded, ${parts.join(', ')}.`)
          } else if (geocoded === 0) {
            setPipelineError('Geocoding returned no results. The API may not recognize the city/state values in your leads. Check console for details.')
          } else {
            setPipelineError(`Geocoded ${geocoded} leads but could not save any. Check database permissions on kyi_investor_leads.`)
          }
        }
      }
    }
    window.addEventListener('kyi-geocode-tick', onTick)
    return () => window.removeEventListener('kyi-geocode-tick', onTick)
  }, [loadLeads])

  // Also poll every 200ms while running (backup in case events don't fire)
  useEffect(() => {
    if (!geocodeRunning) return
    const tick = () => {
      setGeocodeBatchProcessed(kyiGeocodeProgress.processed)
      setGeocodeBatchGeocoded(kyiGeocodeProgress.geocoded)
      setGeocodeBatchDone(kyiGeocodeProgress.updated)
      setGeocodeBatchSize(kyiGeocodeProgress.batchSize)
      if (kyiGeocodeProgress.done) {
        setGeocodeProgress((prev) => (prev ? { ...prev, status: 'done' } : prev))
      }
    }
    tick()
    const interval = window.setInterval(tick, 200)
    return () => window.clearInterval(interval)
  }, [geocodeRunning])

  // Open "Add Investor" dialog pre-filled when navigated from Access Map / targeting / leads
  useEffect(() => {
    const addName = searchParams.get('addName')
    if (!addName) return
    const addLocation = searchParams.get('addLocation') ?? ''
    const addLeadIdRaw = searchParams.get('addLeadId')
    const addLeadId = addLeadIdRaw ? parseInt(addLeadIdRaw, 10) : NaN
    const isTargeted =
      searchParams.get('targeted') === '1' ||
      searchParams.get('segment') === 'targeted' ||
      searchParams.get('segment') === 'targeted_investor' ||
      searchParams.get('tab') === 'targeted-investors' ||
      (searchParams.get('tab') === 'contacts' && searchParams.get('segment') === 'targeted')
    setAddInvestorForm((prev) => ({ ...prev, full_name: addName, location: addLocation }))
    setAddInvestorRole('investor')
    setAddInvestorSegmentType(isTargeted ? 'targeted_investor' : 'current_investor')
    setAddInvestorViaOrbit(true)
    setAddInvestorAdminOverride(true)
    if (!Number.isNaN(addLeadId)) {
      setPendingSourceLeadId(addLeadId)
      getLeadById(addLeadId).then((lead) => {
        if (lead) {
          setPendingLeadSnapshot(buildLeadSnapshotFromLead(lead))
          findInvestorByLeadOrName(companyId, addLeadId, lead.display_name).then((dup) => {
            if (dup) toast.info(`Already on targeted list as ${dup.full_name}`)
          })
        }
      })
    }
    setAddInvestorOpen(true)
    const clean = new URLSearchParams(searchParams)
    clean.delete('addName')
    clean.delete('addLocation')
    clean.delete('addLeadId')
    clean.delete('targeted')
    if (isTargeted) {
      clean.set('tab', 'contacts')
      clean.set('segment', 'targeted')
    } else {
      clean.delete('segment')
    }
    navigate(
      { pathname: `/kyi/companies/${companyId}`, search: clean.toString() },
      { replace: true },
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get('addName'), searchParams.get('addLeadId')])

  const handleGeocodeNow = async () => {
    setGeocoding(true)
    setPipelineMessage(null)
    setPipelineError(null)
    setGeocodeBatchProcessed(0)
    setGeocodeBatchDone(0)
    setGeocodeBatchFailed(0)
    setGeocodeBatchSize(leadStats?.needs_geocoding_count ?? 0)
    if (leadStats && leadStats.needs_geocoding_count > 0) {
      const initial = leadStats.needs_geocoding_count
      setGeocodeProgress({
        initial,
        current: initial,
        status: 'running',
      })
      setGeocodeNeedsCount(initial)
    } else {
      setGeocodeProgress(null)
      setGeocodeNeedsCount(null)
    }
    try {
      const res = await triggerGeocodeNow(companyId)
      setPipelineMessage(res.message || 'Geocoding started. Watch the “Need geocoding” count; it updates every few seconds.')
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : 'Failed to start geocoding')
      setGeocodeProgress(null)
    } finally {
      setGeocoding(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !company) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error ?? 'Company not found'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link to="/kyi">Back to Companies</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <MotionPage subtle className="p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* ── Page Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            {company.logo_url ? (
              <img src={company.logo_url} alt="" className="w-11 h-11 rounded-xl object-cover" />
            ) : (
              <Building2 className="w-5 h-5 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-primary/80">
                Know Your Investor
              </p>
              <ModuleHelpButton moduleId="kyi" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight truncate">{company.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 text-sm text-muted-foreground">
              {company.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {company.location}
                </span>
              )}
              {company.location && company.industry && <span className="text-border">|</span>}
              {company.industry && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" />
                  {company.industry}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {leadStats && leadStats.filtered_count > 0 && (
            <Badge variant="outline" className="h-8 gap-1 text-xs font-medium px-2.5 hidden sm:flex">
              <Target className="w-3.5 h-3.5 text-amber-500" />
              {leadStats.filtered_count.toLocaleString()} in radius
            </Badge>
          )}
          <Badge
            variant={targetedInvestorRoster.length > 0 ? 'default' : 'secondary'}
            className="h-8 gap-1.5 text-sm font-medium px-3 cursor-pointer"
            onClick={() => goToCompanyTab('contacts', 'targeted')}
          >
            <Target className="w-3.5 h-3.5" />
            {targetedInvestorRoster.length} targeted
          </Badge>
          <Button asChild variant="outline" size="sm" className="h-8">
            <Link to={`/kyi/ecosystem?companyId=${company.id}`}>
              <Globe className="w-3.5 h-3.5 mr-1.5" />
              Ecosystem
            </Link>
          </Button>
          {surfaceConfig ? (
            <ModuleCustomizeControls
              customizeMode={isCustomizeMode}
              onEnterCustomize={enterCustomize}
              onDone={() => void saveAndExit()}
              dataTourCustomize="kyi-company-customize"
              className="h-8"
            />
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => {
              setKyiImportDefaultTarget('leads')
              setKyiImportOpen(true)
            }}
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Import
          </Button>
          {company.id !== 1 && (
            <>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive h-7 text-xs" onClick={() => setDeleteConfirmOpen(true)}>
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Delete
              </Button>
              <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete company?</AlertDialogTitle>
                    <AlertDialogDescription>
                      All investors for this company will be moved to the Default Company. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleteDeleting}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteCompany}
                      disabled={deleteDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleteDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </motion.div>

      <AlertDialog open={deleteInvestorId != null} onOpenChange={(open) => { if (!open) setDeleteInvestorId(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete investor?</AlertDialogTitle>
            <AlertDialogDescription>
              This investor will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteInvestorDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvestor}
              disabled={deleteInvestorDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInvestorDeleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={addInvestorOpen}
        onOpenChange={(o) => {
          setAddInvestorOpen(o)
          if (!o) {
            setAddInvestorForm(emptyInvestorForm)
            setAddInvestorRole('investor')
            setAddInvestorAdminOverride(false)
            setAddInvestorSegmentType('current_investor')
            setAddInvestorViaOrbit(false)
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add investor</DialogTitle>
            <DialogDescription>
              Add an investor to this company. Full name is required; other fields are optional. Employees must be added from the Employees tab via HR.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="inv-full_name">Full name *</Label>
              <Input
                id="inv-full_name"
                value={addInvestorForm.full_name}
                onChange={(e) => setAddInvestorForm((p) => ({ ...p, full_name: e.target.value }))}
                placeholder="e.g. Jane Smith"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="inv-email">Email</Label>
                <Input
                  id="inv-email"
                  type="email"
                  value={addInvestorForm.email}
                  onChange={(e) => setAddInvestorForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-phone">Phone</Label>
                <Input
                  id="inv-phone"
                  value={addInvestorForm.phone}
                  onChange={(e) => setAddInvestorForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="+1 234 567 8900"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-location">Location</Label>
              <Input
                id="inv-location"
                value={addInvestorForm.location}
                onChange={(e) => setAddInvestorForm((p) => ({ ...p, location: e.target.value }))}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="inv-firm">Firm</Label>
                <Input
                  id="inv-firm"
                  value={addInvestorForm.firm}
                  onChange={(e) => setAddInvestorForm((p) => ({ ...p, firm: e.target.value }))}
                  placeholder="e.g. Acme Capital"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="inv-title">Title</Label>
                <Input
                  id="inv-title"
                  value={addInvestorForm.title}
                  onChange={(e) => setAddInvestorForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="e.g. Partner"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-industry">Industry</Label>
              <Input
                id="inv-industry"
                value={addInvestorForm.industry}
                onChange={(e) => setAddInvestorForm((p) => ({ ...p, industry: e.target.value }))}
                placeholder="e.g. Technology"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-profile_url">Profile URL</Label>
              <Input
                id="inv-profile_url"
                value={addInvestorForm.profile_url}
                onChange={(e) => setAddInvestorForm((p) => ({ ...p, profile_url: e.target.value }))}
                placeholder="https://linkedin.com/in/..."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="inv-notes">Notes</Label>
              <Textarea
                id="inv-notes"
                rows={2}
                value={addInvestorForm.notes}
                onChange={(e) => setAddInvestorForm((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Optional notes"
              />
            </div>
            <div className="grid gap-2">
              <Label>Segment</Label>
              <Select value={addInvestorSegmentType} onValueChange={setAddInvestorSegmentType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="current_investor">Current investor</SelectItem>
                  <SelectItem value="targeted_investor">Targeted investor</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="geo_target">Geo target</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>User role classification</Label>
              <Select
                value={addInvestorRole}
                onValueChange={(v) => setAddInvestorRole(v as 'employee' | 'investor')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Investor requires Orbit or admin override when email matches an active HR employee.
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Admin override</p>
                <p className="text-xs text-muted-foreground">Allow investor classification despite rules above.</p>
              </div>
              <Switch checked={addInvestorAdminOverride} onCheckedChange={setAddInvestorAdminOverride} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddInvestorOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddInvestor}
              disabled={!addInvestorForm.full_name.trim() || addInvestorSaving}
            >
              {addInvestorSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add investor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddEmployeeFromHrDialog
        open={addEmployeeFromHrOpen}
        onOpenChange={setAddEmployeeFromHrOpen}
        companyId={companyId}
        companyEmployees={employeeRoster}
        onAdded={fetchInvestors}
      />

      <KyiImportDialog
        open={kyiImportOpen}
        onOpenChange={setKyiImportOpen}
        companyId={companyId}
        defaultTarget={kyiImportDefaultTarget}
        onImported={() => {
          fetchInvestors()
          void loadLeads()
        }}
      />

      <Tabs
        value={initialTab}
        onValueChange={(tab) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', tab); return next }, { replace: true })}
        className="space-y-5"
      >
        <KyiCompanyNav targetedCount={targetedInvestorRoster.length} />
        <TabsContent value="overview">
          {customizeChrome}
          {tabLayout ? (
            <KyiOverviewTab
              layout={tabLayout}
              company={company}
              companyId={companyId}
              investors={investors}
              geo={geo}
              leadStats={leadStats}
              leadsLoading={leadsLoading}
              overviewGeoCoveragePct={overviewGeoCoveragePct}
              raiseSummary={raiseSummary}
              employeeRoster={employeeRoster}
              personalNetworkRoster={personalNetworkRoster}
              currentInvestorRoster={currentInvestorRoster}
              targetedInvestorRoster={targetedInvestorRoster}
              networkContributedCount={networkContributedCount}
              ecosystemMatches={ecosystemMatches}
              ecosystemMatchesLoading={ecosystemMatchesLoading}
              raiseForm={raiseForm}
              setRaiseForm={setRaiseForm}
              raiseSaving={raiseSaving}
              setRaiseSaving={setRaiseSaving}
              typeProfileOptions={typeProfileOptions}
              investorTypeMix={investorTypeMix}
              investorsWithStrategyNotes={investorsWithStrategyNotes}
              notesHistory={notesHistory}
              notesSearch={notesSearch}
              setNotesSearch={setNotesSearch}
              goToCompanyTab={goToCompanyTab}
              onOpenImportNetwork={() => {
                setKyiImportDefaultTarget('personal_network')
                setKyiImportOpen(true)
              }}
              onLoadLeads={() => void loadLeads()}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="contacts">
          {customizeChrome}
          {tabLayout ? (
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'contacts_workspace') {
                  return (
                    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                      Unknown widget
                    </div>
                  )
                }
                return (
                  <div className="h-full overflow-hidden">
                    <KyiContactsTabContent
                      segment={contactSegment}
                      onSegmentChange={setContactSegment}
                      companyId={companyId}
                      companyName={company?.name ?? 'company'}
                      counts={{
                        employees: employeeRoster.length,
                        network: personalNetworkRoster.length,
                        current: currentInvestorRoster.length,
                        targeted: targetedInvestorRoster.length,
                      }}
                      employeeRoster={employeeRoster}
                      filteredEmployees={filteredEmployees}
                      currentInvestorRoster={currentInvestorRoster}
                      personalNetworkRoster={personalNetworkRoster}
                      targetedInvestorRoster={targetedInvestorRoster}
                      investorSegment={investorSegment}
                      onInvestorSegmentChange={setInvestorSegment}
                      onImport={() => {
                        setKyiImportDefaultTarget('investors')
                        setKyiImportOpen(true)
                      }}
                      onUploadNetwork={() => {
                        setKyiImportDefaultTarget('personal_network')
                        setKyiImportOpen(true)
                      }}
                      onAddEmployee={() => setAddEmployeeFromHrOpen(true)}
                      onAddCurrentInvestor={() => {
                        setAddInvestorRole('investor')
                        setAddInvestorSegmentType('current_investor')
                        setAddInvestorAdminOverride(true)
                        setAddInvestorOpen(true)
                      }}
                      onAddTargetedInvestor={() => {
                        setAddInvestorRole('investor')
                        setAddInvestorSegmentType('targeted_investor')
                        setAddInvestorAdminOverride(true)
                        setAddInvestorViaOrbit(false)
                        setAddInvestorOpen(true)
                      }}
                      onDeleteInvestor={setDeleteInvestorId}
                      onInvestorUpdated={() => {
                        fetchInvestors()
                        refreshRaiseSummary()
                      }}
                      onViewLead={(leadId) => setLeadDrawerId(leadId)}
                    />
                  </div>
                )
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="leads">
          {customizeChrome}
          {tabLayout ? (
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'leads_workspace') {
                  return (
                    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                      Unknown widget
                    </div>
                  )
                }
                return (
                  <Card className="h-full overflow-hidden">
                <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg">Localized leads</CardTitle>
                    <CardDescription>
                      Applicable investors from public records in your geo radius — add promising leads to your targeted list.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {!geo?.settings && (
                      <Button variant="outline" size="sm" onClick={() => goToCompanyTab('geo')}>
                        Set geo first
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!company || !geo?.settings}
                      onClick={() => {
                        if (!company) return
                        void exportLocalizedLeadsCsvFromApi(companyId, company.name, {
                          thinning: 'all',
                          min_score: leadsFilters.minScore,
                          dataCategorySlug: leadsFilters.categorySlug.trim() || null,
                          fuzzyDedup: leadsFilters.fuzzyDedup,
                          filterPresets: filterPresets.size > 0 ? [...filterPresets] : undefined,
                        })
                      }}
                      title="Exports all geo-filtered leads (not only the thinned visible list)"
                    >
                      <Download className="w-4 h-4 mr-1.5" />
                      Export all in radius
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setKyiImportDefaultTarget('leads')
                        setKyiImportOpen(true)
                      }}
                    >
                      <Upload className="w-4 h-4 mr-1.5" />
                      Import leads
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => goToCompanyTab('accessmap')}>
                      Access Map
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {geo?.settings ? (
                    <p className="text-sm text-muted-foreground">
                      Within{' '}
                      <span className="font-medium text-foreground">
                        {Math.round(geo.settings.radius_miles)} mi
                      </span>{' '}
                      of <span className="font-medium text-foreground">{geo.settings.location_label}</span>
                      {leadStats && (
                        <>
                          {' '}
                          —{' '}
                          <span className="tabular-nums">
                            {leadStats.filtered_count.toLocaleString()} in radius
                          </span>
                          {leadStats.needs_geocoding_count > 0 && (
                            <span className="text-amber-600">
                              {' '}
                              · {leadStats.needs_geocoding_count.toLocaleString()} need geocoding
                            </span>
                          )}
                        </>
                      )}
                    </p>
                  ) : (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
                      Geo targeting is required before leads can be filtered to your raise market.{' '}
                      <button type="button" className="font-medium underline" onClick={() => goToCompanyTab('geo')}>
                        Configure geo targeting
                      </button>
                    </div>
                  )}
                  {leadStats && leads && (
                    <p className="text-xs text-muted-foreground">
                      Showing{' '}
                      <span className="font-medium text-foreground tabular-nums">
                        {signalFilters.size > 0 ? filteredLeadsCount : leadStats.displayed_count}
                      </span>
                      {signalFilters.size > 0 ? ` of ${leads.length} loaded` : ''} leads
                      {signalFilters.size > 0 ? ' (signal filters active)' : ''}
                    </p>
                  )}
                  {leadStats && leads && leads.length > 0 && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium text-foreground">In-radius source breakdown</p>
                        <p className="text-[11px] text-muted-foreground">{leads.length.toLocaleString()} leads loaded</p>
                      </div>
                      {inRadiusSourceBreakdown.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {inRadiusSourceBreakdown.map((item) => (
                            <Badge key={item.source} variant="outline" className="text-[11px]">
                              {item.source} ({item.count})
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          No source metadata found on the currently loaded leads.
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Show</label>
                      <select
                        className="border border-border rounded-md bg-background px-2 py-1 text-sm"
                        value={leadsFilters.thinning}
                        onChange={(e) =>
                          setLeadsFilters((prev) => ({ ...prev, thinning: e.target.value }))
                        }
                      >
                        <option value="top_10_percent">Top 10%</option>
                        <option value="top_25_percent">Top 25%</option>
                        <option value="top_50_percent">Top 50%</option>
                        <option value="all">All</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Min score</label>
                      <input
                        type="number"
                        className="border border-border rounded-md bg-background px-2 py-1 text-sm w-24"
                        value={leadsFilters.minScore ?? ''}
                        onChange={(e) =>
                          setLeadsFilters((prev) => ({
                            ...prev,
                            minScore: e.target.value ? Number(e.target.value) : null,
                          }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-muted-foreground">Category slug</label>
                      <input
                        type="text"
                        className="border border-border rounded-md bg-background px-2 py-1 text-sm w-36"
                        placeholder="e.g. swing"
                        value={leadsFilters.categorySlug}
                        onChange={(e) =>
                          setLeadsFilters((prev) => ({ ...prev, categorySlug: e.target.value }))
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={leadsFilters.fuzzyDedup}
                        onChange={(e) =>
                          setLeadsFilters((prev) => ({ ...prev, fuzzyDedup: e.target.checked }))
                        }
                      />
                      Fuzzy dedupe
                    </label>
                    {leadsLoading && (
                      <span className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Updating…
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-muted-foreground w-full sm:w-auto">Presets</span>
                    {(Object.keys(KYI_LEAD_FILTER_PRESETS) as KyiLeadFilterPresetId[]).map((id) => (
                      <Button
                        key={id}
                        type="button"
                        size="sm"
                        variant={filterPresets.has(id) ? 'default' : 'outline'}
                        className="h-7 text-xs"
                        onClick={() =>
                          setFilterPresets((prev) => {
                            const next = new Set(prev)
                            if (next.has(id)) next.delete(id)
                            else next.add(id)
                            return next
                          })
                        }
                      >
                        {KYI_LEAD_FILTER_PRESETS[id].label}
                      </Button>
                    ))}
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer ml-2">
                      <input
                        type="checkbox"
                        checked={sectorRelevantOnly}
                        onChange={(e) => setSectorRelevantOnly(e.target.checked)}
                      />
                      Relevant to our sector
                    </label>
                  </div>
                  <SignalFilter
                    selectedSignals={signalFilters}
                    availableSignals={visibleFilterKeys}
                    options={signalFilterOptions}
                    onToggle={(sig) => {
                      setSignalFilters((prev) => {
                        const next = new Set(prev)
                        if (next.has(sig)) next.delete(sig)
                        else next.add(sig)
                        return next
                      })
                    }}
                    onClear={() => setSignalFilters(new Set())}
                  />
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGeocodeNow}
                      disabled={geocoding}
                    >
                      {geocoding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Geocode now
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefreshNow}
                      disabled={refreshing}
                    >
                      {refreshing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Refresh now
                    </Button>
                  </div>
                  {(geocodeProgress?.initial ?? 0) > 0 || geocodeBatchSize > 0 ? (
                    <div className="mt-2 p-3 rounded-lg border border-border bg-muted/30 space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Geocoding leads
                          {(geocodeProgress?.status ?? '') === 'done' ? ' complete' : ' in progress'}
                        </span>
                        <span className="font-medium text-foreground">
                          {geocodeBatchSize > 0
                            ? `${geocodeBatchProcessed} / ${geocodeBatchSize} processed, ${geocodeBatchDone} saved`
                            : geocodeProgress
                              ? `${Math.max(0, geocodeProgress.initial - (geocodeNeedsCount ?? geocodeProgress.current))} / ${geocodeProgress.initial} geocoded`
                              : '—'}
                        </span>
                      </div>
                      <Progress
                        value={
                          geocodeBatchSize > 0
                            ? Math.min(100, (geocodeBatchProcessed / geocodeBatchSize) * 100)
                            : geocodeProgress && geocodeProgress.initial > 0
                              ? ((geocodeProgress.initial - (geocodeNeedsCount ?? geocodeProgress.current)) / geocodeProgress.initial) * 100
                              : 0
                        }
                      />
                      {geocodeBatchFailed > 0 && (
                        <p className="text-xs text-red-400">
                          {geocodeBatchFailed} DB write{geocodeBatchFailed !== 1 ? 's' : ''} failed (check database permissions on kyi_investor_leads)
                        </p>
                      )}
                      {geocodeBatchUnresolvable > 0 && (
                        <p className="text-xs text-yellow-400">
                          {geocodeBatchUnresolvable} lead{geocodeBatchUnresolvable !== 1 ? 's' : ''} could not be resolved (city/state not recognized by geocoding API)
                        </p>
                      )}
                      {(geocodeProgress?.status ?? '') !== 'done' && geocodeBatchSize > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {geocodeBatchSize - geocodeBatchProcessed} remaining.
                        </p>
                      )}
                    </div>
                  ) : null}
                  {pipelineMessage && (
                    <p className="text-xs text-emerald-500">{pipelineMessage}</p>
                  )}
                  {pipelineError && <p className="text-xs text-red-500">{pipelineError}</p>}
                  {leadsError && <p className="text-sm text-red-500">{leadsError}</p>}
                  {!leadsLoading && !leadsError && !geo?.settings && (
                    <p className="text-muted-foreground py-6 text-center">
                      Set geo targeting to see leads in your raise market.
                    </p>
                  )}
                  {!leadsLoading && !leadsError && geo?.settings && leads && leads.length === 0 && (
                    <p className="text-muted-foreground py-6 text-center">
                      No leads found for the current filters. Try widening the radius or lowering
                      the minimum score.
                    </p>
                  )}
                  {leadsLoading ? (
                    <div className="py-8 flex items-center justify-center">
                      <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : leads && leads.length > 0 ? (
                    <div className="space-y-6">
                      {leadsByState.map(({ state, items }) => (
                        <div key={state}>
                          <p className="text-sm font-semibold text-foreground mb-2">{state}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {items.map((lead, i) => (
                              <motion.div key={lead.id} custom={i + 5} variants={fadeUp}>
                                <Card
                                  className="border-border hover:bg-card/80 transition-colors h-full flex flex-col cursor-pointer"
                                  onClick={() => setLeadDrawerId(lead.id)}
                                >
                                  <CardContent className="pt-4 space-y-2 flex-1 flex flex-col">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <p className="font-medium">{lead.display_name}</p>
                                        <p className="text-xs text-muted-foreground">{lead.entity_type}</p>
                                        {warmPaths.get(lead.id)?.pathDepth ? (
                                          <p className="text-xs text-emerald-600 mt-0.5">
                                            Warm
                                            {warmPaths.get(lead.id)?.introInvestorName
                                              ? ` via ${warmPaths.get(lead.id)!.introInvestorName}`
                                              : ''}
                                          </p>
                                        ) : null}
                                      </div>
                                      <p className="font-semibold text-primary text-sm tabular-nums">
                                        {lead.fit_percent}%
                                      </p>
                                    </div>
                                    {(lead.city || lead.state) && (
                                      <p className="text-xs text-muted-foreground">
                                        {lead.city}
                                        {lead.city && lead.state ? ', ' : ''}
                                        {lead.state}
                                      </p>
                                    )}
                                    {lead.tags && lead.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {lead.tags.map((t) => (
                                          <Badge key={t} variant="outline" className="text-xs">
                                            {t.replace(/_/g, ' ')}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    {getLeadSourceNames(lead).length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {getLeadSourceNames(lead).slice(0, 4).map((name) => (
                                          <Badge key={name} variant="secondary" className="text-[10px]">
                                            {name}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full mt-auto h-8 text-xs"
                                      asChild
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Link
                                        to={buildTargetedInvestorAddUrl(
                                          companyId,
                                          lead.display_name,
                                          [lead.city, lead.state].filter(Boolean).join(', ') || undefined,
                                          lead.id,
                                        )}
                                      >
                                        <UserPlus className="w-3.5 h-3.5 mr-1.5" />
                                        Add to targeted
                                      </Link>
                                    </Button>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
                )
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="geo">
          {customizeChrome}
          {tabLayout ? (
            <ModuleWidgetCanvas
              widgets={tabLayout.widgets}
              catalog={tabLayout.catalog}
              customizeMode={tabLayout.customizeMode}
              onLayoutChange={tabLayout.onLayoutChange}
              onRemoveWidget={tabLayout.onRemoveWidget}
              rowHeight={36}
              renderWidget={(widgetId) => {
                if (widgetId !== 'geo_workspace') {
                  return (
                    <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
                      Unknown widget
                    </div>
                  )
                }
                return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg">Geo targeting</CardTitle>
                  <CardDescription>
                    Set where this raise is focused. Localized leads and Access Map suggestions use this radius.
                    Investor profiles can have separate geo for individual orbit searches.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {geoError && <p className="text-sm text-red-500">{geoError}</p>}
                  <motion.div custom={0} variants={fadeUp} className="space-y-2">
                    <label className="text-sm text-muted-foreground font-medium">Company target location</label>
                    <input
                      type="text"
                      className="border border-border rounded-md bg-background px-3 py-2 text-sm w-full"
                      placeholder="e.g., Austin, TX or 123 Main St, Denver, CO"
                      value={geoForm.location_label}
                      onChange={(e) =>
                        setGeoForm((prev) => ({ ...prev, location_label: e.target.value }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a city/state or full address. KYI will geocode it and filter leads by
                      distance.
                    </p>
                  </motion.div>
                  <motion.div custom={1} variants={fadeUp} className="space-y-2">
                    <label className="text-sm text-muted-foreground font-medium">Preset level</label>
                    <Select
                      value={geoForm.geo_segment_level}
                      onValueChange={(v) =>
                        setGeoForm((prev) => ({
                          ...prev,
                          geo_segment_level: v,
                          radius_miles: GEO_LEVEL_TO_MILES[v] ?? prev.radius_miles,
                        }))
                      }
                    >
                      <SelectTrigger className="max-w-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local (~{GEO_LEVEL_TO_MILES.local} mi)</SelectItem>
                        <SelectItem value="regional">Regional (~{GEO_LEVEL_TO_MILES.regional} mi)</SelectItem>
                        <SelectItem value="national">National (~{GEO_LEVEL_TO_MILES.national} mi)</SelectItem>
                      </SelectContent>
                    </Select>
                  </motion.div>
                  <motion.div custom={2} variants={fadeUp} className="space-y-2">
                    <label className="text-sm text-muted-foreground font-medium">Radius (miles)</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={5}
                        max={250}
                        step={5}
                        value={geoForm.radius_miles}
                        onChange={(e) =>
                          setGeoForm((prev) => ({
                            ...prev,
                            radius_miles: Number(e.target.value),
                          }))
                        }
                        className="flex-1"
                      />
                      <span className="text-base font-semibold w-16 text-right tabular-nums">
                        {Math.round(geoForm.radius_miles)} mi
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Recommended: 25–100 miles. Leads outside this radius are filtered out.
                    </p>
                  </motion.div>
                  <motion.div custom={3} variants={fadeUp} className="flex flex-wrap items-center gap-2">
                    <Button size="sm" onClick={handleSaveGeo} disabled={geoSaving}>
                      {geoSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Save settings
                    </Button>
                    {geo?.settings && leadStats && (
                      <Button variant="outline" size="sm" onClick={() => goToCompanyTab('leads')}>
                        Review {leadStats.filtered_count.toLocaleString()} leads in radius
                      </Button>
                    )}
                    {leadStats && leadStats.needs_geocoding_count > 0 && (
                      <Button variant="outline" size="sm" onClick={handleGeocodeNow} disabled={geocoding}>
                        {geocoding && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Geocode {leadStats.needs_geocoding_count.toLocaleString()} leads
                      </Button>
                    )}
                  </motion.div>
                  {geo?.settings && (
                    <motion.div custom={4} variants={fadeUp} className="mt-4 rounded-xl border border-border p-4 text-sm text-muted-foreground space-y-2">
                      <p className="font-semibold text-foreground">Active targeting</p>
                      <p>
                        <span className="font-medium">Location:</span> {geo.settings.location_label}
                      </p>
                      <p>
                        <span className="font-medium">Radius:</span> {Math.round(geo.settings.radius_miles)} miles (
                        {geo.settings.geo_segment_level ?? 'local'})
                      </p>
                      {leadStats && (
                        <p>
                          <span className="font-medium">Leads in radius:</span>{' '}
                          <span className="text-foreground font-semibold tabular-nums">
                            {leadStats.filtered_count.toLocaleString()}
                          </span>
                          {' '}
                          of {leadStats.total_count.toLocaleString()} in pool
                        </p>
                      )}
                    </motion.div>
                  )}
                  <motion.div custom={5} variants={fadeUp} className="space-y-3 pt-2 border-t">
                    <p className="text-sm font-medium text-foreground">Additional markets</p>
                    <p className="text-xs text-muted-foreground">
                      Save the primary location above, then add other cities for roadshows. Leads match any active market.
                    </p>
                    {geoTargets.length > 0 ? (
                      <ul className="space-y-2">
                        {geoTargets.map((t) => (
                          <li
                            key={t.id}
                            className="flex items-center justify-between gap-2 text-sm rounded-lg border px-3 py-2"
                          >
                            <span>
                              {t.location_label}{' '}
                              <span className="text-muted-foreground">
                                ({Math.round(t.radius_miles)} mi)
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive h-8"
                              onClick={async () => {
                                try {
                                  await deleteCompanyGeoTarget(t.id)
                                  setGeoTargets((prev) => prev.filter((x) => x.id !== t.id))
                                  void loadLeads()
                                  toast.success('Market removed')
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : 'Remove failed')
                                }
                              }}
                            >
                              Remove
                            </Button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No extra markets yet. Primary geo above is used when the list is empty.
                      </p>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!geo?.settings}
                      onClick={async () => {
                        const label = window.prompt('Additional market (city, state)', '')
                        if (!label?.trim() || !geo?.settings) return
                        try {
                          const added = await addCompanyGeoTargetFromLabel(
                            companyId,
                            label.trim(),
                            geoForm.radius_miles,
                            geoTargets.length + 1,
                          )
                          setGeoTargets((prev) => [...prev, added])
                          void loadLeads()
                          toast.success('Market added')
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : 'Could not add market')
                        }
                      }}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Add market from location
                    </Button>
                  </motion.div>
                </CardContent>
              </Card>
                )
              }}
            />
          ) : null}
        </TabsContent>
        <TabsContent value="accessmap" className="flex flex-col min-h-0 data-[state=inactive]:hidden">
          {initialTab === 'accessmap' && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] }}
              className="flex flex-1 flex-col min-h-[calc(100dvh-11rem)]"
            >
              <AccessMapPage
                companyId={companyId}
                companyName={company.name}
                title="Access Map"
              />
            </motion.div>
          )}
        </TabsContent>
        <TabsContent value="northstar">
          {customizeChrome}
          <KyiNorthstarTab
            companyId={companyId}
            companyName={company.name}
            company={company}
            refreshKey={investors.length}
            layout={tabLayout}
            onImport={() => {
              setKyiImportDefaultTarget('northstar')
              setKyiImportOpen(true)
            }}
            onAddInvestor={() => {
              setAddInvestorRole('investor')
              setAddInvestorSegmentType('targeted_investor')
              setAddInvestorAdminOverride(true)
              setAddInvestorViaOrbit(false)
              setAddInvestorOpen(true)
            }}
          />
        </TabsContent>
      </Tabs>

      <KyiLeadDetailDrawer
        open={leadDrawerId != null}
        onOpenChange={(open) => {
          if (!open) setLeadDrawerId(null)
        }}
        companyId={companyId}
        leadId={leadDrawerId}
        onPromoted={() => {
          fetchInvestors()
          refreshRaiseSummary()
        }}
      />
    </MotionPage>
  )
}
