import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTour } from './tour-provider'
import { getTourStatus, shouldAutoPromptTour, type ModuleTourId } from '@/lib/tour-definitions'
import { shouldShowModuleTourPrompt } from '@/lib/onboarding-tour'

/** Tracks modules that already scheduled the first-visit prompt this page load. */
const autoPromptScheduled = new Set<ModuleTourId>()

/** On first visit to a module, prompt the user to take the guided tour (once per module). */
export function useModuleTour(moduleId: ModuleTourId) {
  const { maybeShowTourPrompt, isOnboardingTourActive } = useTour()
  const { pathname } = useLocation()
  const { user } = useAuth()

  useEffect(() => {
    if (isOnboardingTourActive) return
    if (!shouldShowModuleTourPrompt(user?.id)) return
    if (!shouldAutoPromptTour(moduleId, pathname)) return
    if (autoPromptScheduled.has(moduleId)) return
    if (getTourStatus(moduleId)) return
    autoPromptScheduled.add(moduleId)
    maybeShowTourPrompt(moduleId, pathname)
  }, [moduleId, pathname, maybeShowTourPrompt, isOnboardingTourActive, user?.id])
}
