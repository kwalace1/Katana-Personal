import { KYC_SIGNAL_LABELS } from '@/lib/kyc-client-scoring'
import { KYC_EXTERNAL_SIGNAL_LABELS } from '@/lib/kyc-enrichment'

const ALL_SIGNAL_LABELS = { ...KYC_SIGNAL_LABELS, ...KYC_EXTERNAL_SIGNAL_LABELS }

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

interface KycSignalBadgesProps {
  signals?: Record<string, unknown>
  maxVisible?: number
  keys?: string[]
}

export function KycSignalBadges({ signals, maxVisible = 5, keys }: KycSignalBadgesProps) {
  const activeKeys =
    keys ??
    Object.entries(signals ?? {})
      .filter(([key, val]) => val === true && key in ALL_SIGNAL_LABELS)
      .map(([key]) => key)

  if (activeKeys.length === 0) return null

  const activeSignals = activeKeys.map((key) => ({ key, ...ALL_SIGNAL_LABELS[key] }))
  const visible = activeSignals.slice(0, maxVisible)
  const remaining = activeSignals.length - maxVisible

  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((s) => (
        <span
          key={s.key}
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-medium transition-colors ${COLOR_MAP[s.color] || COLOR_MAP.gray}`}
          title={`${s.category}: ${s.label}`}
        >
          {s.label}
        </span>
      ))}
      {remaining > 0 && (
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full border text-[11px] font-medium bg-muted text-muted-foreground border-border"
          title={activeSignals
            .slice(maxVisible)
            .map((s) => s.label)
            .join(', ')}
        >
          +{remaining} more
        </span>
      )}
    </div>
  )
}

export function getKycSignalColor(key: string): string {
  return COLOR_MAP[ALL_SIGNAL_LABELS[key]?.color ?? 'gray'] || COLOR_MAP.gray
}
