import { Link } from 'react-router-dom'
import { AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorStateProps {
  title?: string
  message: string
  /** Optional link to retry or go back (e.g. { to: '/employee', label: 'Back to portal' }) */
  primaryAction?: { to: string; label: string }
  /** Optional secondary action */
  secondaryAction?: { to: string; label: string }
  className?: string
  /** If true, full-page centered. Default true. */
  fullPage?: boolean
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  primaryAction,
  secondaryAction,
  className,
  fullPage = true,
}: ErrorStateProps) {
  const wrapperClass = fullPage
    ? 'min-h-screen bg-background flex items-center justify-center p-6'
    : 'flex items-center justify-center p-6'
  return (
    <div className={cn(wrapperClass, className)}>
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" aria-hidden />
            <CardTitle>{title}</CardTitle>
          </div>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {primaryAction && (
            <Button asChild variant="default">
              <Link to={primaryAction.to}>{primaryAction.label}</Link>
            </Button>
          )}
          {secondaryAction && (
            <Button asChild variant="outline">
              <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
