import { useState, useEffect, useCallback, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  computeProfileCompleteness,
  getOnboardingPrompts,
  type CompletenessField,
  type CompletenessResult,
  type SkippedFieldPrompt,
} from '@/lib/profile-completeness'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Check,
  UserCircle,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Activity,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { ProfileEditDialog } from '@/components/onboarding/profile-edit-dialog'
import type { HubKpi } from '@/components/hub/HubDashboardTop'
import type { HubLayoutClasses } from '@/lib/hub-settings'

const PROFILE_FIELD_KEYS = new Set(['full_name', 'avatar_url', 'department', 'job_title'])

async function loadOrgSettingsForCompleteness(
  organizationId: string | undefined
): Promise<Record<string, unknown> | null> {
  if (!organizationId) return null
  const { data } = await supabase
    .from('organizations')
    .select('settings, name')
    .eq('id', organizationId)
    .single()
  if (data?.name && data.name !== 'My Organization') {
    const settings = (data.settings as Record<string, unknown>) ?? {}
    return { ...settings, _hasName: true }
  }
  return null
}

function getScoreStyles(score: number) {
  if (score >= 80) return { text: 'text-green-600', progress: '[&>div]:bg-green-500' }
  if (score >= 50) return { text: 'text-yellow-600', progress: '[&>div]:bg-yellow-500' }
  return { text: 'text-orange-600', progress: '[&>div]:bg-orange-500' }
}

function SetupStep({
  field,
  status,
  connectorComplete,
  isLast,
  onSelect,
}: {
  field: CompletenessField
  status: 'complete' | 'current' | 'upcoming'
  connectorComplete: boolean
  isLast: boolean
  onSelect: (field: CompletenessField) => void
}) {
  const clickable = !field.filled
  return (
    <div className="flex items-start flex-1 min-w-0">
      <div className="flex flex-col items-center flex-1 gap-2 min-w-[5.25rem] max-w-[6.5rem] px-1">
        <button
          type="button"
          disabled={!clickable}
          onClick={() => clickable && onSelect(field)}
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
            status === 'complete' && 'border-green-500 bg-green-500/10 text-green-600',
            status === 'current' && 'border-primary bg-primary/10 text-primary ring-2 ring-primary/25',
            status === 'upcoming' && 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
            clickable && 'cursor-pointer hover:border-primary/60 hover:bg-primary/5',
            !clickable && 'cursor-default'
          )}
        >
          {status === 'complete' ? (
            <Check className="h-5 w-5" strokeWidth={2.5} />
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-current opacity-60" />
          )}
        </button>
        <span
          className={cn(
            'text-center text-[11px] leading-snug break-words w-full',
            status === 'complete' && 'text-muted-foreground line-through',
            status === 'current' && 'font-medium text-foreground',
            status === 'upcoming' && 'text-muted-foreground'
          )}
        >
          {field.label}
        </span>
      </div>
      {!isLast && (
        <div
          className={cn(
            'mt-5 h-0.5 flex-1 min-w-4 mx-1 rounded-full',
            connectorComplete ? 'bg-green-500/70' : 'bg-border'
          )}
        />
      )}
    </div>
  )
}

interface HubProfileSetupSectionProps {
  forceVisible?: boolean
}

export function HubProfileSetupSection({ forceVisible = false }: HubProfileSetupSectionProps) {
  const { profile, organization } = useAuth()
  const navigate = useNavigate()
  const [result, setResult] = useState<CompletenessResult | null>(null)
  const [prompts, setPrompts] = useState<SkippedFieldPrompt[]>([])
  const [setupLoading, setSetupLoading] = useState(true)
  const [profileEditOpen, setProfileEditOpen] = useState(false)

  const loadSetup = useCallback(async () => {
    setSetupLoading(true)
    try {
      const orgSettings = await loadOrgSettingsForCompleteness(organization?.id)
      setResult(computeProfileCompleteness(profile, orgSettings))
      setPrompts(getOnboardingPrompts(profile, orgSettings))
    } finally {
      setSetupLoading(false)
    }
  }, [profile, organization?.id])

  useEffect(() => {
    void loadSetup()
  }, [loadSetup])

  const handleFieldSelect = (field: CompletenessField) => {
    if (PROFILE_FIELD_KEYS.has(field.key) || field.route === '/settings/organization') {
      setProfileEditOpen(true)
    } else {
      navigate(field.route)
    }
  }

  const showProfileSetup = setupLoading || !result || result.score < 100 || prompts.length > 0
  if (!showProfileSetup && !forceVisible) return null

  const { text: scoreColor, progress: progressColor } = result
    ? getScoreStyles(result.score)
    : { text: '', progress: '' }
  const firstIncompleteKey = result?.missingFields[0]?.key ?? null

  return (
    <>
      <Card data-testid="hub-profile-setup" data-tour="hub-profile-setup">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-primary" />
              Profile Setup
            </CardTitle>
            {setupLoading ? (
              <span className="text-sm text-muted-foreground">Loading…</span>
            ) : result ? (
              <span className={cn('text-2xl font-bold tabular-nums shrink-0', scoreColor)}>
                {result.score}%
              </span>
            ) : forceVisible ? (
              <span className="text-sm text-muted-foreground">Complete</span>
            ) : null}
          </div>
        </CardHeader>
        {!setupLoading && result ? (
          <CardContent className="space-y-5">
            <Progress value={result.score} className={cn('h-2', progressColor)} />
            {prompts.length > 0 && (
              <div className="space-y-2">
                {prompts.slice(0, 3).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      if (p.id.startsWith('profile-')) setProfileEditOpen(true)
                      else navigate(p.route)
                    }}
                    className="w-full text-left rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-2 text-sm hover:bg-orange-500/10 transition-colors"
                  >
                    {p.message}
                  </button>
                ))}
              </div>
            )}
            <div className="overflow-x-auto pb-1 -mx-1 px-1">
              <div className="flex w-full min-w-[40rem] gap-0.5">
                {result.fields.map((field, index) => {
                  const status = field.filled
                    ? 'complete'
                    : field.key === firstIncompleteKey
                      ? 'current'
                      : 'upcoming'
                  return (
                    <SetupStep
                      key={field.key}
                      field={field}
                      status={status}
                      connectorComplete={field.filled}
                      isLast={index === result.fields.length - 1}
                      onSelect={handleFieldSelect}
                    />
                  )
                })}
              </div>
            </div>
          </CardContent>
        ) : forceVisible ? (
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Your profile setup is complete. Hide this section if you don&apos;t need it on your hub.
            </p>
          </CardContent>
        ) : null}
      </Card>
      <ProfileEditDialog
        open={profileEditOpen}
        onOpenChange={(open) => {
          setProfileEditOpen(open)
          if (!open) void loadSetup()
        }}
      />
    </>
  )
}

interface HubPerformanceOverviewSectionProps {
  performancePreview: { label: string; value: string }[]
  performanceExpandedContent: ReactNode
  performanceProgress: { label: string; value: number; displayValue: string }[]
  emptyPerformanceMessage?: string
  layoutClasses?: Pick<HubLayoutClasses, 'performanceMetricGrid' | 'performanceMetricValue'>
}

export function HubPerformanceOverviewSection({
  performancePreview,
  performanceExpandedContent,
  performanceProgress,
  emptyPerformanceMessage = 'No performance metrics for your assigned modules yet.',
  layoutClasses,
}: HubPerformanceOverviewSectionProps) {
  const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false)
  const previewGrid = layoutClasses?.performanceMetricGrid ?? 'grid grid-cols-2 gap-3'
  const previewValue = cn(layoutClasses?.performanceMetricValue ?? 'text-lg', 'font-semibold')

  return (
    <Collapsible open={isPerformanceExpanded} onOpenChange={setIsPerformanceExpanded} data-tour="hub-performance">
      <Card className="hover:shadow-lg transition-shadow">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-5 w-5 text-primary" />
                Performance Overview
              </CardTitle>
              {isPerformanceExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isPerformanceExpanded ? 'Click to collapse' : 'Click to view performance metrics'}
            </p>
            {!isPerformanceExpanded && (
              <div className={cn('mt-3 pt-3 border-t', previewGrid)}>
                {performancePreview.length > 0 ? (
                  performancePreview.map((item) => (
                    <div key={item.label}>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className={previewValue}>{item.value}</div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-muted-foreground">{emptyPerformanceMessage}</p>
                )}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {performanceExpandedContent}
            {performanceProgress.length > 0 ? (
              <div className="space-y-4 pt-4 border-t">
                {performanceProgress.map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="font-medium">{item.displayValue}</span>
                    </div>
                    <Progress value={item.value} className="h-2" />
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

interface HubKeyMetricsSectionProps {
  kpis: HubKpi[]
  emptyKpiMessage?: string
  layoutClasses?: Pick<HubLayoutClasses, 'kpiGrid' | 'kpiValue'>
}

export function HubKeyMetricsSection({
  kpis,
  emptyKpiMessage = 'No key metrics for your assigned modules yet.',
  layoutClasses,
}: HubKeyMetricsSectionProps) {
  const [isKpisExpanded, setIsKpisExpanded] = useState(false)
  const previewGrid = layoutClasses?.kpiGrid ?? 'grid grid-cols-2 gap-3'
  const previewValue = cn(layoutClasses?.kpiValue ?? 'text-lg', 'font-semibold')
  const expandedGrid = layoutClasses?.kpiGrid ?? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
  const expandedValue = cn(layoutClasses?.kpiValue ?? 'text-2xl', 'font-bold')

  return (
    <Collapsible open={isKpisExpanded} onOpenChange={setIsKpisExpanded} data-tour="hub-kpis">
      <Card className="hover:shadow-lg transition-shadow">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Activity className="h-5 w-5 text-primary" />
                Key Metrics
              </CardTitle>
              {isKpisExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isKpisExpanded ? 'Click to collapse' : 'Click to view all metrics'}
            </p>
            {!isKpisExpanded && (
              <div className={cn('mt-3 pt-3 border-t', previewGrid)}>
                {kpis.length > 0 ? (
                  kpis.slice(0, 2).map((kpi) => (
                    <div key={kpi.title}>
                      <div className="text-xs text-muted-foreground">{kpi.title}</div>
                      <div className={previewValue}>{kpi.value}</div>
                    </div>
                  ))
                ) : (
                  <p className="col-span-2 text-xs text-muted-foreground">{emptyKpiMessage}</p>
                )}
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {kpis.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyKpiMessage}</p>
            ) : (
              <div className={expandedGrid}>
                {kpis.map((kpi, index) => {
                  const Icon = kpi.icon as ComponentType<{ className?: string }>
                  return (
                    <Card key={index} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Icon className={`h-5 w-5 ${kpi.color}`} />
                          <div className="flex items-center gap-1 text-sm">
                            {kpi.trendUp ? (
                              <TrendingUp className="h-3 w-3 text-green-500" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-500" />
                            )}
                            <span className={kpi.trendUp ? 'text-green-500' : 'text-red-500'}>
                              {kpi.trend}
                            </span>
                          </div>
                        </div>
                        <div className={cn('mb-1', expandedValue)}>{kpi.value}</div>
                        <div className="text-xs text-muted-foreground">{kpi.title}</div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
