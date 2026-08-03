import { HelpCircle } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-provider'
import type { ModuleTourId } from '@/lib/tour-definitions'

interface ModuleHelpButtonProps {
  moduleId: ModuleTourId
  className?: string
}

export function ModuleHelpButton({ moduleId, className }: ModuleHelpButtonProps) {
  const { startTour } = useTour()
  const { pathname } = useLocation()

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={className ?? 'h-9 w-9 shrink-0'}
      title="Module tour"
      aria-label={`Start ${moduleId} module tour`}
      onClick={() => startTour(moduleId, pathname)}
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  )
}
