import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Users,
  LineChart,
  Loader2,
  MapPin,
  Briefcase,
  Globe,
  User,
  Mail,
  Phone,
  FileText,
  Search,
  Clock,
  TrendingUp,
  Target,
  ArrowRight,
  Upload,
  ChevronRight,
  UserPlus,
  Network,
  Globe2,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import type { KyiContactSegment } from '@/components/kyi/KyiCompanyNav'
import type { KyiTabLayoutProps } from '@/lib/kyi/kyi-widget-layout'
import { updateCompanyRaiseProfile, type GeoSettingsResponse, type KYICompanyDetail, type KYIInvestor, type KYINotesHistoryEntry, type KyiCompanyRaiseSummary } from '@/lib/kyi-api'
import type { KYIGlobalInvestor } from '@/lib/kyi-ecosystem'
import { toast } from 'sonner'
import type { Dispatch, SetStateAction } from 'react'

export interface KyiOverviewTabProps {
  layout: KyiTabLayoutProps
  company: KYICompanyDetail
  companyId: number
  investors: KYIInvestor[]
  geo: GeoSettingsResponse | null
  leadStats: {
    total_count: number
    filtered_count: number
    displayed_count: number
    needs_geocoding_count: number
  } | null
  leadsLoading: boolean
  overviewGeoCoveragePct: number | null
  raiseSummary: KyiCompanyRaiseSummary | null
  employeeRoster: KYIInvestor[]
  personalNetworkRoster: KYIInvestor[]
  currentInvestorRoster: KYIInvestor[]
  targetedInvestorRoster: KYIInvestor[]
  networkContributedCount: number
  ecosystemMatches: Array<KYIGlobalInvestor & { match_score: number; match_reasons: string[] }>
  ecosystemMatchesLoading: boolean
  raiseForm: {
    raise_stage: string
    raise_target_amount: string
    sector_tags: string
    preferred_investor_types: string[]
  }
  setRaiseForm: Dispatch<SetStateAction<{
    raise_stage: string
    raise_target_amount: string
    sector_tags: string
    preferred_investor_types: string[]
  }>>
  raiseSaving: boolean
  setRaiseSaving: (v: boolean) => void
  typeProfileOptions: string[]
  investorTypeMix: [string, number][]
  investorsWithStrategyNotes: number
  notesHistory: KYINotesHistoryEntry[]
  notesSearch: string
  setNotesSearch: (v: string) => void
  goToCompanyTab: (tab: string, segment?: KyiContactSegment) => void
  onOpenImportNetwork: () => void
  onLoadLeads: () => void
}

export function KyiOverviewTab({
  layout,
  company,
  companyId,
  investors,
  geo,
  leadStats,
  leadsLoading,
  overviewGeoCoveragePct,
  raiseSummary,
  employeeRoster,
  personalNetworkRoster,
  currentInvestorRoster,
  targetedInvestorRoster,
  networkContributedCount,
  ecosystemMatches,
  ecosystemMatchesLoading,
  raiseForm,
  setRaiseForm,
  raiseSaving,
  setRaiseSaving,
  typeProfileOptions,
  investorTypeMix,
  investorsWithStrategyNotes,
  notesHistory,
  notesSearch,
  setNotesSearch,
  goToCompanyTab,
  onOpenImportNetwork,
  onLoadLeads,
}: KyiOverviewTabProps) {
  return (
    <ModuleWidgetCanvas
      widgets={layout.widgets}
      catalog={layout.catalog}
      customizeMode={layout.customizeMode}
      onLayoutChange={layout.onLayoutChange}
      onRemoveWidget={layout.onRemoveWidget}
      rowHeight={36}
      renderWidget={(widgetId): ReactNode => {
    if (widgetId === 'cap_raise_snapshot') {
      return (
        <div className="h-full rounded-xl border bg-card/50 overflow-hidden">
        <div className="p-5 md:p-6 border-b bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="space-y-1.5 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Cap raise overview</p>
              <h2 className="text-lg font-semibold tracking-tight">Investor discovery at a glance</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                KYI narrows public investor records to your geography and team network so you spend less time
                hunting leads and more time on warm outreach during your raise.
              </p>
            </div>
            <Badge
              variant={geo?.configured ? 'default' : 'outline'}
              className="w-fit shrink-0 text-xs font-medium"
            >
              {geo?.configured ? 'Geo targeting active' : 'Set geo targeting to unlock local leads'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-border">
          {[
            {
              label: 'Employees',
              value: employeeRoster.length,
              icon: Users,
              color: 'text-blue-400',
              hint: 'Team for warm intros',
              tab: 'contacts',
              contactSegment: 'employees' as KyiContactSegment,
            },
            {
              label: 'Lead pool',
              value: leadsLoading ? '…' : (leadStats?.total_count ?? '—'),
              icon: LineChart,
              color: 'text-emerald-400',
              hint: 'Platform investor records',
              tab: 'leads',
            },
            {
              label: 'In geo radius',
              value: leadsLoading ? '…' : (leadStats?.filtered_count ?? '—'),
              icon: Target,
              color: 'text-amber-400',
              hint: geo?.settings?.location_label
                ? `Near ${geo.settings.location_label}`
                : 'After your targeting',
              tab: 'geo',
            },
            {
              label: 'Need geocoding',
              value: leadsLoading ? '…' : (leadStats?.needs_geocoding_count ?? '—'),
              icon: MapPin,
              color: 'text-rose-400',
              hint: 'Missing coordinates',
              tab: 'leads',
            },
          ].map((stat) => (
            <button
              key={stat.label}
              type="button"
              onClick={() =>
                goToCompanyTab(
                  stat.tab,
                  'contactSegment' in stat ? stat.contactSegment : undefined,
                )
              }
              className="group flex flex-col gap-2 p-5 md:p-6 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </span>
                <stat.icon
                  className={`w-4 h-4 ${stat.color} opacity-60 group-hover:opacity-100 transition-opacity shrink-0`}
                />
              </div>
              <p className="text-3xl font-bold tabular-nums tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground leading-snug">{stat.hint}</p>
            </button>
          ))}
        </div>

        <div className="px-5 md:px-6 py-4 border-t bg-muted/20 space-y-3">
          {leadStats && leadStats.total_count > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Leads in your radius vs. full pool</span>
                <span className="tabular-nums font-medium text-foreground">
                  {leadStats.filtered_count.toLocaleString()} / {leadStats.total_count.toLocaleString()}
                  {overviewGeoCoveragePct != null && (
                    <span className="text-muted-foreground font-normal ml-2">
                      · {overviewGeoCoveragePct}% geocoded
                    </span>
                  )}
                </span>
              </div>
              <Progress
                value={Math.min(100, (leadStats.filtered_count / leadStats.total_count) * 100)}
                className="h-1.5"
              />
            </div>
          )}
          {raiseSummary?.last_lead_import_at && (
            <p className="text-xs text-muted-foreground">
              Lead data last updated{' '}
              {new Date(raiseSummary.last_lead_import_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
          {raiseSummary && raiseSummary.targeted_total > 0 && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span>
                Targeted: <span className="text-foreground font-medium">{raiseSummary.targeted_total}</span>
              </span>
              <span>
                New: {raiseSummary.outreach_by_status.new} · Contacted:{' '}
                {raiseSummary.outreach_by_status.contacted} · Meeting:{' '}
                {raiseSummary.outreach_by_status.meeting}
              </span>
              {raiseSummary.stale_outreach > 0 && (
                <span className="text-amber-600">{raiseSummary.stale_outreach} stale (14d+)</span>
              )}
              {raiseSummary.warm_path_lead_count > 0 && (
                <span className="text-emerald-600">
                  ~{raiseSummary.warm_path_lead_count} leads with warm paths
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8" onClick={() => goToCompanyTab('geo')}>
              Geo targeting
              <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-60" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => goToCompanyTab('leads')}>
              Localized leads
              <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-60" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => goToCompanyTab('contacts', 'employees')}>
              Contacts
              <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-60" />
            </Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => goToCompanyTab('accessmap')}>
              Access Map
              <ChevronRight className="w-3.5 h-3.5 ml-1 opacity-60" />
            </Button>
          </div>
        </div>
        </div>
      )
    }

    if (widgetId === 'grow_network') {
      return (
        <div className="h-full grid gap-4 md:grid-cols-2 overflow-hidden">
        {/* Upload my network */}
        <div className="group relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-blue-500/[0.08] via-card/40 to-transparent p-6 flex flex-col">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-colors" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
                <Network className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight">Your personal network</h3>
                <p className="text-xs text-muted-foreground">Private warm paths for your raise</p>
              </div>
            </div>
            {personalNetworkRoster.length > 0 && (
              <span className="shrink-0 rounded-full bg-blue-500/15 text-blue-300 text-xs font-semibold tabular-nums px-2.5 py-1">
                {personalNetworkRoster.length}
              </span>
            )}
          </div>
          <p className="relative text-sm text-muted-foreground leading-relaxed mt-4 flex-1">
            Upload the people you already know — from a LinkedIn export or your CRM. They stay
            private to your team and power warm-intro matching against every lead.
          </p>
          {networkContributedCount > 0 && (
            <p className="relative flex items-center gap-1.5 text-xs text-emerald-400 mt-3">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              {networkContributedCount} shared to the investor ecosystem
            </p>
          )}
          <div className="relative flex flex-wrap items-center gap-2 mt-5">
            <Button
              size="sm"
              onClick={onOpenImportNetwork}
            >
              <Upload className="w-4 h-4 mr-1.5" />
              Upload my network
            </Button>
            {personalNetworkRoster.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => goToCompanyTab('contacts', 'network')}
              >
                View {personalNetworkRoster.length} connection{personalNetworkRoster.length === 1 ? '' : 's'}
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Shared investor ecosystem */}
        <div className="group relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-card/40 to-transparent p-6 flex flex-col">
          <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-primary/10 blur-2xl group-hover:bg-primary/20 transition-colors" />
          <div className="relative flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <Globe2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold tracking-tight">Shared investor ecosystem</h3>
              <p className="text-xs text-muted-foreground">Discover across the whole platform</p>
            </div>
          </div>
          <p className="relative text-sm text-muted-foreground leading-relaxed mt-4 flex-1">
            Search a directory of investors contributed across Katana. Add anyone to this raise
            without duplicating records — your notes and pipeline stay private to your org.
          </p>
          <div className="relative flex flex-wrap items-center gap-2 mt-5">
            <Button asChild size="sm">
              <Link to={`/kyi/ecosystem?companyId=${company.id}`}>
                <Globe2 className="w-4 h-4 mr-1.5" />
                Browse ecosystem
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link to={`/kyi/ecosystem?companyId=${company.id}`}>
                Find investors
                <ArrowUpRight className="w-3.5 h-3.5 ml-0.5" />
              </Link>
            </Button>
          </div>
        </div>
        </div>
      )
    }

    if (widgetId === 'ecosystem_matches') {
      return (
        <div className="h-full rounded-xl border bg-card/50 overflow-hidden">
        <div className="p-5 md:p-6 border-b flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Best matches for this raise
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Ranked from the shared ecosystem using your raise profile, categories, and
              platform coverage — without exposing other orgs&apos; private pipeline.
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to={`/kyi/ecosystem?companyId=${company.id}`}>
              Browse all
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </Button>
          <Button asChild size="sm" className="shrink-0">
            <Link to={`/kyi/intel?companyId=${company.id}`}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />
              Raise intel Q&amp;A
            </Link>
          </Button>
        </div>
        <div className="p-5 md:p-6">
          {ecosystemMatchesLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Finding matches…
            </div>
          ) : ecosystemMatches.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Set your raise profile (stage / sectors) or contribute investors to the ecosystem
              to unlock smarter matches.
            </p>
          ) : (
            <ul className="space-y-3">
              {ecosystemMatches.map((m) => (
                <li
                  key={m.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-border/80 p-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      to={`/kyi/ecosystem/${m.id}?companyId=${company.id}`}
                      className="font-medium hover:text-primary truncate block"
                    >
                      {m.display_name}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {[m.title, m.firm].filter(Boolean).join(' · ') || m.location || 'Shared profile'}
                    </p>
                    {m.match_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {m.match_reasons.slice(0, 3).map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                            {r}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      score {m.match_score}
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/kyi/ecosystem/${m.id}?companyId=${company.id}`}>View</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        </div>
      )
    }

    if (widgetId === 'raise_profile') {
      return (
        <div className="h-full rounded-xl border bg-card/50 p-5 space-y-4 overflow-hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Raise profile</p>
          <p className="text-sm text-muted-foreground mt-1">
            Tailors lead scoring and sector relevance for this cap raise.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Stage</label>
            <select
              className="border border-border rounded-md bg-background px-2 py-1.5 text-sm w-full"
              value={raiseForm.raise_stage}
              onChange={(e) => setRaiseForm((p) => ({ ...p, raise_stage: e.target.value }))}
            >
              <option value="">Not set</option>
              <option value="pre_seed">Pre-seed</option>
              <option value="seed">Seed</option>
              <option value="series_a">Series A</option>
              <option value="series_b">Series B+</option>
              <option value="growth">Growth</option>
              <option value="debt">Debt / alternative</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Target amount (optional)</label>
            <input
              type="number"
              className="border border-border rounded-md bg-background px-2 py-1.5 text-sm w-full"
              value={raiseForm.raise_target_amount}
              onChange={(e) => setRaiseForm((p) => ({ ...p, raise_target_amount: e.target.value }))}
              placeholder="e.g. 5000000"
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs text-muted-foreground">Sector tags (comma-separated)</label>
            <input
              type="text"
              className="border border-border rounded-md bg-background px-2 py-1.5 text-sm w-full"
              value={raiseForm.sector_tags}
              onChange={(e) => setRaiseForm((p) => ({ ...p, sector_tags: e.target.value }))}
              placeholder={company.industry ?? 'e.g. fintech, healthcare'}
            />
          </div>
        </div>
        {typeProfileOptions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {typeProfileOptions.map((t) => {
              const on = raiseForm.preferred_investor_types.includes(t)
              return (
                <Button
                  key={t}
                  type="button"
                  size="sm"
                  variant={on ? 'default' : 'outline'}
                  className="h-7 text-xs"
                  onClick={() =>
                    setRaiseForm((p) => ({
                      ...p,
                      preferred_investor_types: on
                        ? p.preferred_investor_types.filter((x) => x !== t)
                        : [...p.preferred_investor_types, t],
                    }))
                  }
                >
                  {t}
                </Button>
              )
            })}
          </div>
        )}
        <Button
          size="sm"
          disabled={raiseSaving}
          onClick={async () => {
            setRaiseSaving(true)
            try {
              await updateCompanyRaiseProfile(companyId, {
                raise_stage: raiseForm.raise_stage || null,
                raise_target_amount: raiseForm.raise_target_amount
                  ? Number(raiseForm.raise_target_amount)
                  : null,
                sector_tags: raiseForm.sector_tags
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
                preferred_investor_types: raiseForm.preferred_investor_types,
              })
              toast.success('Raise profile saved')
              onLoadLeads()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : 'Save failed')
            } finally {
              setRaiseSaving(false)
            }
          }}
        >
          {raiseSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Save raise profile
        </Button>
        </div>
      )
    }

    if (widgetId === 'about_links') {
      if (!((company.website || company.description || company.created_at))) {
        return (
          <div className="h-full overflow-hidden rounded-xl border bg-card/50 p-4 flex items-center">
            <p className="text-sm text-muted-foreground">No about info on file</p>
          </div>
        )
      }
      return (
        <div className="h-full grid gap-3 lg:grid-cols-3 overflow-hidden">
          {company.website && (
            <div className="rounded-xl border bg-card/50 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Website</p>
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline truncate block font-medium"
                >
                  {company.website}
                </a>
              </div>
            </div>
          )}
          {company.description && (
            <div className="rounded-xl border bg-card/50 p-4 lg:col-span-2">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1.5">About</p>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-3">{company.description}</p>
            </div>
          )}
          {company.created_at && !company.description && (
            <div className="rounded-xl border bg-card/50 p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-0.5">Tracking since</p>
                <p className="text-base font-medium">{new Date(company.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</p>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (widgetId === 'social_tags') {
      if (!((company.linkedin_url || company.twitter_url || (company.tags && company.tags.length > 0)))) {
        return (
          <div className="h-full overflow-hidden rounded-xl border bg-card/50 p-4 flex items-center">
            <p className="text-sm text-muted-foreground">No social links or tags on file</p>
          </div>
        )
      }
      return (
        <div className="h-full grid gap-3 lg:grid-cols-2 overflow-hidden">
          {(company.linkedin_url || company.twitter_url) && (
            <div className="rounded-xl border bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Social</p>
              <div className="flex flex-wrap gap-3">
                {company.linkedin_url && (
                  <a
                    href={company.linkedin_url.startsWith('http') ? company.linkedin_url : `https://${company.linkedin_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                  >
                    <Globe className="w-4 h-4" />
                    LinkedIn
                  </a>
                )}
                {company.twitter_url && (
                  <a
                    href={company.twitter_url.startsWith('http') ? company.twitter_url : `https://${company.twitter_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium"
                  >
                    <Globe className="w-4 h-4" />
                    Twitter / X
                  </a>
                )}
              </div>
            </div>
          )}
          {company.tags && company.tags.length > 0 && (
            <div className="rounded-xl border bg-card/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Strategy Tags</p>
              <div className="flex flex-wrap gap-2">
                {company.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (widgetId === 'warm_intro_paths') {
      return (
        <div className="h-full overflow-hidden flex flex-col gap-3">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-muted-foreground" />
              Warm intro paths
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              People at your company who can open doors to investors during the raise.
            </p>
          </div>
          {employeeRoster.length > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goToCompanyTab('contacts', 'employees')}>
              View all
            </Button>
          )}
        </div>
        {employeeRoster.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/30 p-8 text-center">
            <User className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add employees and investors so you can map who knows whom before you start outreach.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => goToCompanyTab('contacts', 'employees')}>
              Add employees
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 min-h-0">
            {employeeRoster.slice(0, 6).map((inv) => (
              <div
                key={inv.id}
                className="rounded-xl border bg-card/50 hover:bg-card transition-colors overflow-hidden flex flex-col"
              >
                <div className="p-5 flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div>
                        <Link
                          to={`/kyi/investors/${inv.id}`}
                          className="text-base font-semibold text-primary hover:underline"
                        >
                          {inv.full_name}
                        </Link>
                        {inv.investor_type && (
                          <Badge variant="secondary" className="text-xs font-normal ml-2.5 relative -top-px">
                            {inv.investor_type}
                          </Badge>
                        )}
                      </div>
                      {(inv.title || inv.firm) && (
                        <p className="text-sm text-muted-foreground">
                          {[inv.title, inv.firm].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {inv.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 shrink-0" />
                            {inv.location}
                          </span>
                        )}
                        {inv.industry && (
                          <span className="flex items-center gap-1.5">
                            <Briefcase className="w-3.5 h-3.5 shrink-0" />
                            {inv.industry}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      to={`/kyi/investors/${inv.id}`}
                      className="w-8 h-8 rounded-lg bg-muted/50 hover:bg-muted flex items-center justify-center shrink-0 transition-colors mt-0.5"
                    >
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    </Link>
                  </div>
                  {inv.notes && (
                    <p className="text-sm text-muted-foreground border-l-2 border-primary/20 pl-3 mt-3 line-clamp-2 whitespace-pre-wrap leading-relaxed">
                      {inv.notes}
                    </p>
                  )}
                </div>
                {(inv.email || inv.phone) && (
                  <div className="border-t bg-muted/20 px-5 py-3 flex items-center gap-5 text-sm">
                    {inv.email && (
                      <a href={`mailto:${inv.email}`} className="flex items-center gap-2 text-primary hover:underline truncate">
                        <Mail className="w-4 h-4 shrink-0" />
                        {inv.email}
                      </a>
                    )}
                    {inv.phone && (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4 shrink-0" />
                        {inv.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {employeeRoster.length > 6 && (
          <Button variant="link" size="sm" className="mt-2 px-0 h-auto" onClick={() => goToCompanyTab('contacts', 'employees')}>
            View all {employeeRoster.length} employees
          </Button>
        )}
        </div>
      )
    }

    if (widgetId === 'raise_network_prep') {
      return (
        <div className="h-full grid gap-3 md:grid-cols-2 overflow-hidden">
        <div className="rounded-xl border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Your raise network</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4 pl-9">
            Who you already know vs. who you are pursuing for this round.
          </p>
          <div className="space-y-3">
            {[
              { label: 'Employees (warm intros)', value: employeeRoster.length, tab: 'contacts' as const, segment: 'employees' as const },
              { label: 'My personal network', value: personalNetworkRoster.length, tab: 'contacts' as const, segment: 'network' as const },
              { label: 'Current investors', value: currentInvestorRoster.length, tab: 'contacts' as const, segment: 'current' as const },
              { label: 'Targeted investors', value: targetedInvestorRoster.length, tab: 'contacts' as const, segment: 'targeted' as const },
              { label: 'Contacts with strategy notes', value: investorsWithStrategyNotes },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-2">
                {'tab' in row && row.tab ? (
                  <button
                    type="button"
                    onClick={() => goToCompanyTab(row.tab, 'segment' in row ? row.segment : undefined)}
                    className="text-sm text-muted-foreground hover:text-foreground text-left transition-colors"
                  >
                    {row.label}
                  </button>
                ) : (
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                )}
                <span className="text-base font-semibold tabular-nums">{row.value}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card/50 p-5">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Raise prep checklist</h4>
          </div>
          <p className="text-xs text-muted-foreground mb-4 pl-9">
            Steps that unlock localized investor leads for outreach.
          </p>
          <ul className="space-y-3">
            {[
              {
                done: geo?.configured,
                label: 'Configure geo targeting',
                detail: geo?.settings?.location_label ?? 'Set HQ or focus market',
                tab: 'geo',
              },
              {
                done: leadStats != null && leadStats.needs_geocoding_count === 0 && leadStats.total_count > 0,
                label: 'Geocode lead pool',
                detail:
                  leadStats && leadStats.needs_geocoding_count > 0
                    ? `${leadStats.needs_geocoding_count.toLocaleString()} still need coordinates`
                    : 'Coordinates ready for filtering',
                tab: 'leads',
              },
              {
                done: (leadStats?.filtered_count ?? 0) > 0,
                label: 'Review localized leads',
                detail:
                  leadStats && leadStats.filtered_count > 0
                    ? `${leadStats.filtered_count.toLocaleString()} in your radius`
                    : 'Appears after geo is set',
                tab: 'leads',
              },
              {
                done: personalNetworkRoster.length > 0,
                label: 'Upload personal network',
                detail:
                  personalNetworkRoster.length > 0
                    ? `${personalNetworkRoster.length} connection${personalNetworkRoster.length !== 1 ? 's' : ''} on file`
                    : 'CSV of people you know → warm paths + shared ecosystem',
                tab: 'contacts',
                segment: 'network' as KyiContactSegment,
              },
              {
                done: employeeRoster.length > 0,
                label: 'Map employee warm paths',
                detail:
                  employeeRoster.length > 0
                    ? `${employeeRoster.length} employee${employeeRoster.length !== 1 ? 's' : ''} on file`
                    : 'Import from HR on Employees tab',
                tab: 'contacts',
                segment: 'employees' as KyiContactSegment,
              },
            ].map((item) => (
              <li key={item.label} className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  onClick={() =>
                    goToCompanyTab(
                      item.tab,
                      'segment' in item ? item.segment : undefined,
                    )
                  }
                  className="text-left min-w-0 group"
                >
                  <span
                    className={`text-sm font-medium block ${item.done ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}
                  >
                    {item.done ? '✓ ' : ''}
                    {item.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{item.detail}</span>
                </button>
                <Badge variant={item.done ? 'default' : 'outline'} className="shrink-0 text-xs font-normal">
                  {item.done ? 'Done' : 'To do'}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
        </div>
      )
    }

    if (widgetId === 'types_strategy') {
      if (!((investorTypeMix.length > 0 || investorsWithStrategyNotes > 0))) {
        return (
          <div className="h-full overflow-hidden rounded-xl border bg-card/50 p-4 flex items-center">
            <p className="text-sm text-muted-foreground">No investor type mix or strategy notes yet</p>
          </div>
        )
      }
      return (
        <div className="h-full grid gap-3 md:grid-cols-2 overflow-hidden">
          {investorTypeMix.length > 0 && (
            <div className="rounded-xl border bg-card/50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Investor Types</p>
              <div className="flex flex-wrap gap-2">
                {investorTypeMix.map(([label, count]) => (
                  <Badge key={label} variant="outline" className="font-normal text-xs py-1 px-2.5">
                    {label}
                    <span className="ml-1.5 text-muted-foreground font-medium">{count}</span>
                  </Badge>
                ))}
              </div>
            </div>
          )}
          {investorsWithStrategyNotes > 0 && (
            <div className="rounded-xl border bg-card/50 p-5">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Strategy notes</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{investorsWithStrategyNotes}</span>
                {' '}contact{investorsWithStrategyNotes !== 1 ? 's have' : ' has'} notes captured for this raise.
                Keep thesis, check size, and intro angles on each profile while you work leads.
              </p>
            </div>
          )}
        </div>
      )
    }

    if (widgetId === 'notes_history') {
      return (
        <div className="h-full rounded-xl border bg-card/50 overflow-hidden">
          <div className="p-5 pb-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                Notes History
              </h3>
              {notesHistory.length > 0 && (
                <span className="text-xs text-muted-foreground">{notesHistory.length} note{notesHistory.length !== 1 ? 's' : ''}</span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Conversation history across investors and localized leads for this raise
            </p>
            {notesHistory.length > 3 && (
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search notes..."
                  value={notesSearch}
                  onChange={(e) => setNotesSearch(e.target.value)}
                  className="pl-9 h-8 text-sm bg-background"
                />
              </div>
            )}
          </div>
          <div className="border-t">
            {notesHistory.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No notes yet. Add notes on investor profiles or in the Orbit lead view.
                </p>
              </div>
            ) : (() => {
              const q = notesSearch.trim().toLowerCase()
              const filtered = q
                ? notesHistory.filter(
                    (n) =>
                      n.body.toLowerCase().includes(q) ||
                      n.investor_name.toLowerCase().includes(q) ||
                      (n.lead_name ?? '').toLowerCase().includes(q),
                  )
                : notesHistory
              return filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No notes match &ldquo;{notesSearch}&rdquo;
                </p>
              ) : (
                <div className="divide-y">
                  {filtered.slice(0, 20).map((note) => (
                    <div key={note.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant={note.source === 'investor' ? 'default' : 'secondary'} className="text-xs shrink-0 font-normal">
                            {note.source === 'investor' ? 'Investor' : 'Lead'}
                          </Badge>
                          <Link
                            to={`/kyi/investors/${note.investor_id}`}
                            className="text-sm font-medium text-primary hover:underline truncate"
                          >
                            {note.investor_name}
                          </Link>
                          {note.lead_name && (
                            <span className="text-xs text-muted-foreground hidden sm:inline">
                              re: {note.lead_name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0 tabular-nums">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(note.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-2 leading-relaxed">
                        {note.body}
                      </p>
                    </div>
                  ))}
                  {filtered.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Showing 20 of {filtered.length} notes
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        </div>
      )
    }

    if (widgetId === 'getting_started') {
      const isEmpty = !company.website && !company.description && investors.length === 0 && !leadStats
      if (!isEmpty) {
        return (
          <div className="h-full overflow-hidden rounded-xl border border-dashed bg-card/30 p-4 flex items-center justify-center">
            <p className="text-sm text-muted-foreground text-center">
              You&apos;re set — geo, contacts, or leads are already in progress.
            </p>
          </div>
        )
      }
      return (
        <div className="h-full overflow-hidden rounded-xl border border-dashed bg-card/30 p-8 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Start with geo targeting and your employee roster — then review localized leads to build your
            investor outreach list for this cap raise.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <Button variant="outline" size="sm" onClick={() => goToCompanyTab('geo')}>
              Set geo targeting
            </Button>
            <Button variant="outline" size="sm" onClick={() => goToCompanyTab('contacts', 'employees')}>
              Add employees
            </Button>
          </div>
        </div>
      )
    }
        return (
          <div className="flex h-full items-center justify-center p-4 text-sm text-muted-foreground">
            Unknown widget
          </div>
        )
      }}
    />
  )
}
