import { cn } from '@/lib/utils'

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  full,
  size = 'sm',
  disabled,
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  className?: string
  full?: boolean
  size?: 'sm' | 'lg'
  disabled?: boolean
}) {
  const large = size === 'lg'
  return (
    <div
      role="group"
      className={cn(
        'gap-0.5 rounded-lg border border-border bg-secondary/70 p-0.5',
        full ? 'flex w-full' : 'inline-flex max-w-full flex-wrap',
        className,
      )}
    >
      {options.map((option) => {
        const selected = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled}
            onClick={() => onChange(option.id)}
            className={cn(
              'rounded-md font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
              large ? 'h-9 px-3 text-sm' : 'h-7 px-2.5 text-xs',
              full && 'min-w-0 flex-1',
              selected
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
