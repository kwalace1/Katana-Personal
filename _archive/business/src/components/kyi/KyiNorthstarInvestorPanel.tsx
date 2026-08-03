import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Loader2,
  MessageSquarePlus,
  Plus,
  Save,
  Star,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import {
  getInvestorMeetings,
  createInvestorMeeting,
  deleteInvestorMeeting,
  updateInvestorNorthstar,
  getNorthstarFramework,
  computeScorecardTotal,
  tierLabel,
  pipelineStageLabel,
  stageBadgeClass,
  tierBadgeClass,
  scorecardPercent,
  NORTHSTAR_CATEGORY_FIELD_LABELS,
  type KyiInvestorMeeting,
  type NorthstarScorecard,
  type NorthstarDueDiligence,
  type NorthstarTier,
  type KyiNorthstarFramework,
} from '@/lib/kyi-northstar'
import { getInvestorTypeProfiles, type KYIInvestorDetail, type KYIInvestorTypeProfile } from '@/lib/kyi-api'

export interface KyiNorthstarInvestorPanelProps {
  investor: KYIInvestorDetail
  onUpdated?: () => void
}

function ScorePicker({
  value,
  onChange,
}: {
  value?: number
  onChange: (v: 1 | 2 | 3 | 4 | 5 | undefined) => void
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Score 1 to 5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? undefined : n)}
          className={cn(
            'h-8 flex-1 max-w-[2.5rem] rounded-md text-xs font-medium border transition-all',
            value === n
              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
              : value != null && n <= value
                ? 'bg-primary/10 border-primary/25 text-foreground hover:bg-primary/15'
                : 'bg-muted/40 border-transparent text-muted-foreground hover:bg-muted hover:border-border',
          )}
          aria-pressed={value === n}
        >
          {n}
        </button>
      ))}
    </div>
  )
}

export function KyiNorthstarInvestorPanel({ investor, onUpdated }: KyiNorthstarInvestorPanelProps) {
  const [framework, setFramework] = useState<KyiNorthstarFramework | null>(null)
  const [typeProfiles, setTypeProfiles] = useState<KYIInvestorTypeProfile[]>([])
  const [saving, setSaving] = useState(false)
  const [meetings, setMeetings] = useState<KyiInvestorMeeting[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(true)
  const [meetingFormOpen, setMeetingFormOpen] = useState(false)

  const inv = investor

  const [category, setCategory] = useState(inv.investor_type ?? '')
  const [tier, setTier] = useState<string>(inv.northstar_tier != null ? String(inv.northstar_tier) : '')
  const [stage, setStage] = useState<string>(inv.northstar_pipeline_stage ?? 'research')
  const [probability, setProbability] = useState(inv.northstar_probability?.toString() ?? '')
  const [warmIntro, setWarmIntro] = useState(
    inv.northstar_warm_intro == null ? 'unknown' : inv.northstar_warm_intro ? 'yes' : 'no',
  )
  const [lastContact, setLastContact] = useState(
    inv.northstar_last_contact_at ? inv.northstar_last_contact_at.slice(0, 10) : '',
  )
  const [nextStep, setNextStep] = useState(inv.northstar_next_step ?? '')
  const [scorecard, setScorecard] = useState<NorthstarScorecard>((inv.northstar_scorecard as NorthstarScorecard) ?? {})
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>(
    (inv.northstar_category_fields as Record<string, string>) ?? {},
  )
  const [dueDiligence, setDueDiligence] = useState<NorthstarDueDiligence>(
    (inv.northstar_due_diligence as NorthstarDueDiligence) ?? {},
  )

  const [meetingForm, setMeetingForm] = useState({
    meeting_date: '',
    attendees: '',
    key_discussion_points: '',
    questions_asked: '',
    concerns_raised: '',
    follow_up_items: '',
    overall_impression: '',
    likelihood_of_investment: '',
    next_meeting_date: '',
  })

  useEffect(() => {
    const companyId = investor.company_id
    if (companyId) {
      getNorthstarFramework(companyId).then(setFramework).catch(() => {})
      getInvestorTypeProfiles(companyId).then(setTypeProfiles).catch(() => {})
    }
    setMeetingsLoading(true)
    getInvestorMeetings(investor.id)
      .then(setMeetings)
      .finally(() => setMeetingsLoading(false))
  }, [investor.id, investor.company_id])

  const selectedProfile = typeProfiles.find((p) => p.type === category)
  const categoryFieldKeys: string[] =
    selectedProfile?.category_fields && selectedProfile.category_fields.length > 0
      ? selectedProfile.category_fields
      : ['partner', 'website', 'average_check', 'portfolio_companies', 'why_fit', 'current_status', 'notes']

  const scoreTotal = computeScorecardTotal(scorecard, framework?.scorecard_criteria)
  const scoredCriteriaCount = (framework?.scorecard_criteria ?? []).filter((c) => scorecard[c.key] != null).length
  const diligenceQuestions = framework?.due_diligence_questions ?? []
  const diligenceAnswered = useMemo(
    () => diligenceQuestions.filter((q) => (dueDiligence[q.key] ?? '').trim()).length,
    [dueDiligence, diligenceQuestions],
  )
  const pipelineStages = framework?.pipeline_stages ?? []
  const tiers = framework?.tiers ?? []

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateInvestorNorthstar(investor.id, {
        investor_type: category || null,
        northstar_tier: tier ? (parseInt(tier, 10) as NorthstarTier) : null,
        northstar_pipeline_stage: stage,
        northstar_probability: probability ? parseInt(probability, 10) : null,
        northstar_warm_intro: warmIntro === 'unknown' ? null : warmIntro === 'yes',
        northstar_last_contact_at: lastContact ? new Date(lastContact).toISOString() : null,
        northstar_next_step: nextStep.trim() || null,
        northstar_scorecard: scorecard,
        northstar_category_fields: categoryFields,
        northstar_due_diligence: dueDiligence,
      })
      toast.success('Northstar profile saved')
      onUpdated?.()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddMeeting = async () => {
    if (!investor.company_id) return
    try {
      const meeting = await createInvestorMeeting({
        investor_id: investor.id,
        company_id: investor.company_id,
        meeting_date: meetingForm.meeting_date || null,
        attendees: meetingForm.attendees || null,
        key_discussion_points: meetingForm.key_discussion_points || null,
        questions_asked: meetingForm.questions_asked || null,
        concerns_raised: meetingForm.concerns_raised || null,
        follow_up_items: meetingForm.follow_up_items || null,
        overall_impression: meetingForm.overall_impression || null,
        likelihood_of_investment: meetingForm.likelihood_of_investment || null,
        next_meeting_date: meetingForm.next_meeting_date || null,
      })
      setMeetings((prev) => [meeting, ...prev])
      setMeetingForm({
        meeting_date: '',
        attendees: '',
        key_discussion_points: '',
        questions_asked: '',
        concerns_raised: '',
        follow_up_items: '',
        overall_impression: '',
        likelihood_of_investment: '',
        next_meeting_date: '',
      })
      setMeetingFormOpen(false)
      toast.success('Meeting note added')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add meeting')
    }
  }

  if (!framework) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const tierNum = tier ? parseInt(tier, 10) : null

  return (
    <div className="space-y-4 pb-20">
      {/* At-a-glance summary */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-4 py-3">
        <Badge variant="outline" className={cn('text-xs', stageBadgeClass(stage))}>
          {pipelineStageLabel(stage, pipelineStages)}
        </Badge>
        {tierNum != null && (
          <Badge variant="outline" className={cn('text-xs', tierBadgeClass(tierNum))}>
            {tierLabel(tierNum, tiers)}
          </Badge>
        )}
        {scoreTotal > 0 && (
          <Badge variant="secondary" className="text-xs tabular-nums">
            <Star className="w-3 h-3 mr-1 text-amber-500" />
            {scoreTotal}/{framework.scorecard_max}
          </Badge>
        )}
        {warmIntro === 'yes' && (
          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
            Warm intro
          </Badge>
        )}
        {nextStep.trim() && (
          <span className="text-xs text-muted-foreground ml-auto max-w-[240px] truncate">
            Next: {nextStep}
          </span>
        )}
      </div>

      {/* Pipeline — always visible */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline & ranking</CardTitle>
          <CardDescription>Category, tier, stage, and outreach tracking.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Investor category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {typeProfiles.map((p) => (
                  <SelectItem key={p.id} value={p.type}>
                    {p.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Visual pipeline stage picker */}
          <div className="space-y-2">
            <Label>Pipeline stage</Label>
            <div className="flex flex-wrap gap-1.5">
              {pipelineStages.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStage(s.value)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    stage === s.value
                      ? cn('font-medium', stageBadgeClass(s.value))
                      : 'border-border text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label>Internal tier</Label>
              <Select value={tier || 'none'} onValueChange={(v) => setTier(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not set</SelectItem>
                  {tiers.map((t) => (
                    <SelectItem key={t.value} value={String(t.value)}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Probability (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                placeholder="0–100"
              />
            </div>
            <div className="space-y-2">
              <Label>Warm introduction</Label>
              <Select value={warmIntro} onValueChange={setWarmIntro}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">Unknown</SelectItem>
                  <SelectItem value="yes">Available</SelectItem>
                  <SelectItem value="no">Not available</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Last contact</Label>
              <Input type="date" value={lastContact} onChange={(e) => setLastContact(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Next step</Label>
              <Input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="e.g. Request intro via John"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collapsible detail sections */}
      <Accordion
        type="multiple"
        defaultValue={['scorecard', 'category']}
        className="space-y-2"
      >
        {categoryFieldKeys.length > 0 && (
          <AccordionItem value="category" className="rounded-lg border px-4 bg-card">
            <AccordionTrigger className="py-3 hover:no-underline">
              <div className="flex items-center gap-2 text-left">
                <span className="text-sm font-medium">Category notes</span>
                <span className="text-xs text-muted-foreground font-normal">
                  {category || 'General fields'}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-3 sm:grid-cols-2 pb-2">
                {categoryFieldKeys.map((key) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs">{NORTHSTAR_CATEGORY_FIELD_LABELS[key] ?? key}</Label>
                    <Input
                      value={categoryFields[key] ?? ''}
                      onChange={(e) => setCategoryFields((p) => ({ ...p, [key]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        <AccordionItem value="scorecard" className="rounded-lg border px-4 bg-card">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium">Ideal investor scorecard</span>
              </div>
              <Badge variant="secondary" className="text-xs tabular-nums shrink-0">
                {scoredCriteriaCount}/{framework.scorecard_criteria.length} · {scoreTotal}/{framework.scorecard_max}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <div className="flex items-center gap-3">
                <Progress value={scorecardPercent(scoreTotal, framework.scorecard_max)} className="h-2 flex-1" />
                <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{scoreTotal}</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {framework.scorecard_criteria.map((c) => (
                  <div key={c.key} className="space-y-1.5">
                    <Label className="text-xs">{c.label}</Label>
                    <ScorePicker
                      value={scorecard[c.key]}
                      onChange={(v) =>
                        setScorecard((p) => {
                          const next = { ...p }
                          if (v === undefined) delete next[c.key]
                          else next[c.key] = v
                          return next
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="diligence" className="rounded-lg border px-4 bg-card">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Due diligence</span>
              </div>
              <Badge variant="outline" className="text-xs tabular-nums shrink-0">
                {diligenceAnswered}/{diligenceQuestions.length} answered
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              {diligenceQuestions.map((q, i) => (
                <div key={q.key} className="space-y-1.5">
                  <Label className="text-xs flex items-start gap-2">
                    <span className="text-muted-foreground tabular-nums shrink-0">{i + 1}.</span>
                    {q.label}
                  </Label>
                  <Textarea
                    rows={2}
                    value={dueDiligence[q.key] ?? ''}
                    onChange={(e) => setDueDiligence((p) => ({ ...p, [q.key]: e.target.value }))}
                    className="text-sm"
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="meetings" className="rounded-lg border px-4 bg-card">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-3 pr-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">Meeting notes</span>
              </div>
              <Badge variant="outline" className="text-xs tabular-nums shrink-0">
                {meetings.length} recorded
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              <Collapsible open={meetingFormOpen} onOpenChange={setMeetingFormOpen}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                    <MessageSquarePlus className="w-4 h-4 mr-2" />
                    Add meeting note
                    <ChevronDown
                      className={cn(
                        'w-4 h-4 ml-2 transition-transform',
                        meetingFormOpen && 'rotate-180',
                      )}
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3">
                  <div className="grid gap-3 sm:grid-cols-2 rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-1.5">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        value={meetingForm.meeting_date}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, meeting_date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Attendees</Label>
                      <Input
                        value={meetingForm.attendees}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, attendees: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Key discussion points</Label>
                      <Textarea
                        rows={2}
                        value={meetingForm.key_discussion_points}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, key_discussion_points: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Questions asked</Label>
                      <Textarea
                        rows={2}
                        value={meetingForm.questions_asked}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, questions_asked: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Concerns raised</Label>
                      <Textarea
                        rows={2}
                        value={meetingForm.concerns_raised}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, concerns_raised: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Follow-up items</Label>
                      <Textarea
                        rows={2}
                        value={meetingForm.follow_up_items}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, follow_up_items: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Overall impression</Label>
                      <Textarea
                        rows={2}
                        value={meetingForm.overall_impression}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, overall_impression: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Likelihood of investment</Label>
                      <Input
                        value={meetingForm.likelihood_of_investment}
                        onChange={(e) =>
                          setMeetingForm((p) => ({ ...p, likelihood_of_investment: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Next meeting date</Label>
                      <Input
                        type="date"
                        value={meetingForm.next_meeting_date}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, next_meeting_date: e.target.value }))}
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-2">
                      <Button type="button" size="sm" onClick={handleAddMeeting}>
                        <Plus className="w-4 h-4 mr-1" />
                        Save meeting
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMeetingFormOpen(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {meetingsLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : meetings.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No meeting notes yet. Add one above after your first conversation.
                </p>
              ) : (
                <div className="space-y-3">
                  {meetings.map((m) => (
                    <div key={m.id} className="rounded-lg border p-4 text-sm space-y-2 hover:bg-muted/20 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {m.meeting_date
                              ? new Date(m.meeting_date).toLocaleDateString(undefined, {
                                  weekday: 'short',
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : 'Undated meeting'}
                          </p>
                          {m.attendees && (
                            <p className="text-xs text-muted-foreground mt-0.5">{m.attendees}</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            await deleteInvestorMeeting(m.id)
                            setMeetings((prev) => prev.filter((x) => x.id !== m.id))
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      {m.key_discussion_points && (
                        <>
                          <Separator />
                          <p className="text-sm">{m.key_discussion_points}</p>
                        </>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {m.overall_impression && (
                          <span>
                            <span className="font-medium text-foreground/80">Impression:</span>{' '}
                            {m.overall_impression}
                          </span>
                        )}
                        {m.likelihood_of_investment && (
                          <span>
                            <span className="font-medium text-foreground/80">Likelihood:</span>{' '}
                            {m.likelihood_of_investment}
                          </span>
                        )}
                        {m.follow_up_items && (
                          <span>
                            <span className="font-medium text-foreground/80">Follow-up:</span>{' '}
                            {m.follow_up_items}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-4 py-3 md:pl-[var(--sidebar-width,0px)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground hidden sm:block">
            {tierLabel(tierNum, tiers)} · {pipelineStageLabel(stage, pipelineStages)}
            {scoreTotal > 0 && ` · Score ${scoreTotal}/${framework.scorecard_max}`}
          </p>
          <Button onClick={handleSave} disabled={saving} className="ml-auto sm:ml-0">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Northstar profile
          </Button>
        </div>
      </div>
    </div>
  )
}
