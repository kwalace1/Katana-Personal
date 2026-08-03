// Presentational pieces for the usage dashboard: stat tiles, segmented controls,
// ranked tables, trending list, and the key-config banner.
import { ArrowDownRight, ArrowUpRight, KeyRound, Minus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import {
  formatCompact,
  formatInt,
  formatUsd,
  type ModelRank,
  type ModelTrend,
  type ProviderRank,
  type RangeDays,
  type UsageMetric,
  RANGE_LABELS,
} from '@/lib/usage-analytics-api'
import { prettyModel, seriesColor, OTHER_COLOR } from './palette'

// ---------------------------------------------------------------------------
// Stat tile
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  sub,
  deltaPct,
}: {
  label: string
  value: string
  sub?: string
  deltaPct?: number | null
}) {
  const showDelta = deltaPct !== undefined && deltaPct !== null && Number.isFinite(deltaPct)
  const up = (deltaPct ?? 0) >= 0
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {showDelta ? (
          <span className={cn('inline-flex items-center gap-0.5', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400')}>
            {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(deltaPct as number).toFixed(1)}%
          </span>
        ) : null}
        {sub ? <span>{sub}</span> : showDelta ? <span>vs prev period</span> : null}
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Segmented controls
// ---------------------------------------------------------------------------

export function RangeControl({
  value,
  onChange,
  options,
}: {
  value: RangeDays
  onChange: (v: RangeDays) => void
  options: RangeDays[]
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={String(value)}
      onValueChange={(v) => v && onChange(Number(v) as RangeDays)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o}
          value={String(o)}
          aria-label={o === 1 ? 'Last 24 hours' : `Last ${o} days`}
        >
          {RANGE_LABELS[o]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

const METRIC_LABELS: Record<UsageMetric, string> = {
  usage: 'Spend',
  requests: 'Requests',
  tokens: 'Tokens',
}

export function MetricControl({
  value,
  onChange,
}: {
  value: UsageMetric
  onChange: (v: UsageMetric) => void
}) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(v) => v && onChange(v as UsageMetric)}
    >
      {(Object.keys(METRIC_LABELS) as UsageMetric[]).map((m) => (
        <ToggleGroupItem key={m} value={m}>
          {METRIC_LABELS[m]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}

// ---------------------------------------------------------------------------
// Ranked model table (with color swatches + share bars)
// ---------------------------------------------------------------------------

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: color }} />
}

export function ModelRankTable({
  ranks,
  isDark,
  limit = 10,
}: {
  ranks: ModelRank[]
  isDark: boolean
  limit?: number
}) {
  const shown = ranks.slice(0, limit)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Model</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Requests</TableHead>
          <TableHead className="text-right">Tokens</TableHead>
          <TableHead className="text-right">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((m, i) => (
          <TableRow key={m.model}>
            <TableCell className="max-w-[220px]">
              <span className="flex items-center gap-2">
                <Swatch color={i < limit ? seriesColor(i, isDark) : OTHER_COLOR} />
                <span className="truncate" title={m.model}>{prettyModel(m.model)}</span>
              </span>
            </TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatUsd(m.spend)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatInt(m.requests)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatCompact(m.tokens)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
              {(m.share * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Provider ranked table
// ---------------------------------------------------------------------------

export function ProviderRankTable({ ranks }: { ranks: ProviderRank[] }) {
  const shown = ranks.slice(0, 8)
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Provider</TableHead>
          <TableHead className="text-right">Spend</TableHead>
          <TableHead className="text-right">Share</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((p) => (
          <TableRow key={p.provider}>
            <TableCell className="truncate" title={p.provider}>{p.provider}</TableCell>
            <TableCell className="text-right font-mono tabular-nums">{formatUsd(p.spend)}</TableCell>
            <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
              {(p.share * 100).toFixed(1)}%
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

// ---------------------------------------------------------------------------
// Trending models
// ---------------------------------------------------------------------------

export function TrendingModels({ trends }: { trends: ModelTrend[] }) {
  const shown = trends.slice(0, 8)
  if (!shown.length) return <p className="text-sm text-muted-foreground">Not enough history to compare.</p>
  return (
    <div className="space-y-1">
      {shown.map((t) => (
        <div key={t.model} className="flex items-center justify-between gap-3 py-1.5">
          <span className="min-w-0 truncate text-sm" title={t.model}>{prettyModel(t.model)}</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-sm tabular-nums">{formatUsd(t.current)}</span>
            {t.isNew ? (
              <Badge variant="secondary" className="text-emerald-600 dark:text-emerald-400">New</Badge>
            ) : t.deltaPct === null ? (
              <span className="inline-flex w-14 items-center justify-end text-xs text-muted-foreground">
                <Minus className="h-3 w-3" />
              </span>
            ) : (
              <span
                className={cn(
                  'inline-flex w-14 items-center justify-end gap-0.5 text-xs tabular-nums',
                  t.deltaPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400',
                )}
              >
                {t.deltaPct >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(t.deltaPct).toFixed(0)}%
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Key-config banner (shown when OpenRouter rejects the key or none is set)
// ---------------------------------------------------------------------------

export function KeyBanner({ status, message }: { status: 'key_unauthorized' | 'no_key'; message?: string }) {
  return (
    <Alert>
      <KeyRound />
      <AlertTitle>
        {status === 'no_key'
          ? 'No OpenRouter key configured'
          : 'A provisioning key is required for usage data'}
      </AlertTitle>
      <AlertDescription>
        <p>{message}</p>
        <p>
          Create a <span className="font-medium text-foreground">Provisioning key</span> at{' '}
          <span className="font-mono text-foreground">openrouter.ai → Settings → Provisioning Keys</span>, then add it
          as the Supabase Edge Function secret{' '}
          <span className="font-mono text-foreground">OPENROUTER_PROVISIONING_KEY</span>. The dashboard, gating and CSV
          export all work already — only the numbers wait on the key.
        </p>
      </AlertDescription>
    </Alert>
  )
}
