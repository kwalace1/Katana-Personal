import { useState } from 'react'
import { ChevronDown, ChevronRight, Filter } from 'lucide-react'
import { KYI_SIGNAL_LABELS } from '@/lib/kyi-api'

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  green: 'bg-green-500/15 text-green-400 border-green-500/30',
  orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  red: 'bg-red-500/15 text-red-400 border-red-500/30',
  gray: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  indigo: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  teal: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  rose: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  sky: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  amber: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
}

interface SignalBadgesProps {
  signals?: Record<string, unknown>
  maxVisible?: number
}

export function SignalBadges({ signals, maxVisible = 5 }: SignalBadgesProps) {
  if (!signals) return null

  const activeSignals = Object.entries(signals)
    .filter(([key, val]) => val === true && key in KYI_SIGNAL_LABELS)
    .map(([key]) => ({ key, ...KYI_SIGNAL_LABELS[key] }))

  if (activeSignals.length === 0) return null

  const visible = activeSignals.slice(0, maxVisible)
  const remaining = activeSignals.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {visible.map((s) => (
        <span
          key={s.key}
          className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${COLOR_MAP[s.color] || COLOR_MAP.gray}`}
          title={`${s.category}: ${s.label}`}
        >
          {s.label}
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium bg-muted text-muted-foreground border-border"
          title={activeSignals
            .slice(maxVisible)
            .map((s) => s.label)
            .join(', ')}
        >
          +{remaining}
        </span>
      )}
    </div>
  )
}

interface SignalFilterProps {
  selectedSignals: Set<string>
  availableSignals?: Set<string>
  options?: Array<{ key: string; label: string; category: string; color: string; count?: number }>
  onToggle: (signal: string) => void
  onClear: () => void
}

export function SignalFilter({ selectedSignals, availableSignals, options, onToggle, onClear }: SignalFilterProps) {
  const [expanded, setExpanded] = useState(false)

  const categories = new Map<string, Array<{ key: string; label: string; color: string; count?: number }>>()
  const sourceOptions =
    options ??
    Object.entries(KYI_SIGNAL_LABELS).map(([key, meta]) => ({
      key,
      label: meta.label,
      category: meta.category,
      color: meta.color,
      count: undefined as number | undefined,
    }))
  for (const opt of sourceOptions) {
    if (availableSignals && !availableSignals.has(opt.key)) continue
    if (!categories.has(opt.category)) categories.set(opt.category, [])
    categories.get(opt.category)!.push({ key: opt.key, label: opt.label, color: opt.color, count: opt.count })
  }

  return (
    <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          Filter by data source
          {selectedSignals.size > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {selectedSignals.size}
            </span>
          )}
        </span>
        <span className="flex items-center gap-2">
          {selectedSignals.size > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Clear all
            </span>
          )}
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
          {categories.size === 0 && (
            <p className="text-xs text-muted-foreground col-span-full">
              No data sources found in the currently loaded leads.
            </p>
          )}
          {Array.from(categories.entries()).map(([category, signals]) => (
            <div key={category}>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">
                {category}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {signals.map((s) => {
                  const active = selectedSignals.has(s.key)
                  return (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => onToggle(s.key)}
                      className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                        active
                          ? `${COLOR_MAP[s.color] || COLOR_MAP.gray} shadow-sm`
                          : 'bg-muted/30 text-muted-foreground border-border/60 hover:bg-muted/60 hover:border-border'
                      }`}
                    >
                      {s.label}
                      {typeof s.count === 'number' && (
                        <span className="ml-1 text-[10px] opacity-75">({s.count})</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
