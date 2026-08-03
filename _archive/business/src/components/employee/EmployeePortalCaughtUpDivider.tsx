import { Sparkles } from 'lucide-react'

interface EmployeePortalCaughtUpDividerProps {
  newCount: number
}

export function EmployeePortalCaughtUpDivider({ newCount }: EmployeePortalCaughtUpDividerProps) {
  return (
    <div className="relative py-6" role="separator" aria-label="You're all caught up on new updates">
      <div className="absolute inset-0 flex items-center px-1" aria-hidden>
        <div className="w-full border-t border-border/80" />
      </div>
      <div className="relative flex justify-center">
        <div className="flex max-w-md flex-col items-center gap-1 rounded-full border border-border/80 bg-muted/50 px-4 py-2.5 text-center shadow-sm">
          <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            You&apos;re all caught up
          </div>
          <p className="text-xs text-muted-foreground">
            {newCount === 1
              ? "You've seen your new update."
              : `You've seen all ${newCount} new updates.`}{' '}
            Here&apos;s the rest of your feed.
          </p>
        </div>
      </div>
    </div>
  )
}
