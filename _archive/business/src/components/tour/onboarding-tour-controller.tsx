import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import {
  buildOnboardingModuleQueue,
  getOnboardingProgressLabel,
  isOnboardingTourComplete,
  loadOnboardingTourState,
  hydrateOnboardingTourFromProfile,
  type OnboardingTourState,
} from '@/lib/onboarding-tour'
import { useTour } from './tour-provider'
import {
  OnboardingTourCompleteDialog,
  OnboardingTourResumeDialog,
  OnboardingTourWelcomeDialog,
} from './onboarding-tour-dialogs'
import { OnboardingTourProgressBanner } from './onboarding-tour-progress-banner'

const NAV_DELAY_MS = 350

function normalizePath(path: string): string {
  return path === '/' ? '/' : path.replace(/\/$/, '')
}

/** Handles mandatory first-login prompts, resume, and cross-module navigation. */
export function OnboardingTourController() {
  const { user, profile, loading: authLoading } = useAuth()
  const { allowedModules, loading: accessLoading } = useModuleAccess()
  const location = useLocation()
  const navigate = useNavigate()
  const {
    startOnboardingTour,
    resumeOnboardingTour,
    pendingOnboardingNav,
    clearPendingOnboardingNav,
    startTour,
    isOnboardingTourActive,
    showOnboardingComplete,
    dismissOnboardingComplete,
    onboardingProgressLabel,
  } = useTour()

  const [showWelcome, setShowWelcome] = useState(false)
  const [showResume, setShowResume] = useState(false)
  const [moduleCount, setModuleCount] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const promptedRef = useRef(false)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const userId = user?.id
  const isAppRoute =
    location.pathname !== '/' &&
    location.pathname !== '/onboarding' &&
    !location.pathname.startsWith('/accept-invite')

  useEffect(() => {
    if (!userId || !profile) {
      setHydrated(false)
      return
    }
    hydrateOnboardingTourFromProfile(userId, {
      training_tour_completed_at: profile.training_tour_completed_at,
      training_tour_progress: profile.training_tour_progress as OnboardingTourState | null,
    })
    setHydrated(true)
  }, [userId, profile])

  useEffect(() => {
    if (authLoading || accessLoading || !userId || !isAppRoute || !hydrated) return
    if (promptedRef.current || isOnboardingTourActive) return

    const queue = buildOnboardingModuleQueue(allowedModules)
    setModuleCount(queue.length)
    if (queue.length === 0) return

    const state = loadOnboardingTourState(userId)
    if (state?.status === 'completed') return

    promptedRef.current = true

    if (state?.status === 'in_progress') {
      setShowResume(true)
      return
    }

    setShowWelcome(true)
  }, [
    authLoading,
    accessLoading,
    userId,
    isAppRoute,
    allowedModules,
    isOnboardingTourActive,
    hydrated,
  ])

  // Step 1: navigate to the target module route when needed.
  useEffect(() => {
    if (!pendingOnboardingNav) return

    const target = normalizePath(pendingOnboardingNav.route)
    const current = normalizePath(location.pathname)

    if (current !== target) {
      navigate(pendingOnboardingNav.route)
    }
  }, [pendingOnboardingNav, location.pathname, navigate])

  // Step 2: once on the correct route, start the module tour.
  useEffect(() => {
    if (!pendingOnboardingNav) return

    const target = normalizePath(pendingOnboardingNav.route)
    const current = normalizePath(location.pathname)
    if (current !== target) return

    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current)
    }

    const { moduleId, route } = pendingOnboardingNav
    navTimerRef.current = setTimeout(() => {
      navTimerRef.current = null
      startTour(moduleId, route)
      clearPendingOnboardingNav()
    }, NAV_DELAY_MS)

    return () => {
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current)
        navTimerRef.current = null
      }
    }
  }, [pendingOnboardingNav, location.pathname, startTour, clearPendingOnboardingNav])

  const handleStart = () => {
    setShowWelcome(false)
    startOnboardingTour({ restart: false })
  }

  const handleResume = () => {
    setShowResume(false)
    resumeOnboardingTour()
  }

  const handleRestart = () => {
    setShowResume(false)
    startOnboardingTour({ restart: true })
  }

  const storedState = userId ? loadOnboardingTourState(userId) : null
  const resumeLabel =
    storedState?.moduleQueue?.length && storedState.currentModuleIndex != null
      ? getOnboardingProgressLabel(storedState.currentModuleIndex, storedState.moduleQueue)
      : onboardingProgressLabel ?? 'In progress'

  if (!userId) return null

  return (
    <>
      <OnboardingTourWelcomeDialog
        open={showWelcome && !isOnboardingTourComplete(userId)}
        moduleCount={moduleCount}
        onStart={handleStart}
      />
      <OnboardingTourResumeDialog
        open={showResume}
        progressLabel={resumeLabel}
        onResume={handleResume}
        onRestart={handleRestart}
      />
      <OnboardingTourCompleteDialog
        open={showOnboardingComplete}
        onClose={dismissOnboardingComplete}
      />
      <OnboardingTourProgressBanner />
    </>
  )
}
