import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  AlertCircle,
  BarChart3,
  Download,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { MotionPage } from '@/components/motion-page'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  fetchUsageAnalytics,
  filterByRange,
  computeTotals,
  rankModels,
  rankProviders,
  trendingModels,
  splitWindows,
  pctDelta,
  usageRowsToCsv,
  downloadCsv,
  formatUsd,
  formatCompact,
  formatInt,
  RANGE_OPTIONS,
  RANGE_LABELS_LONG,
  type RangeDays,
  type UsageAnalyticsResponse,
  type UsageMetric,
} from '@/lib/usage-analytics-api'
import {
  SpendOverTimeChart,
  StackedByModelChart,
  TokenBreakdownChart,
  UsageTypeChart,
} from '@/components/usage/UsageCharts'
import {
  KeyBanner,
  MetricControl,
  ModelRankTable,
  ProviderRankTable,
  RangeControl,
  StatTile,
  TrendingModels,
} from '@/components/usage/UsagePanels'

// --- data hook ---------------------------------------------------------------

function useUsageAnalytics() {
  const [data, setData] = useState<UsageAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      setData(await fetchUsageAnalytics())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return { data, loading, refreshing, reload: () => load(true) }
}

// --- small layout helpers ----------------------------------------------------

function ChartCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  )
}

const HARD_ERRORS = new Set([
  'error',
  'openrouter_error',
  'openrouter_unreachable',
  'unauthorized',
  'forbidden',
  'not_configured',
])

// --- page --------------------------------------------------------------------

export default function UsageDashboardPage() {
  const { data, loading, refreshing, reload } = useUsageAnalytics()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [range, setRange] = useState<RangeDays>(30)
  const [modelMetric, setModelMetric] = useState<UsageMetric>('usage')

  const rows = data?.status === 'ok' ? data.rows ?? [] : []

  const view = useMemo(() => {
    const rangeRows = filterByRange(rows, range)
    const totals = computeTotals(rangeRows)
    const { previous } = splitWindows(rows, range)
    const prevTotals = computeTotals(previous)
    return {
      rangeRows,
      totals,
      deltas: {
        spend: pctDelta(totals.spend, prevTotals.spend),
        requests: pctDelta(totals.requests, prevTotals.requests),
        tokens: pctDelta(totals.totalTokens, prevTotals.totalTokens),
      },
      modelRanks: rankModels(rangeRows, 'usage'),
      providerRanks: rankProviders(rangeRows, 'usage'),
      trends: trendingModels(rows, range, 'usage'),
    }
  }, [rows, range])

  const handleExport = useCallback(() => {
    if (!rows.length) return
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsv(`katana-ai-usage-${stamp}.csv`, usageRowsToCsv(rows))
  }, [rows])

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <BarChart3 className="h-7 w-7" />
          AI Usage &amp; Credits
        </h1>
        <p className="mt-1 text-muted-foreground">
          OpenRouter credit spend across all Katana AI agents. Rolling 30-day window, daily (UTC).
        </p>
      </div>
      <div className="flex items-center gap-2">
        <RangeControl value={range} onChange={setRange} options={RANGE_OPTIONS} />
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!rows.length}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
        <Button variant="ghost" size="icon" onClick={reload} disabled={refreshing} title="Refresh">
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )

  // ---- loading ----
  if (loading && !data) {
    return (
      <MotionPage>
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {header}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </MotionPage>
    )
  }

  const status = data?.status ?? 'error'

  // ---- hard errors ----
  if (HARD_ERRORS.has(status)) {
    return (
      <MotionPage>
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {header}
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn&apos;t load usage data</AlertTitle>
            <AlertDescription>
              <p>
                {status === 'forbidden'
                  ? 'This dashboard is limited to DW Growth Capital members.'
                  : status === 'not_configured'
                    ? 'Supabase is not configured in this environment.'
                    : data?.message || 'OpenRouter or the reporting function is unavailable.'}
              </p>
              <Button variant="outline" size="sm" className="mt-2" onClick={reload}>
                <RefreshCw className="mr-1.5 h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </MotionPage>
    )
  }

  const showKeyBanner = status === 'key_unauthorized' || status === 'no_key'
  const { rangeRows, totals, deltas, modelRanks, providerRanks, trends } = view
  const hasData = rangeRows.length > 0
  const credits = data?.credits ?? null

  return (
    <MotionPage>
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        {header}

        {showKeyBanner ? (
          <KeyBanner status={status as 'key_unauthorized' | 'no_key'} message={data?.message} />
        ) : null}

        {!hasData ? (
          <Card className="p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {showKeyBanner
                ? 'Usage data will appear here once a provisioning key is configured.'
                : 'No AI usage recorded in this window.'}
            </p>
          </Card>
        ) : (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatTile label="Total spend" value={formatUsd(totals.spend)} deltaPct={deltas.spend} />
              <StatTile label="Requests" value={formatCompact(totals.requests)} deltaPct={deltas.requests} />
              <StatTile label="Token volume" value={formatCompact(totals.totalTokens)} deltaPct={deltas.tokens} />
              <StatTile
                label="Blended $/1M"
                value={formatUsd(totals.blendedPerMillion)}
                sub="per 1M tokens"
              />
              {credits ? (
                <StatTile
                  label="Credits remaining"
                  value={formatUsd(credits.remaining)}
                  sub={`${formatUsd(credits.total_usage)} used all-time`}
                />
              ) : (
                <StatTile label="BYOK spend" value={formatUsd(totals.byokSpend)} sub="own provider keys" />
              )}
            </div>

            {/* Spend over time */}
            <ChartCard
              title="Spend over time"
              description={`Daily OpenRouter spend — last ${RANGE_LABELS_LONG[range]}`}
            >
              <SpendOverTimeChart rows={rangeRows} isDark={isDark} />
            </ChartCard>

            {/* By model + usage type */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard
                title="Usage by model"
                description="Top models per day, remainder grouped as Other"
                action={<MetricControl value={modelMetric} onChange={setModelMetric} />}
              >
                <StackedByModelChart rows={rangeRows} isDark={isDark} metric={modelMetric} />
              </ChartCard>
              <ChartCard title="Usage type" description="OpenRouter (paid) vs BYOK spend">
                <UsageTypeChart rows={rangeRows} isDark={isDark} />
              </ChartCard>
            </div>

            {/* Token breakdown + trending */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Token breakdown" description="Prompt · completion · reasoning">
                <TokenBreakdownChart rows={rangeRows} isDark={isDark} />
              </ChartCard>
              <ChartCard title="Trending models" description={`Current vs previous ${RANGE_LABELS_LONG[range]}, by spend`}>
                <TrendingModels trends={trends} />
              </ChartCard>
            </div>

            {/* Ranked tables */}
            <div className="grid gap-4 lg:grid-cols-2">
              <ChartCard title="Spend by model" description={`${modelRanks.length} models in the last ${RANGE_LABELS_LONG[range]}`}>
                <ModelRankTable ranks={modelRanks} isDark={isDark} />
              </ChartCard>
              <ChartCard title="Spend by provider">
                <ProviderRankTable ranks={providerRanks} />
              </ChartCard>
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Source: OpenRouter activity &amp; credits API via the server-side <span className="font-mono">usage-analytics</span> function.
          Data is daily and reported in UTC; the current day may be incomplete.
          {data?.meta?.fetchedAt ? ` Last updated ${new Date(data.meta.fetchedAt).toLocaleString()}.` : ''}
          {refreshing ? (
            <span className="ml-1 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> refreshing…
            </span>
          ) : null}
        </p>
      </div>
    </MotionPage>
  )
}
