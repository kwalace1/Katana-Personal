import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  const isTemporal =
    type === 'date' || type === 'time' || type === 'datetime-local' || type === 'month' || type === 'week'

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground flex h-10 w-full min-w-0 rounded-full border border-white/50 bg-card/35 px-4 py-2 text-base shadow-[inset_0_1px_0_hsl(0_0%_100%/0.55)] backdrop-blur-xl transition-[color,box-shadow,background] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:border-white/10 dark:bg-card/30',
        'focus-visible:border-ring focus-visible:ring-ring/35 focus-visible:ring-[3px] focus-visible:bg-card/50',
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        // iOS/WebKit date & time controls have a huge intrinsic width; keep them inside cards.
        isTemporal &&
          'max-w-full appearance-none rounded-xl [-webkit-appearance:none] [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-date-and-time-value]:min-h-[1.5em] [&::-webkit-date-and-time-value]:text-left',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
