import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, UserPlus, ExternalLink, Globe2 } from 'lucide-react'
import { SignalBadges } from '@/components/kyi/signal-badges'
import {
  buildTargetedInvestorAddUrl,
  findInvestorByLeadOrName,
  getLeadById,
  getLeadProfileIntel,
  getLeadScoreBreakdown,
  getWarmPathForLead,
  KYI_SIGNAL_LABELS,
  upsertLeadProfileIntel,
  type KYILead,
  type KYILeadProfileIntel,
  type KyiWarmPath,
} from '@/lib/kyi-api'
import { promoteLeadToGlobal } from '@/lib/kyi-ecosystem'
import { toast } from 'sonner'

export interface KyiLeadDetailDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: number
  leadId: number | null
  onPromoted?: () => void
}

export function KyiLeadDetailDrawer({
  open,
  onOpenChange,
  companyId,
  leadId,
  onPromoted,
}: KyiLeadDetailDrawerProps) {
  const navigate = useNavigate()
  const [lead, setLead] = useState<KYILead | null>(null)
  const [intel, setIntel] = useState<KYILeadProfileIntel | null>(null)
  const [warmPath, setWarmPath] = useState<KyiWarmPath | null>(null)
  const [loading, setLoading] = useState(false)
  const [nextSteps, setNextSteps] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [duplicateName, setDuplicateName] = useState<string | null>(null)
  const [promoting, setPromoting] = useState(false)

  useEffect(() => {
    if (!open || leadId == null) {
      setLead(null)
      setIntel(null)
      setWarmPath(null)
      return
    }
    let cancelled = false
    setLoading(true)
    Promise.all([
      getLeadById(leadId),
      getLeadProfileIntel(companyId, leadId),
      getLeadById(leadId).then((l) =>
        l
          ? getWarmPathForLead(companyId, {
              id: l.id,
              display_name: l.display_name,
              firm: (l.metadata?.firm as string | undefined) ?? null,
            })
          : Promise.resolve({ pathDepth: 0 } as KyiWarmPath),
      ),
      findInvestorByLeadOrName(companyId, leadId, ''),
    ])
      .then(([leadData, intelData, path, dup]) => {
        if (cancelled) return
        setLead(leadData)
        setIntel(intelData)
        setWarmPath(path)
        setNextSteps(intelData?.notes_next_steps ?? '')
        if (dup) setDuplicateName(dup.full_name)
        else if (leadData) {
          findInvestorByLeadOrName(companyId, leadId, leadData.display_name).then((d) => {
            if (!cancelled) setDuplicateName(d?.full_name ?? null)
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, leadId, companyId])

  const breakdown = lead
    ? getLeadScoreBreakdown(lead.signals, {
        hasCoordinates: lead.lat != null && lead.lng != null,
        tags: lead.tags,
        metadata: lead.metadata,
      })
    : []

  const sourceUrl =
    lead?.sources?.find((s) => s.url)?.url ??
    (lead?.metadata?.url as string | undefined) ??
    (lead?.metadata?.source_url as string | undefined)

  const handleSaveNotes = async () => {
    if (leadId == null) return
    setSavingNotes(true)
    try {
      const saved = await upsertLeadProfileIntel(companyId, leadId, { notes_next_steps: nextSteps })
      setIntel(saved)
      toast.success('Next steps saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingNotes(false)
    }
  }

  const handleAddToRaise = async () => {
    if (leadId == null) return
    setPromoting(true)
    try {
      const { investor } = await promoteLeadToGlobal({
        leadId,
        companyId,
        associate: true,
      })
      toast.success('Added to your raise via shared ecosystem')
      onPromoted?.()
      onOpenChange(false)
      if (investor?.id) navigate(`/kyi/investors/${investor.id}`)
    } catch (e) {
      // Fallback to classic form flow if ecosystem tables missing
      toast.message('Opening targeted form', {
        description: e instanceof Error ? e.message : 'Ecosystem associate unavailable',
      })
      if (addUrl) {
        onPromoted?.()
        navigate(addUrl)
      }
    } finally {
      setPromoting(false)
    }
  }

  const addUrl =
    lead &&
    buildTargetedInvestorAddUrl(
      companyId,
      lead.display_name,
      [lead.city, lead.state].filter(Boolean).join(', ') || undefined,
      lead.id,
    )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead?.display_name ?? 'Lead details'}</SheetTitle>
          <SheetDescription>
            {lead?.entity_type}
            {lead?.city || lead?.state
              ? ` · ${[lead.city, lead.state].filter(Boolean).join(', ')}`
              : ''}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : lead ? (
          <div className="space-y-5 mt-4">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-primary tabular-nums">{lead.fit_percent}%</span>
              <span className="text-xs text-muted-foreground">fit score</span>
            </div>

            {warmPath && warmPath.pathDepth > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm">
                Warm path
                {warmPath.employeeName && warmPath.introInvestorName
                  ? `: ${warmPath.employeeName} → ${warmPath.introInvestorName}`
                  : warmPath.introInvestorName
                    ? `: via ${warmPath.introInvestorName}`
                    : ''}
              </div>
            )}

            {breakdown.length > 0 && (
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  Top score drivers
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {breakdown.map((b) => (
                    <Badge key={b.key} variant="secondary" className="text-xs">
                      {KYI_SIGNAL_LABELS[b.key]?.label ?? b.key}
                      {b.key !== 'raise_fit' ? ` +${b.weight}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <SignalBadges signals={lead.signals} maxVisible={12} />

            {intel && (
              <div className="space-y-3 text-sm">
                {intel.motivations && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Motivations</p>
                    <p className="text-muted-foreground">{intel.motivations}</p>
                  </div>
                )}
                {intel.green_flags && intel.green_flags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Green flags</p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {intel.green_flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {intel.red_flags && intel.red_flags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Red flags</p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {intel.red_flags.map((f) => (
                        <li key={f}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {intel.example_outreach_angles && intel.example_outreach_angles.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Outreach angles</p>
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {intel.example_outreach_angles.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="lead-next-steps">Next steps</Label>
              <Textarea
                id="lead-next-steps"
                rows={3}
                value={nextSteps}
                onChange={(e) => setNextSteps(e.target.value)}
                placeholder="Follow-up plan for this prospect…"
              />
              <Button variant="outline" size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                {savingNotes && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save next steps
              </Button>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {duplicateName && (
                <p className="text-xs text-amber-600">
                  Already on targeted list as {duplicateName}.
                </p>
              )}
              <Button
                className="w-full"
                disabled={!!duplicateName || promoting}
                onClick={() => void handleAddToRaise()}
              >
                {promoting ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Globe2 className="w-4 h-4 mr-2" />
                )}
                Add to our raise
              </Button>
              {addUrl && (
                <Button asChild variant="ghost" size="sm" className="w-full" onClick={() => onPromoted?.()}>
                  <Link to={addUrl}>
                    <UserPlus className="w-4 h-4 mr-2" />
                    Use classic add form
                  </Link>
                </Button>
              )}
              {sourceUrl && (
                <Button variant="outline" size="sm" asChild className="w-full">
                  <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-4 h-4 mr-2" />
                    View source record
                  </a>
                </Button>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-8">Lead not found.</p>
        )}
      </SheetContent>
    </Sheet>
  )
}
