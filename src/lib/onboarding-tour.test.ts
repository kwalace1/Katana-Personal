import { describe, expect, it, beforeEach } from 'vitest'
import {
  buildOnboardingModuleQueue,
  clearOnboardingTourState,
  hydrateOnboardingTourFromProfile,
  isOnboardingTourComplete,
  loadOnboardingTourState,
  markOnboardingTourCompleted,
  markOnboardingTourStarted,
  ONBOARDING_TOUR_SEQUENCE,
  shouldShowModuleTourPrompt,
} from '@/lib/onboarding-tour'

const USER_ID = 'test-user-onboarding'

describe('onboarding-tour', () => {
  beforeEach(() => {
    clearOnboardingTourState(USER_ID)
  })

  it('orders launchpad before hub and other modules', () => {
    expect(ONBOARDING_TOUR_SEQUENCE[0]).toBe('launchpad')
    expect(ONBOARDING_TOUR_SEQUENCE[1]).toBe('hub')
    expect(ONBOARDING_TOUR_SEQUENCE).toContain('support')
  })

  it('filters queue by module access', () => {
    const queue = buildOnboardingModuleQueue(['employee', 'hub', 'projects'])
    expect(queue).toEqual(['launchpad', 'hub', 'projects'])
  })

  it('tracks completion per user', () => {
    expect(isOnboardingTourComplete(USER_ID)).toBe(false)
    expect(shouldShowModuleTourPrompt(USER_ID)).toBe(false)

    markOnboardingTourStarted(USER_ID, ['launchpad', 'hub'])
    expect(loadOnboardingTourState(USER_ID)?.status).toBe('in_progress')
    expect(shouldShowModuleTourPrompt(USER_ID)).toBe(false)

    markOnboardingTourCompleted(USER_ID)
    expect(isOnboardingTourComplete(USER_ID)).toBe(true)
    expect(shouldShowModuleTourPrompt(USER_ID)).toBe(true)
  })

  it('hydrates completion from profile fields', () => {
    hydrateOnboardingTourFromProfile(USER_ID, {
      training_tour_completed_at: '2026-06-14T12:00:00.000Z',
      training_tour_progress: {
        status: 'in_progress',
        moduleQueue: ['launchpad', 'hub'],
        currentModuleIndex: 1,
      },
    })
    expect(isOnboardingTourComplete(USER_ID)).toBe(true)
    expect(loadOnboardingTourState(USER_ID)?.currentModuleIndex).toBe(1)
  })
})
