import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Brain, ChevronRight, LineChart, Loader2, Sparkles } from 'lucide-react'
import {
  answerRaiseIntelQuestion,
  KYI_INTEL_QUESTIONS,
  type KyiIntelAnswer,
  type KyiIntelQuestionId,
} from '@/lib/kyi-raise-intel'
import { ensureOrganizationCompany, getCompanies, type KYICompany } from '@/lib/kyi-api'
import {
  ModuleCustomizeControls,
  ModuleCustomizeHint,
} from '@/components/module-layout/ModuleCustomizeBar'
import { ModuleWidgetCanvas } from '@/components/module-layout/ModuleWidgetCanvas'
import { WidgetCatalogDialog } from '@/components/module-layout/WidgetCatalogDialog'
import { useModuleWidgetLayout } from '@/hooks/useModuleWidgetLayout'
import { getKyiSurfaceConfig, KYI_MODULE_ID } from '@/lib/kyi/kyi-widget-layout'

/**
 * Dedicated raise-intelligence surface answering the KYI 2.0 write-up questions.
 * Uses shared ecosystem + private raise profile — does not expose other orgs' CRM.
 */
export default function KYIRaiseIntelPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const surfaceConfig = getKyiSurfaceConfig('intel')
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
  const [companies, setCompanies] = useState<KYICompany[]>([])
  const [companyId, setCompanyId] = useState<number | null>(
    searchParams.get('companyId') ? Number(searchParams.get('companyId')) : null,
  )
  const [activeQ, setActiveQ] = useState<KyiIntelQuestionId>(
    (searchParams.get('q') as KyiIntelQuestionId) || 'best_match_strategy',
  )
  const [answer, setAnswer] = useState<KyiIntelAnswer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ensureOrganizationCompany()
      .then(() => getCompanies())
      .then((list) => {
        if (cancelled) return
        setCompanies(list)
        setCompanyId((prev) => {
          if (prev && list.some((c) => c.id === prev)) return prev
          const fromUrl = Number(searchParams.get('companyId'))
          if (fromUrl && list.some((c) => c.id === fromUrl)) return fromUrl
          return list[0]?.id ?? null
        })
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load companies')
      })
    return () => {
      cancelled = true
    }
  }, [searchParams])

  useEffect(() => {
    if (companyId == null) return
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('companyId', String(companyId))
        next.set('q', activeQ)
        return next
      },
      { replace: true },
    )
  }, [companyId, activeQ, setSearchParams])

  useEffect(() => {
    if (companyId == null) return
    let cancelled = false
    setLoading(true)
    setError(null)
    answerRaiseIntelQuestion(companyId, activeQ, 12)
      .then((next) => {
        if (!cancelled) setAnswer(next)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load intel')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [companyId, activeQ])

  return (
    <MotionPage className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            <Link to="/kyi" className="hover:text-foreground inline-flex items-center gap-1">
              <LineChart className="w-3.5 h-3.5" />
              Know Your Investor
            </Link>
            <span className="mx-1.5">/</span>
            Raise intelligence
          </p>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Brain className="w-7 h-7 text-primary" />
            Raise intelligence
          </h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Ask the questions from the KYI 2.0 vision — answered from the shared investor ecosystem
            using your raise profile. Other companies&apos; notes and pipeline stay private.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {companies.length > 0 && (
            <Select
              value={companyId != null ? String(companyId) : undefined}
              onValueChange={(v) => setCompanyId(Number(v))}
            >
              <SelectTrigger className="w-56">
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
          <ModuleCustomizeControls
            customizeMode={isCustomizeMode}
            onEnterCustomize={enterCustomize}
            onDone={() => void saveAndExit()}
            dataTourCustomize="kyi-intel-customize"
          />
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
          if (widgetId === 'intel_questions') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Questions</CardTitle>
                  <CardDescription className="text-xs">From the KYI 2.0 write-up</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1.5">
                  {KYI_INTEL_QUESTIONS.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setActiveQ(q.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                        activeQ === q.id
                          ? 'border-primary/40 bg-primary/10 font-medium'
                          : 'border-transparent hover:bg-muted/50 text-muted-foreground'
                      }`}
                    >
                      {q.prompt}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )
          }

          if (widgetId === 'intel_answers') {
            return (
              <Card className="h-full overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {answer?.question.prompt ??
                      KYI_INTEL_QUESTIONS.find((q) => q.id === activeQ)?.prompt}
                  </CardTitle>
                  <CardDescription>
                    {answer?.question.description ??
                      KYI_INTEL_QUESTIONS.find((q) => q.id === activeQ)?.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-8 justify-center">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Searching the ecosystem…
                    </div>
                  ) : error ? (
                    <p className="text-sm text-destructive">{error}</p>
                  ) : !answer || answer.results.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No strong matches yet. Set your raise profile (stage / sectors) on the company
                      overview, contribute investors to the ecosystem, or run the enrichment SQL to
                      deepen profiles.
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {answer.results.map((row) => (
                        <li
                          key={row.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/kyi/ecosystem/${row.id}${companyId ? `?companyId=${companyId}` : ''}`}
                              className="font-medium hover:text-primary"
                            >
                              {row.display_name}
                            </Link>
                            <p className="text-xs text-muted-foreground truncate">
                              {[row.title, row.firm, row.location].filter(Boolean).join(' · ')}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {row.match_reasons.map((r) => (
                                <Badge key={r} variant="secondary" className="text-[10px] font-normal">
                                  {r}
                                </Badge>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {row.match_score}
                            </span>
                            <Button asChild size="sm" variant="outline">
                              <Link
                                to={`/kyi/ecosystem/${row.id}${companyId ? `?companyId=${companyId}` : ''}`}
                              >
                                Open
                                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                              </Link>
                            </Button>
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
