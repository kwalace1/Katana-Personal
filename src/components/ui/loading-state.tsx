import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingStateProps {
  message?: string
  className?: string
  /** If true, renders a full-page centered state (min-h-screen). Default true. */
  fullPage?: boolean
}

export function LoadingState({
  message = 'Loading…',
  className,
  fullPage = true,
}: LoadingStateProps) {
  const wrapperClass = fullPage
    ? 'min-h-screen bg-background flex items-center justify-center p-6'
    : 'flex items-center justify-center p-6'
  return (
    <div className={cn(wrapperClass, className)}>
      <div className="text-center text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin mx-auto mb-3 text-primary" aria-hidden />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}
