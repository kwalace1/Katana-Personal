// Categorical chart palette for the usage dashboard.
//
// These are the dataviz skill's validated reference hues — the slot ORDER is the
// colorblind-safety mechanism (worst adjacent CVD ΔE 9.1 light / 8.4 dark), so
// assign in order and never cycle. Beyond MAX_SERIES models fold into "Other".
//
// We apply colors as explicit `fill`/`stroke` on each mark (not via the shadcn
// `--color-<key>` CSS var) because model names contain "/" and "." which are
// illegal in CSS custom-property references.
import type { ChartConfig } from '@/components/ui/chart'

export const CATEGORICAL_LIGHT = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

export const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]

/** Neutral gray for the folded "Other" bucket — recedes, never competes. */
export const OTHER_COLOR = '#898781'

export function paletteFor(isDark: boolean): string[] {
  return isDark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

/** Color for categorical slot `i` (0-based). Slots past the palette reuse gray. */
export function seriesColor(i: number, isDark: boolean): string {
  const p = paletteFor(isDark)
  return i < p.length ? p[i] : OTHER_COLOR
}

/** Drop the vendor prefix for compact labels: "anthropic/claude-sonnet-4.5" → "claude-sonnet-4.5". */
export function prettyModel(model: string): string {
  const slash = model.lastIndexOf('/')
  return slash >= 0 ? model.slice(slash + 1) : model
}

export interface Series {
  key: string // data key (may be a raw model name)
  label: string
  color: string
}

/**
 * Build ordered series descriptors + a matching ChartConfig (keyed by data key,
 * carrying pretty labels for the tooltip/legend). `otherKey`, when present, is
 * appended in neutral gray.
 */
export function buildModelSeries(
  models: string[],
  isDark: boolean,
  otherKey?: string,
): { series: Series[]; config: ChartConfig } {
  const series: Series[] = models.map((m, i) => ({
    key: m,
    label: prettyModel(m),
    color: seriesColor(i, isDark),
  }))
  if (otherKey) series.push({ key: otherKey, label: otherKey, color: OTHER_COLOR })

  const config: ChartConfig = {}
  for (const s of series) config[s.key] = { label: s.label, color: s.color }
  return { series, config }
}
