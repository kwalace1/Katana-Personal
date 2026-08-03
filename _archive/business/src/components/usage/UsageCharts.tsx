// Chart bodies for the usage dashboard. Each is a pure function of the
// (already range-filtered) rows plus the current theme. Colors are applied as
// explicit fills from the validated categorical palette (see palette.ts).
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  distinctDates,
  pivotByDayModel,
  tokenBreakdownByDay,
  topModelNames,
  usageTypeByDay,
  formatUsd,
  formatCompact,
  OTHER_LABEL,
  type UsageMetric,
  type UsageRow,
} from '@/lib/usage-analytics-api'
import { buildModelSeries, seriesColor } from './palette'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDateTick(d: string): string {
  const parts = d.split('-')
  if (parts.length !== 3) return d
  const m = Number(parts[1]) - 1
  return `${MONTHS[m] ?? ''} ${Number(parts[2])}`
}

type ValueFormat = 'usd' | 'compact'
function fmt(v: number, kind: ValueFormat): string {
  return kind === 'usd' ? formatUsd(v) : formatCompact(v)
}

/** Surface-colored hairline between stacked segments / adjacent bars (the 2px gap). */
const GAP_STROKE = 'hsl(var(--background))'

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipProps {
  active?: boolean
  payload?: Array<{ name?: string; value?: number; color?: string; dataKey?: string }>
  label?: string
  valueKind: ValueFormat
  labelMap?: Record<string, string>
  hideZero?: boolean
}

function UsageTooltip({ active, payload, label, valueKind, labelMap, hideZero }: TooltipProps) {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => (hideZero ? (p.value ?? 0) > 0 : true))
  if (!items.length) return null
  const total = items.reduce((s, p) => s + (p.value ?? 0), 0)
  return (
    <div className="min-w-[10rem] rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
      <div className="mb-1 font-medium">{label ? formatDateTick(label) : ''}</div>
      <div className="grid gap-1">
        {items.map((p, i) => {
          const name = labelMap?.[p.dataKey ?? p.name ?? ''] ?? p.name ?? p.dataKey ?? ''
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: p.color }} />
                <span className="text-muted-foreground">{name}</span>
              </span>
              <span className="font-mono tabular-nums text-foreground">{fmt(p.value ?? 0, valueKind)}</span>
            </div>
          )
        })}
        {items.length > 1 && (
          <div className="mt-0.5 flex items-center justify-between gap-3 border-t border-border/50 pt-1">
            <span className="text-muted-foreground">Total</span>
            <span className="font-mono tabular-nums font-medium text-foreground">{fmt(total, valueKind)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const AXIS_TICK = { fontSize: 11 }
const CHART_CLASS = 'h-[240px] w-full'

function commonAxes(valueKind: ValueFormat) {
  return (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border/40" />
      <XAxis dataKey="date" tickFormatter={formatDateTick} tickLine={false} axisLine={false} tick={AXIS_TICK} minTickGap={16} />
      <YAxis
        tickFormatter={(v: number) => fmt(v, valueKind)}
        tickLine={false}
        axisLine={false}
        tick={AXIS_TICK}
        width={valueKind === 'usd' ? 56 : 44}
      />
    </>
  )
}

// ---------------------------------------------------------------------------
// Spend over time (single series area)
// ---------------------------------------------------------------------------

export function SpendOverTimeChart({ rows, isDark }: { rows: UsageRow[]; isDark: boolean }) {
  const data = usageTypeByDay(rows).map((d) => ({ date: d.date, spend: d.paid }))
  const color = seriesColor(0, isDark)
  const config: ChartConfig = { spend: { label: 'Spend', color } }
  return (
    <ChartContainer config={config} className={CHART_CLASS}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        {commonAxes('usd')}
        <Area
          type="monotone"
          dataKey="spend"
          stroke={color}
          strokeWidth={2}
          fill="url(#spendFill)"
          activeDot={{ r: 4 }}
          isAnimationActive={false}
        />
        <TooltipShim valueKind="usd" />
      </AreaChart>
    </ChartContainer>
  )
}

// Recharts <Tooltip> wrapped so we can pass our custom content without threading
// the (heavy) Tooltip prop types through every chart.
function TooltipShim(props: { valueKind: ValueFormat; labelMap?: Record<string, string>; hideZero?: boolean }) {
  return (
    <RTooltip
      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
      content={({ active, payload, label }: any) => (
        <UsageTooltip
          active={active}
          payload={payload}
          label={label as string}
          valueKind={props.valueKind}
          labelMap={props.labelMap}
          hideZero={props.hideZero}
        />
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// Stacked bar by model (metric-switchable)
// ---------------------------------------------------------------------------

export function StackedByModelChart({
  rows,
  isDark,
  metric,
}: {
  rows: UsageRow[]
  isDark: boolean
  metric: UsageMetric
}) {
  const models = topModelNames(rows, metric)
  const { series, config } = buildModelSeries(models, isDark, OTHER_LABEL)
  const data = pivotByDayModel(rows, metric, models)
  const labelMap = Object.fromEntries(series.map((s) => [s.key, s.label]))
  const valueKind: ValueFormat = metric === 'usage' ? 'usd' : 'compact'
  return (
    <ChartContainer config={config} className={CHART_CLASS}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        {commonAxes(valueKind)}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            stackId="m"
            fill={s.color}
            stroke={GAP_STROKE}
            strokeWidth={0.5}
            radius={i === series.length - 1 ? [3, 3, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
        <TooltipShim valueKind={valueKind} labelMap={labelMap} hideZero />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Token breakdown (prompt / completion / reasoning)
// ---------------------------------------------------------------------------

export function TokenBreakdownChart({ rows, isDark }: { rows: UsageRow[]; isDark: boolean }) {
  const data = tokenBreakdownByDay(rows)
  const config: ChartConfig = {
    prompt: { label: 'Prompt', color: seriesColor(0, isDark) },
    completion: { label: 'Completion', color: seriesColor(1, isDark) },
    reasoning: { label: 'Reasoning', color: seriesColor(2, isDark) },
  }
  const labelMap = { prompt: 'Prompt', completion: 'Completion', reasoning: 'Reasoning' }
  const keys: Array<keyof typeof labelMap> = ['prompt', 'completion', 'reasoning']
  return (
    <ChartContainer config={config} className={CHART_CLASS}>
      <BarChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        {commonAxes('compact')}
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            stackId="t"
            fill={config[k].color}
            stroke={GAP_STROKE}
            strokeWidth={0.5}
            radius={i === keys.length - 1 ? [3, 3, 0, 0] : 0}
            isAnimationActive={false}
          />
        ))}
        <TooltipShim valueKind="compact" labelMap={labelMap} hideZero />
        <ChartLegend content={<ChartLegendContent />} />
      </BarChart>
    </ChartContainer>
  )
}

// ---------------------------------------------------------------------------
// Usage type — OpenRouter (paid) vs BYOK
// ---------------------------------------------------------------------------

export function UsageTypeChart({ rows, isDark }: { rows: UsageRow[]; isDark: boolean }) {
  const data = usageTypeByDay(rows)
  const paidColor = seriesColor(0, isDark)
  const byokColor = seriesColor(1, isDark)
  const config: ChartConfig = {
    paid: { label: 'OpenRouter', color: paidColor },
    byok: { label: 'BYOK', color: byokColor },
  }
  const labelMap = { paid: 'OpenRouter', byok: 'BYOK' }
  return (
    <ChartContainer config={config} className={CHART_CLASS}>
      <AreaChart data={data} margin={{ left: 4, right: 8, top: 8 }}>
        {commonAxes('usd')}
        <Area type="monotone" dataKey="paid" stackId="u" stroke={paidColor} strokeWidth={2} fill={paidColor} fillOpacity={0.25} isAnimationActive={false} />
        <Area type="monotone" dataKey="byok" stackId="u" stroke={byokColor} strokeWidth={2} fill={byokColor} fillOpacity={0.25} isAnimationActive={false} />
        <TooltipShim valueKind="usd" labelMap={labelMap} />
        <ChartLegend content={<ChartLegendContent />} />
      </AreaChart>
    </ChartContainer>
  )
}

export function hasAnyData(rows: UsageRow[]): boolean {
  return distinctDates(rows).length > 0
}
