import { isPlusUnlocked, PLUS_FEATURE_MATRIX } from '@/lib/plus'
import { cn } from '@/lib/utils'

type Props = {
  compact?: boolean
}

export function PlusFeatureMatrix({ compact }: Props) {
  const plus = isPlusUnlocked()

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-secondary/30">
            <th className="px-3 py-2 font-medium">Feature</th>
            <th className="px-3 py-2 font-medium">Free</th>
            <th className="px-3 py-2 font-medium text-primary">Plus</th>
          </tr>
        </thead>
        <tbody>
          {PLUS_FEATURE_MATRIX.filter((row) => !compact || ['llm', 'integrations', 'orchestration_push', 'challenge', 'nutrition_ai'].includes(row.feature)).map((row) => (
            <tr key={row.feature} className="border-b border-border/40 last:border-0">
              <td className="px-3 py-2.5 font-medium">{row.label}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{row.free}</td>
              <td className={cn('px-3 py-2.5', plus && 'text-primary')}>{row.plus}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
