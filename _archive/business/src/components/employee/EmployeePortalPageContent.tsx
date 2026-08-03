import { cn } from '@/lib/utils'

interface EmployeePortalPageContentProps {
  children: React.ReactNode
  className?: string
  /** Tailwind max-width utility, e.g. max-w-5xl */
  maxWidth?: string
}

/**
 * Standard scrollable page body inside EmployeePortalLayout.
 * Fills the viewport below the portal sub-nav without min-h-screen hacks.
 */
export function EmployeePortalPageContent({
  children,
  className,
  maxWidth = 'max-w-6xl',
}: EmployeePortalPageContentProps) {
  return (
    <div className={cn('mx-auto w-full px-4 py-6 sm:px-6', maxWidth, className)}>{children}</div>
  )
}
