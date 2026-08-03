import { GraduationCap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-provider'

interface OnboardingTourButtonProps {
  className?: string
  size?: 'default' | 'sm' | 'lg' | 'icon'
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  showLabel?: boolean
}

/** Replay the full system training tour from the Launchpad or Hub. */
export function OnboardingTourButton({
  className,
  size = 'sm',
  variant = 'outline',
  showLabel = true,
}: OnboardingTourButtonProps) {
  const { startOnboardingTour, isOnboardingTourActive } = useTour()

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className ?? (showLabel ? 'gap-2' : 'h-9 w-9 shrink-0')}
      title="Full system training tour"
      aria-label="Start full system training tour"
      disabled={isOnboardingTourActive}
      onClick={() => startOnboardingTour({ restart: true })}
    >
      <GraduationCap className="h-4 w-4" />
      {showLabel ? 'Training tour' : null}
    </Button>
  )
}
