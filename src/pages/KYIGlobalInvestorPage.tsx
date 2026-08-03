import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Building2,
  ExternalLink,
  Globe2,
  Loader2,
  MapPin,
  Network,
  ArrowLeft,
  Save,
  Pencil,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  associateGlobalInvestor,
  getGlobalInvestor,
  getInvestorCategoryDefs,
  updateGlobalInvestorPublicFields,
  type KyiInvestorCategoryDef,
  type KYIGlobalInvestor,
} from '@/lib/kyi-ecosystem'
import { ensureOrganizationCompany, getCompanies, type KYICompany } from '@/lib/kyi-api'

export default function KYIGlobalInvestorPage() {
  const { id } = useParams<{ id: string }>()
  const globalId = Number(id)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [investor, setInvestor] = useState<KYIGlobalInvestor | null>(null)
  const [companies, setCompanies] = useState<KYICompany[]>([])
  const [companyId, setCompanyId] = useState<number | null>(
    searchParams.get('companyId') ? Number(searchParams.get('companyId')) : null,
  )
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [associating, setAssociating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [allCats, setAllCats] = useState<KyiInvestorCategoryDef[]>([])
  const [form, setForm] = useState({
    title: '',
    firm: '',
    location: '',
    industry: '',
    website: '',
    profile_url: '',
    investment_focus: '',
    public_history: '',
    categorySlugs: [] as string[],
  })

  useEffect(() => {
    let cancelled = false
    ensureOrganizationCompany()
      .then(() => getCompanies())
      .then((list) => {
        if (cancelled) return
        setCompanies(list)
        setCompanyId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev
          return list[0]?.id ?? null
        })
      })
      .catch(() => {})
    getInvestorCategoryDefs()
      .then((defs) => {
        if (!cancelled) setAllCats(defs)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!Number.isFinite(globalId)) {
      setError('Invalid investor id')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getGlobalInvestor(globalId, companyId ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setInvestor(data)
          setForm({
            title: data.title ?? '',
            firm: data.firm ?? '',
            location: data.location ?? '',
            industry: data.industry ?? '',
            website: data.website ?? '',
            profile_url: data.profile_url ?? data.linkedin_url ?? '',
            investment_focus: data.investment_focus ?? '',
            public_history: data.public_history ?? '',
            categorySlugs: (data.categories ?? []).map((c) => c.slug),
          })
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [globalId, companyId])

  const handleAssociate = async () => {
    if (!investor || companyId == null) return
    setAssociating(true)
    try {
      const row = await associateGlobalInvestor({
        globalInvestorId: investor.id,
        companyId,
      })
      toast.success(`Added ${investor.display_name} to your raise`)
      navigate(`/kyi/investors/${row.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not associate')
    } finally {
      setAssociating(false)
    }
  }

  const handleSavePublic = async () => {
    if (!investor) return
    setSaving(true)
    try {
      const updated = await updateGlobalInvestorPublicFields(investor.id, {
        title: form.title,
        firm: form.firm,
        location: form.location,
        industry: form.industry,
        website: form.website,
        profile_url: form.profile_url,
        investment_focus: form.investment_focus,
        public_history: form.public_history,
        categorySlugs: form.categorySlugs,
      })
      setInvestor({
        ...updated,
        associated_for_company: investor.associated_for_company,
        associated_investor_id: investor.associated_investor_id,
        tracked_by_org_count: investor.tracked_by_org_count,
      })
      setEditing(false)
      toast.success('Shared profile updated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save')
    } finally {
      setSaving(false)
    }
  }

  const toggleCat = (slug: string) => {
    setForm((p) => ({
      ...p,
      categorySlugs: p.categorySlugs.includes(slug)
        ? p.categorySlugs.filter((s) => s !== slug)
        : [...p.categorySlugs, slug],
    }))
  }

  if (loading) {
    return (
      <MotionPage className="p-6 flex items-center justify-center gap-2 text-muted-foreground min-h-[40vh]">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading investor…
      </MotionPage>
    )
  }

  if (error || !investor) {
    return (
      <MotionPage className="p-6 max-w-lg">
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive">Investor not found</CardTitle>
            <CardDescription>{error ?? 'Unknown error'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" asChild>
              <Link to="/kyi/ecosystem">Back to ecosystem</Link>
            </Button>
          </CardContent>
        </Card>
      </MotionPage>
    )
  }

  const profileHref = investor.profile_url || investor.linkedin_url || investor.website

  return (
    <MotionPage className="p-6 space-y-6 max-w-3xl">
      <div>
        <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
          <Link to={`/kyi/ecosystem${companyId ? `?companyId=${companyId}` : ''}`}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Ecosystem
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {investor.entity_type === 'firm' ? (
                <Building2 className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Globe2 className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{investor.display_name}</h1>
              <p className="text-muted-foreground">
                {[investor.title, investor.firm].filter(Boolean).join(' · ') || 'Shared investor profile'}
              </p>
              {investor.location && (
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {investor.location}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {companies.length > 0 && (
              <Select
                value={companyId != null ? String(companyId) : undefined}
                onValueChange={(v) => setCompanyId(Number(v))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Company" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {investor.associated_for_company && investor.associated_investor_id ? (
              <Button asChild>
                <Link to={`/kyi/investors/${investor.associated_investor_id}`}>Open in your raise</Link>
              </Button>
            ) : (
              <Button disabled={companyId == null || associating} onClick={() => void handleAssociate()}>
                {associating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    Adding…
                  </>
                ) : (
                  'Add to our raise'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>

      {(investor.tracked_by_org_count ?? 0) > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-2 text-sm">
            <Network className="w-4 h-4 text-primary shrink-0" />
            Tracked by {investor.tracked_by_org_count} Katana{' '}
            {investor.tracked_by_org_count === 1 ? 'company' : 'companies'}
            <span className="text-muted-foreground">— org names stay private</span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Shared profile</CardTitle>
            <CardDescription>
              Public fields only. Notes, valuations, and pipeline live on your private association.
            </CardDescription>
          </div>
          {!editing ? (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Enrich
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                Cancel
              </Button>
              <Button size="sm" disabled={saving} onClick={() => void handleSavePublic()}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!editing ? (
            <>
              {investor.industry && (
                <div>
                  <p className="text-xs text-muted-foreground">Industry</p>
                  <p>{investor.industry}</p>
                </div>
              )}
              {investor.investment_focus && (
                <div>
                  <p className="text-xs text-muted-foreground">Investment focus</p>
                  <p>{investor.investment_focus}</p>
                </div>
              )}
              {investor.public_history && (
                <div>
                  <p className="text-xs text-muted-foreground">Public history</p>
                  <p className="whitespace-pre-wrap">{investor.public_history}</p>
                </div>
              )}
              {profileHref && (
                <a
                  href={profileHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  Open profile <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
              {(investor.categories?.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Categories</p>
                  <div className="flex flex-wrap gap-1.5">
                    {investor.categories!.map((c) => (
                      <Badge key={c.slug} variant="secondary">
                        {c.label}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {!investor.industry &&
                !investor.investment_focus &&
                !investor.public_history &&
                !profileHref &&
                !(investor.categories?.length ?? 0) && (
                  <p className="text-muted-foreground">
                    Sparse profile — click Enrich to contribute public details for everyone.
                  </p>
                )}
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ['title', 'Title'],
                  ['firm', 'Firm'],
                  ['location', 'Location'],
                  ['industry', 'Industry'],
                  ['website', 'Website'],
                  ['profile_url', 'Profile / LinkedIn URL'],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    value={form[key]}
                    onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Investment focus</Label>
                <Textarea
                  rows={2}
                  value={form.investment_focus}
                  onChange={(e) => setForm((p) => ({ ...p, investment_focus: e.target.value }))}
                  placeholder="Sectors, check size, stage preference…"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Public history</Label>
                <Textarea
                  rows={3}
                  value={form.public_history}
                  onChange={(e) => setForm((p) => ({ ...p, public_history: e.target.value }))}
                  placeholder="Known public investments or background (no private deal details)"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs">Categories</Label>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {allCats.map((c) => {
                    const on = form.categorySlugs.includes(c.slug)
                    return (
                      <button
                        key={c.slug}
                        type="button"
                        onClick={() => toggleCat(c.slug)}
                        className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                          on
                            ? 'border-primary bg-primary/15 text-foreground'
                            : 'border-border text-muted-foreground hover:bg-muted/50'
                        }`}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </MotionPage>
  )
}
