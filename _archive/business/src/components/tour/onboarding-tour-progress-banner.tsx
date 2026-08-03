import { GraduationCap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-provider'

export function OnboardingTourProgressBanner() {
  const { onboardingProgressLabel, isOnboardingTourActive, cancelOnboardingTour } = useTour()

  if (!isOnboardingTourActive || !onboardingProgressLabel) return null

  return (
    <div
      className="fixed bottom-4 left-1/2 z-[999999999] flex w-[min(100%-2rem,36rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-primary/30 bg-card px-4 py-3 shadow-lg"
      role="status"
      aria-live="polite"
    >
      <GraduationCap className="h-5 w-5 shrink-0 text-primary" />
      <p className="flex-1 text-sm font-medium leading-snug">{onboardingProgressLabel}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        title="Pause training tour"
        aria-label="Pause training tour"
        onClick={cancelOnboardingTour}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
