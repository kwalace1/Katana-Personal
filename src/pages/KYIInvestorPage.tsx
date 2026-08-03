import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Link, useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SignalBadges } from '@/components/kyi/signal-badges'
import {
  ChevronLeft,
  Loader2,
  MapPin,
  Briefcase,
  User,
  Mail,
  Phone,
  Target,
  Link2,
  Save,
  Calendar,
  Users,
  Heart,
  Zap,
  AlertTriangle,
  MessageSquare,
  Crosshair,
  FileText,
  Compass,
  Globe2,
  Lock,
} from 'lucide-react'
import {
  getInvestor,
  getInvestorTypeProfiles,
  getCompanyInvestors,
  getLeadsForInvestor,
  getLeadsByInvestorType,
  getLeadsCountByType,
  getInvestorGeoSettings,
  updateInvestorGeoSettings,
  updateInvestorType,
  updateInvestor,
  type KYIInvestorDetail,
  type KYIInvestorTypeProfile,
  type KYIInvestor,
  type KYILead,
  type GeoSettingsResponse,
} from '@/lib/kyi-api'
import { promoteInvestorToGlobal } from '@/lib/kyi-ecosystem'
import { toast } from 'sonner'
import { InvestorSolarNetwork } from '@/components/kyi/InvestorSolarNetwork'
import { KyiNorthstarInvestorPanel } from '@/components/kyi/KyiNorthstarInvestorPanel'
import { KyiInvestorPrivateCrm } from '@/components/kyi/KyiInvestorPrivateCrm'

export default function KYIInvestorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'info'
  const investorId = id ? parseInt(id, 10) : NaN
  const [investor, setInvestor] = useState<KYIInvestorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [typeProfiles, setTypeProfiles] = useState<KYIInvestorTypeProfile[]>([])
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [typeSaving, setTypeSaving] = useState(false)

  const [notes, setNotes] = useState('')
  const [notesSaving, setNotesSaving] = useState(false)
  const [notesSaved, setNotesSaved] = useState(false)
  const [coInvestors, setCoInvestors] = useState<KYIInvestor[]>([])

  const [geoLeads, setGeoLeads] = useState<KYILead[]>([])
  const [geoLeadsLoading, setGeoLeadsLoading] = useState(false)
  const [geoLeadsCount, setGeoLeadsCount] = useState(0)

  const [typeCounts, setTypeCounts] = useState<Map<number, number>>(new Map())
  const [typeLeads, setTypeLeads] = useState<KYILead[]>([])
  const [typeLeadsCount, setTypeLeadsCount] = useState(0)
  const [typeLeadsLoading, setTypeLeadsLoading] = useState(false)

  const [geo, setGeo] = useState<GeoSettingsResponse | null>(null)
  const [geoForm, setGeoForm] = useState({ location_label: '', radius_miles: 50 })
  const [geoSaving, setGeoSaving] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [promotingGlobal, setPromotingGlobal] = useState(false)

  useEffect(() => {
    if (!id || Number.isNaN(investorId)) {
      setError('Invalid investor')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getInvestor(investorId)
      .then((invData) =>
        getInvestorTypeProfiles(invData.company?.id ?? undefined)
          .catch(() => [] as KYIInvestorTypeProfile[])
          .then((profiles) => ({ invData, profiles })),
      )
      .then(({ invData, profiles }) => {
        if (cancelled) return
        setInvestor(invData)
        setSelectedType(invData.investor_type ?? null)
        setNotes(invData.notes ?? '')
        setTypeProfiles(profiles)
        if (invData.investor_type) {
          const matchedProfile = profiles.find((p: KYIInvestorTypeProfile) => p.type === invData.investor_type)
          if (matchedProfile) {
            setTypeLeadsLoading(true)
            getLeadsByInvestorType(investorId, matchedProfile.id)
              .then((res) => { if (!cancelled) { setTypeLeads(res.leads); setTypeLeadsCount(res.count) } })
              .catch(() => {})
              .finally(() => { if (!cancelled) setTypeLeadsLoading(false) })
          }
        }
        if (invData.company_id) {
          getCompanyInvestors(invData.company_id)
            .then((inv) => { if (!cancelled) setCoInvestors(inv.filter(i => i.id !== investorId)) })
            .catch(() => {})
        }
        getLeadsCountByType(investorId)
          .then((counts) => {
            if (cancelled) return
            const m = new Map<number, number>()
            for (const c of counts) m.set(c.type_id, c.count)
            setTypeCounts(m)
          })
          .catch(() => {})
        getInvestorGeoSettings(investorId)
          .then((geoData) => {
            if (cancelled) return
            setGeo(geoData)
            if (geoData.settings) {
              const rawR = geoData.settings.radius_miles
              const r =
                typeof rawR === 'number' && Number.isFinite(rawR) && rawR > 0
                  ? Math.min(250, Math.max(5, Math.round(rawR)))
                  : 50
              setGeoForm({
                location_label: geoData.settings.location_label,
                radius_miles: r,
              })
            } else if (invData.location) {
              setGeoForm((prev) => ({ ...prev, location_label: invData.location ?? '' }))
            }
          })
          .catch(() => {})
        loadLeads()
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, investorId])

  const loadLeads = async () => {
    if (Number.isNaN(investorId)) return
    setGeoLeadsLoading(true)
    try {
      const res = await getLeadsForInvestor(investorId, { thinning: 'top_25_percent' })
      setGeoLeads(res.leads)
      setGeoLeadsCount(res.filtered_count)
    } catch {
      setGeoLeads([])
      setGeoLeadsCount(0)
    } finally {
      setGeoLeadsLoading(false)
    }
  }

  const refreshTypeCounts = async () => {
    try {
      const counts = await getLeadsCountByType(investorId)
      const m = new Map<number, number>()
      for (const c of counts) m.set(c.type_id, c.count)
      setTypeCounts(m)
    } catch { /* ignore */ }
  }

  const handleSaveGeo = async () => {
    setGeoSaving(true)
    setGeoError(null)
    try {
      const res = await updateInvestorGeoSettings(investorId, {
        location_label: geoForm.location_label,
        radius_miles: geoForm.radius_miles,
      })
      setGeo((prev) =>
        prev
          ? { ...prev, configured: true, settings: res.settings }
          : { configured: true, client_id: investorId, client_name: '', settings: res.settings },
      )
      await loadLeads()
      await refreshTypeCounts()
      const activeP = typeProfiles.find((p) => p.type === selectedType)
      if (activeP) await loadTypeLeads(activeP.id)
    } catch (e) {
      setGeoError(e instanceof Error ? e.message : 'Could not save geo settings')
    } finally {
      setGeoSaving(false)
    }
  }

  const handleTypeChange = async (value: string) => {
    const newType = value === '__none__' ? null : value
    setSelectedType(newType)
    setTypeSaving(true)
    try {
      await updateInvestorType(investorId, newType)
      setInvestor((prev) => prev ? { ...prev, investor_type: newType } : prev)
    } finally {
      setTypeSaving(false)
    }
    const profile = typeProfiles.find((p) => p.type === newType)
    if (profile) {
      loadTypeLeads(profile.id)
    } else {
      setTypeLeads([])
      setTypeLeadsCount(0)
    }
  }

  const loadTypeLeads = async (typeId: number) => {
    setTypeLeadsLoading(true)
    try {
      const res = await getLeadsByInvestorType(investorId, typeId)
      setTypeLeads(res.leads)
      setTypeLeadsCount(res.count)
    } catch {
      setTypeLeads([])
      setTypeLeadsCount(0)
    } finally {
      setTypeLeadsLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    setNotesSaving(true)
    setNotesSaved(false)
    try {
      await updateInvestor(investorId, { notes: notes.trim() || null } as any)
      setInvestor((prev) => prev ? { ...prev, notes: notes.trim() || null } : prev)
      setNotesSaved(true)
      setTimeout(() => setNotesSaved(false), 2000)
    } finally {
      setNotesSaving(false)
    }
  }

  const activeProfile = typeProfiles.find((p) => p.type === selectedType) ?? null

  const trackedDays = investor?.created_at
    ? Math.floor((Date.now() - new Date(investor.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const handlePromoteToEcosystem = async () => {
    setPromotingGlobal(true)
    try {
      const global = await promoteInvestorToGlobal(investorId)
      setInvestor((prev) => (prev ? { ...prev, global_investor_id: global.id } : prev))
      toast.success('Linked to shared ecosystem directory')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not promote to ecosystem')
    } finally {
      setPromotingGlobal(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !investor) {
    return (
      <div className="p-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error ?? 'Investor not found'}</CardDescription>
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
    <MotionPage key={investor.id} className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            if (investor.company_id) {
              const tab = investor.user_role_classification === 'investor'
                ? 'current-investors'
                : 'employees'
              if (location.key !== 'default') {
                navigate(-1)
              } else {
                navigate(`/kyi/companies/${investor.company_id}?tab=${tab}`)
              }
            } else {
              navigate('/kyi')
            }
          }}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <User className="w-8 h-8 text-muted-foreground" />
            {investor.full_name}
          </h1>
          {(investor.firm || investor.title) && (
            <p className="text-muted-foreground text-sm mt-1">
              {[investor.title, investor.firm].filter(Boolean).join(' · ')}
            </p>
          )}
          {investor.company && (
            <Link
              to={`/kyi/companies/${investor.company.id}`}
              className="text-sm text-primary hover:underline mt-1 inline-block"
            >
              {investor.company.name}
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {investor.global_investor_id != null ? (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/kyi/ecosystem/${investor.global_investor_id}?companyId=${investor.company_id ?? ''}`}>
                <Globe2 className="w-4 h-4 mr-1.5" />
                Ecosystem profile
              </Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled={promotingGlobal}
              onClick={() => void handlePromoteToEcosystem()}
            >
              {promotingGlobal ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Globe2 className="w-4 h-4 mr-1.5" />
              )}
              Share to ecosystem
            </Button>
          )}
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(tab) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', tab); return next }, { replace: true })}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          <TabsTrigger value="private" className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Private CRM
          </TabsTrigger>
          <TabsTrigger value="northstar" className="flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" />
            Northstar
          </TabsTrigger>
          <TabsTrigger value="orbit">Orbit (Suggested)</TabsTrigger>
          <TabsTrigger value="relationship">Relationship</TabsTrigger>
          <TabsTrigger value="behavior">Behavior</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investor information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Full name</p>
                  <p className="font-medium">{investor.full_name}</p>
                </div>
                {investor.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <a href={`mailto:${investor.email}`} className="text-primary hover:underline">
                      {investor.email}
                    </a>
                  </div>
                )}
                {investor.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.phone}</span>
                  </div>
                )}
                {investor.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.location}</span>
                  </div>
                )}
              </div>
              <div className="space-y-3">
                {investor.firm && (
                  <div>
                    <p className="text-xs text-muted-foreground">Firm / organization</p>
                    <p className="font-medium">{investor.firm}</p>
                  </div>
                )}
                {investor.title && (
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium">{investor.title}</p>
                  </div>
                )}
                {investor.industry && (
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span>{investor.industry}</span>
                  </div>
                )}
                {investor.profile_url && (
                  <div className="flex items-center gap-2">
                    <Link2 className="w-4 h-4 text-muted-foreground" />
                    <a
                      href={investor.profile_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      View profile
                    </a>
                  </div>
                )}
              </div>
              {investor.notes && (
                <div className="md:col-span-2">
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap mt-1">{investor.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="private" className="space-y-4">
          <div className="rounded-xl border border-primary/15 bg-primary/[0.03] px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Private to your organization.</span>{' '}
            Tasks, NDAs, valuations, and communication history never appear in the shared investor
            ecosystem. Notes and Northstar remain available on their own tabs.
          </div>
          <KyiInvestorPrivateCrm
            investorId={investorId}
            internalRating={investor.internal_rating ?? null}
            assignedTeamMember={investor.assigned_team_member ?? null}
            onRatingChange={(rating) =>
              setInvestor((prev) => (prev ? { ...prev, internal_rating: rating } : prev))
            }
            onAssigneeChange={(userId) =>
              setInvestor((prev) => (prev ? { ...prev, assigned_team_member: userId } : prev))
            }
          />
        </TabsContent>
        <TabsContent value="northstar" className="space-y-4">
          <KyiNorthstarInvestorPanel
            investor={investor}
            onUpdated={async () => {
              const refreshed = await getInvestor(investorId)
              setInvestor(refreshed)
            }}
          />
        </TabsContent>
        <TabsContent value="orbit" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Investor notes
              </CardTitle>
              <CardDescription>
                Relationship notes for this investor (same as the Relationship tab). Keep context visible while you review suggested leads.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={4}
                placeholder="Context, intros, follow-ups…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
                  {notesSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save notes
                </Button>
                {notesSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Investor Geo Targeting
              </CardTitle>
              <CardDescription>
                Set a target location and radius for <strong>{investor.full_name}</strong>. This is independent of the company-level geo targeting and controls which leads appear in this investor's Orbit view.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {geoError && <p className="text-sm text-red-500">{geoError}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Investor target location</label>
                  <input
                    type="text"
                    className="border border-border rounded-md bg-background px-3 py-2 text-sm w-full"
                    placeholder="e.g., Cheverly, MD or 123 Main St, Denver, CO"
                    value={geoForm.location_label}
                    onChange={(e) => setGeoForm((prev) => ({ ...prev, location_label: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Investor radius ({Math.round(geoForm.radius_miles)} miles)</label>
                  <input
                    type="range"
                    min={5}
                    max={250}
                    step={5}
                    value={geoForm.radius_miles}
                    onChange={(e) => setGeoForm((prev) => ({ ...prev, radius_miles: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button size="sm" onClick={handleSaveGeo} disabled={geoSaving || !geoForm.location_label.trim()}>
                  {geoSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save &amp; search
                </Button>
                {geo?.settings && (
                  <span className="text-xs text-muted-foreground">
                    Currently: {geo.settings.location_label}, {Math.round(geo.settings.radius_miles)} mi
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {geoLeadsLoading ? (
            <div className="py-12 flex items-center justify-center rounded-xl border border-border bg-[#0f1729]">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : geoLeads.length === 0 ? (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-center">
                  No leads found. Set your target location above and click &quot;Save &amp; search&quot; to discover nearby investors.
                </p>
              </CardContent>
            </Card>
          ) : (
            <InvestorSolarNetwork
              investorName={investor.full_name}
              investorId={investorId}
              leads={geoLeads}
              totalCount={geoLeadsCount}
            />
          )}
        </TabsContent>
        <TabsContent value="relationship" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{investor.connection_count ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Connections</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{trackedDays ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">Days tracked</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                    <Briefcase className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{coInvestors.length}</p>
                    <p className="text-xs text-muted-foreground">Co-investors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Notes
              </CardTitle>
              <CardDescription>
                Track relationship context, meeting notes, and follow-ups
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={5}
                placeholder="Add notes about this investor relationship..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={notesSaving}>
                  {notesSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Save notes
                </Button>
                {notesSaved && <span className="text-xs text-green-500">Saved</span>}
              </div>
            </CardContent>
          </Card>

          {coInvestors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Co-investors at {investor.company?.name ?? 'this company'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {coInvestors.map((inv) => (
                    <Link
                      key={inv.id}
                      to={`/kyi/investors/${inv.id}`}
                      className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{inv.full_name}</p>
                        {(inv.firm || inv.title) && (
                          <p className="text-sm text-muted-foreground">
                            {[inv.title, inv.firm].filter(Boolean).join(' · ')}
                          </p>
                        )}
                      </div>
                      {inv.investor_type && (
                        <Badge variant="secondary" className="text-xs">{inv.investor_type}</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Investor Type</CardTitle>
              <CardDescription>
                Assign a behavioral profile to tailor messaging and outreach strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Select
                  value={selectedType ?? '__none__'}
                  onValueChange={handleTypeChange}
                  disabled={typeSaving}
                >
                  <SelectTrigger className="w-[320px]">
                    <SelectValue placeholder="Select investor type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No type assigned</SelectItem>
                    {typeProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.type}>{p.type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {typeSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              </div>
            </CardContent>
          </Card>

          {activeProfile && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm">{activeProfile.description}</p>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeProfile.motivations && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Heart className="w-4 h-4 text-red-500" />
                        Motivations
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.motivations}</p>
                    </CardContent>
                  </Card>
                )}
                {activeProfile.cares_about && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="w-4 h-4 text-blue-500" />
                        Cares About
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.cares_about}</p>
                    </CardContent>
                  </Card>
                )}
                {activeProfile.decision_drivers && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        Decision Drivers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.decision_drivers}</p>
                    </CardContent>
                  </Card>
                )}
                {activeProfile.red_flags && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        Red Flags
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.red_flags}</p>
                    </CardContent>
                  </Card>
                )}
                {activeProfile.messaging_approach && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-green-500" />
                        Messaging Approach
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.messaging_approach}</p>
                    </CardContent>
                  </Card>
                )}
                {activeProfile.outreach_angle && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Crosshair className="w-4 h-4 text-purple-500" />
                        Outreach Angle
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{activeProfile.outreach_angle}</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          {!activeProfile && !typeSaving && (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-center">
                  Select an investor type above to see the full behavioral profile, outreach strategy, and matching leads.
                </p>
              </CardContent>
            </Card>
          )}

          {activeProfile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  {activeProfile.type} — Matching Leads
                </CardTitle>
                <CardDescription>
                  {typeLeadsCount > 0
                    ? `${typeLeadsCount} lead${typeLeadsCount !== 1 ? 's' : ''} classified as "${activeProfile.type}" in your geo area`
                    : 'Leads matching this investor type within your geo targeting area'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typeLeadsLoading ? (
                  <div className="py-8 flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : typeLeads.length === 0 ? (
                  <p className="text-muted-foreground py-6 text-center">
                    No leads of this type found in your geo area. Try adjusting your geo targeting in the Orbit tab.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {typeLeads.map((lead) => (
                        <Card key={lead.id} className="border-border">
                          <CardContent className="pt-4 space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-medium truncate text-sm">{lead.display_name}</p>
                                <p className="text-xs text-muted-foreground">{lead.entity_type}</p>
                              </div>
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                {lead.fit_percent}%
                              </Badge>
                            </div>
                            {(lead.city || lead.state) && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {[lead.city, lead.state].filter(Boolean).join(', ')}
                              </p>
                            )}
                            <SignalBadges signals={lead.signals} maxVisible={3} />
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                    {typeLeadsCount > typeLeads.length && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Showing {typeLeads.length} of {typeLeadsCount} leads
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {typeProfiles.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  All Investor Types — Lead Counts
                </CardTitle>
                <CardDescription>
                  How your localized leads are distributed across investor types
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {typeProfiles.map((p) => {
                    const count = typeCounts.get(p.id) ?? 0
                    return (
                      <button
                        key={p.id}
                        onClick={() => { handleTypeChange(p.type) }}
                        className="flex items-center justify-between w-full p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="text-sm font-medium">{p.type}</span>
                        <Badge variant={count > 0 ? 'default' : 'secondary'} className="text-xs">
                          {count}
                        </Badge>
                      </button>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </MotionPage>
  )
}
