import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import './driver-tour.css'
import { useAuth } from '@/contexts/AuthContext'
import { useModuleAccess } from '@/contexts/ModuleAccessContext'
import type { ModuleId } from '@/lib/module-access'
import {
  getTourStepsForPath,
  getTourStatus,
  getModuleTourMeta,
  loadTourState,
  saveTourStatus,
  getTourRoute,
  getTourStorageKey,
  type ModuleTourId,
  type TourStatus,
} from '@/lib/tour-definitions'
import { resolveTourSteps, waitForTourReady } from '@/lib/tour-resolve'
import {
  buildOnboardingModuleQueue,
  getOnboardingProgressLabel,
  markOnboardingTourAdvanced,
  markOnboardingTourCompleted,
  markOnboardingTourStarted,
  loadOnboardingTourState,
  clearOnboardingTourState,
  hydrateOnboardingTourFromProfile,
  type OnboardingTourState,
} from '@/lib/onboarding-tour'
import {
  clearTrainingTourOnProfile,
  persistTrainingTourToProfile,
} from '@/lib/onboarding-tour-api'
import { toast } from 'sonner'
import { TourPromptDialog } from './tour-prompt-dialog'
import { OnboardingTourController } from './onboarding-tour-controller'

interface PendingPrompt {
  moduleId: ModuleTourId
  moduleName: string
}

interface PendingOnboardingNav {
  moduleId: ModuleTourId
  route: string
}

interface OnboardingSession {
  userId: string
  queue: ModuleTourId[]
  index: number
}

interface StartOnboardingOptions {
  restart?: boolean
}

interface TourContextValue {
  startTour: (moduleId: ModuleTourId, pathname?: string) => void
  maybeShowTourPrompt: (moduleId: ModuleTourId, pathname?: string) => void
  getStatus: (moduleId: ModuleTourId) => TourStatus | undefined
  getAllStatuses: () => Partial<Record<ModuleTourId, TourStatus>>
  refreshStatuses: () => void
  startOnboardingTour: (options?: StartOnboardingOptions) => void
  resumeOnboardingTour: () => void
  cancelOnboardingTour: () => void
  isOnboardingTourActive: boolean
  onboardingProgressLabel: string | null
  pendingOnboardingNav: PendingOnboardingNav | null
  clearPendingOnboardingNav: () => void
  showOnboardingComplete: boolean
  dismissOnboardingComplete: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext)
  if (!ctx) {
    throw new Error('useTour must be used within TourProvider')
  }
  return ctx
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth()
  const { allowedModules } = useModuleAccess()

  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null)
  const [isTourActive, setIsTourActive] = useState(false)
  const [statusVersion, setStatusVersion] = useState(0)
  const [pendingOnboardingNav, setPendingOnboardingNav] = useState<PendingOnboardingNav | null>(
    null,
  )
  const [onboardingProgressLabel, setOnboardingProgressLabel] = useState<string | null>(null)
  const [isOnboardingTourActive, setIsOnboardingTourActive] = useState(false)
  const [showOnboardingComplete, setShowOnboardingComplete] = useState(false)

  const driverRef = useRef<ReturnType<typeof driver> | null>(null)
  const promptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const activeModuleRef = useRef<ModuleTourId | null>(null)
  const onboardingRef = useRef<OnboardingSession | null>(null)
  const allowedModulesRef = useRef<ModuleId[]>(allowedModules)
  const tourFinishedRef = useRef<{ moduleId: ModuleTourId | null; finished: boolean }>({
    moduleId: null,
    finished: false,
  })

  useEffect(() => {
    allowedModulesRef.current = allowedModules
  }, [allowedModules])

  useEffect(() => {
    if (!user?.id || !profile) return
    hydrateOnboardingTourFromProfile(user.id, {
      training_tour_completed_at: profile.training_tour_completed_at,
      training_tour_progress: profile.training_tour_progress as OnboardingTourState | null,
    })
  }, [user?.id, profile])

  const syncOnboardingToDb = useCallback((userId: string, state: OnboardingTourState) => {
    void persistTrainingTourToProfile(userId, state)
  }, [])

  const bumpStatus = useCallback(() => {
    setStatusVersion((v) => v + 1)
  }, [])

  const clearPromptTimer = useCallback(() => {
    if (promptTimerRef.current) {
      clearTimeout(promptTimerRef.current)
      promptTimerRef.current = null
    }
  }, [])

  const destroyDriver = useCallback(() => {
    if (driverRef.current?.isActive()) {
      driverRef.current.destroy()
    }
    driverRef.current = null
    activeModuleRef.current = null
    setIsTourActive(false)
  }, [])

  const clearPendingOnboardingNav = useCallback(() => {
    setPendingOnboardingNav(null)
  }, [])

  const updateOnboardingLabel = useCallback((session: OnboardingSession) => {
    setOnboardingProgressLabel(getOnboardingProgressLabel(session.index, session.queue))
  }, [])

  const scheduleOnboardingModule = useCallback(
    (session: OnboardingSession, index: number) => {
      const moduleId = session.queue[index]
      if (!moduleId) return
      session.index = index
      updateOnboardingLabel(session)
      const state = markOnboardingTourAdvanced(session.userId, index, session.queue)
      syncOnboardingToDb(session.userId, state)
      setPendingOnboardingNav({ moduleId, route: getTourRoute(moduleId) })
    },
    [updateOnboardingLabel, syncOnboardingToDb],
  )

  const finishOnboardingTour = useCallback(
    (userId: string) => {
      onboardingRef.current = null
      setIsOnboardingTourActive(false)
      setOnboardingProgressLabel(null)
      const state = markOnboardingTourCompleted(userId)
      syncOnboardingToDb(userId, state)
      setShowOnboardingComplete(true)
      bumpStatus()
      toast.success('Training tour complete', {
        description: 'You can replay it anytime from the Launchpad or Hub.',
      })
    },
    [bumpStatus, syncOnboardingToDb],
  )

  const advanceOnboardingTour = useCallback(
    (completedModuleId: ModuleTourId) => {
      const session = onboardingRef.current
      if (!session || session.queue[session.index] !== completedModuleId) return

      const nextIndex = session.index + 1
      if (nextIndex >= session.queue.length) {
        finishOnboardingTour(session.userId)
        return
      }

      scheduleOnboardingModule(session, nextIndex)
    },
    [finishOnboardingTour, scheduleOnboardingModule],
  )

  const startTour = useCallback(
    (moduleId: ModuleTourId, pathname?: string, options?: { waitForReady?: boolean }) => {
      clearPromptTimer()
      setPendingPrompt(null)
      destroyDriver()

      const path = pathname ?? (typeof window !== 'undefined' ? window.location.pathname : '')
      const inOnboarding = !!onboardingRef.current
      const shouldWait = options?.waitForReady ?? inOnboarding

      const runTour = (steps: ReturnType<typeof resolveTourSteps>) => {
        if (!steps.length) {
          toast.message('Tour could not start', {
            description:
              moduleId === 'kyi'
                ? 'Stay on this KYI page after it finishes loading, or open /kyi from the module home.'
                : moduleId === 'launchpad'
                  ? 'Your Launchpad is still loading. Wait a moment and try the Training tour again.'
                  : 'This screen is still loading. Wait a few seconds and try again, or use the module Help button.',
          })

          const session = onboardingRef.current
          if (session?.queue[session.index] === moduleId) {
            advanceOnboardingTour(moduleId)
          }
          return
        }

        activeModuleRef.current = moduleId
        setIsTourActive(true)
        tourFinishedRef.current = { moduleId: null, finished: false }

        const driverObj = driver({
          showProgress: true,
          progressText: '{{current}} of {{total}}',
          nextBtnText: 'Next',
          prevBtnText: 'Back',
          doneBtnText: inOnboarding ? 'Next module' : 'Done',
          allowClose: !inOnboarding,
          smoothScroll: true,
          popoverClass: 'katana-driver-popover',
          popoverOffset: 12,
          overlayOpacity: 0.75,
          stagePadding: 8,
          stageRadius: 12,
          animate: true,
          steps,
          onNextClick: (_element, _step, { driver: activeDriver }) => {
            if (activeDriver.isLastStep()) {
              tourFinishedRef.current = { moduleId, finished: true }
            }
            activeDriver.moveNext()
          },
          onHighlighted: () => {
            requestAnimationFrame(() => driverObj.refresh())
          },
          onDestroyed: () => {
            const finishedNaturally =
              tourFinishedRef.current.moduleId === moduleId && tourFinishedRef.current.finished
            tourFinishedRef.current = { moduleId: null, finished: false }

            if (finishedNaturally) {
              saveTourStatus(moduleId, 'completed')
              advanceOnboardingTour(moduleId)
            }
            driverRef.current = null
            activeModuleRef.current = null
            setIsTourActive(false)
            bumpStatus()
          },
        })

        driverRef.current = driverObj
        driverObj.drive()
      }

      if (shouldWait) {
        void waitForTourReady(moduleId, path).then(runTour)
        return
      }

      runTour(resolveTourSteps(getTourStepsForPath(moduleId, path)))
    },
    [clearPromptTimer, destroyDriver, bumpStatus, advanceOnboardingTour],
  )

  const maybeShowTourPrompt = useCallback(
    (moduleId: ModuleTourId) => {
      if (isTourActive || driverRef.current?.isActive() || onboardingRef.current) return
      if (getTourStatus(moduleId)) return

      clearPromptTimer()

      const meta = getModuleTourMeta(moduleId)
      promptTimerRef.current = setTimeout(() => {
        promptTimerRef.current = null
        if (driverRef.current?.isActive() || activeModuleRef.current || onboardingRef.current) {
          return
        }
        if (getTourStatus(moduleId)) return
        setPendingPrompt({ moduleId, moduleName: meta.name })
      }, 1000)
    },
    [clearPromptTimer, isTourActive],
  )

  const handleAcceptPrompt = useCallback(() => {
    if (!pendingPrompt) return
    const { moduleId } = pendingPrompt
    clearPromptTimer()
    setPendingPrompt(null)
    saveTourStatus(moduleId, 'started')
    bumpStatus()
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    startTour(moduleId, path)
  }, [pendingPrompt, clearPromptTimer, startTour, bumpStatus])

  const handleDismissPrompt = useCallback(() => {
    if (!pendingPrompt) return
    clearPromptTimer()
    saveTourStatus(pendingPrompt.moduleId, 'dismissed')
    setPendingPrompt(null)
    bumpStatus()
  }, [pendingPrompt, clearPromptTimer, bumpStatus])

  const startOnboardingTour = useCallback(
    (options?: StartOnboardingOptions) => {
      const userId = user?.id
      if (!userId) {
        toast.error('Sign in required', { description: 'Log in to start the training tour.' })
        return
      }

      const queue = buildOnboardingModuleQueue(allowedModulesRef.current)
      if (!queue.length) {
        toast.message('No modules available', {
          description: 'Your account does not have access to any training modules yet.',
        })
        return
      }

      if (options?.restart) {
        clearOnboardingTourState(userId)
        localStorage.removeItem(getTourStorageKey())
        void clearTrainingTourOnProfile(userId)
      }

      destroyDriver()
      clearPromptTimer()
      setPendingPrompt(null)
      setShowOnboardingComplete(false)

      const session: OnboardingSession = { userId, queue, index: 0 }
      onboardingRef.current = session
      setIsOnboardingTourActive(true)
      const state = markOnboardingTourStarted(userId, queue)
      syncOnboardingToDb(userId, state)
      updateOnboardingLabel(session)
      scheduleOnboardingModule(session, 0)
    },
    [user?.id, destroyDriver, clearPromptTimer, updateOnboardingLabel, scheduleOnboardingModule, syncOnboardingToDb],
  )

  const resumeOnboardingTour = useCallback(() => {
    const userId = user?.id
    if (!userId) {
      startOnboardingTour({ restart: true })
      return
    }

    const state = loadOnboardingTourState(userId)
    if (!state?.moduleQueue?.length || state.currentModuleIndex == null) {
      startOnboardingTour({ restart: true })
      return
    }

    const session: OnboardingSession = {
      userId,
      queue: state.moduleQueue,
      index: state.currentModuleIndex,
    }
    onboardingRef.current = session
    setIsOnboardingTourActive(true)
    updateOnboardingLabel(session)
    scheduleOnboardingModule(session, state.currentModuleIndex)
  }, [user?.id, startOnboardingTour, updateOnboardingLabel, scheduleOnboardingModule])

  const cancelOnboardingTour = useCallback(() => {
    destroyDriver()
    onboardingRef.current = null
    setIsOnboardingTourActive(false)
    setOnboardingProgressLabel(null)
    setPendingOnboardingNav(null)
    toast.message('Training tour paused', {
      description: 'Resume from the Launchpad or Hub with the Training tour button.',
    })
  }, [destroyDriver])

  const dismissOnboardingComplete = useCallback(() => {
    setShowOnboardingComplete(false)
  }, [])

  const value = useMemo<TourContextValue>(
    () => ({
      startTour,
      maybeShowTourPrompt,
      getStatus: (moduleId) => {
        void statusVersion
        return getTourStatus(moduleId)
      },
      getAllStatuses: () => {
        void statusVersion
        return loadTourState()
      },
      refreshStatuses: bumpStatus,
      startOnboardingTour,
      resumeOnboardingTour,
      cancelOnboardingTour,
      isOnboardingTourActive,
      onboardingProgressLabel,
      pendingOnboardingNav,
      clearPendingOnboardingNav,
      showOnboardingComplete,
      dismissOnboardingComplete,
    }),
    [
      startTour,
      maybeShowTourPrompt,
      statusVersion,
      bumpStatus,
      startOnboardingTour,
      resumeOnboardingTour,
      cancelOnboardingTour,
      isOnboardingTourActive,
      onboardingProgressLabel,
      pendingOnboardingNav,
      clearPendingOnboardingNav,
      showOnboardingComplete,
      dismissOnboardingComplete,
    ],
  )

  const showPromptDialog = !!pendingPrompt && !isTourActive && !isOnboardingTourActive

  return (
    <TourContext.Provider value={value}>
      {children}
      <OnboardingTourController />
      <TourPromptDialog
        open={showPromptDialog}
        moduleName={pendingPrompt?.moduleName ?? ''}
        onAccept={handleAcceptPrompt}
        onDismiss={handleDismissPrompt}
      />
    </TourContext.Provider>
  )
}
