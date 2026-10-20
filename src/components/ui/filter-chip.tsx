import { cn } from '@/lib/utils'

export function FilterChip({
  selected,
  className,
  type = 'button',
  ...props
}: React.ComponentProps<'button'> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        'kp-chip transition-colors hover:text-foreground',
        selected && 'border-transparent bg-primary text-primary-foreground hover:text-primary-foreground',
        className,
      )}
      {...props}
    />
  )
}
