import { supabase } from '@/lib/supabase'
import type { OnboardingTourState } from '@/lib/onboarding-tour'

export interface TrainingTourProfileFields {
  training_tour_completed_at?: string | null
  training_tour_progress?: OnboardingTourState | null
}

/** Load training tour state from the user profile row. */
export async function fetchTrainingTourFromProfile(
  userId: string,
): Promise<OnboardingTourState | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('training_tour_completed_at, training_tour_progress')
    .eq('id', userId)
    .maybeSingle()

  if (error || !data) return null

  const progress = data.training_tour_progress as OnboardingTourState | null
  const completedAt = data.training_tour_completed_at as string | null

  if (completedAt) {
    return {
      status: 'completed',
      currentModuleIndex: progress?.currentModuleIndex,
      moduleQueue: progress?.moduleQueue,
      startedAt: progress?.startedAt,
      completedAt,
    }
  }

  return progress
}

/** Persist training tour state to user_profiles (fire-and-forget safe). */
export async function persistTrainingTourToProfile(
  userId: string,
  state: OnboardingTourState,
): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      training_tour_progress: state,
      training_tour_completed_at:
        state.status === 'completed' ? state.completedAt ?? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.warn('Failed to persist training tour to profile:', error.message)
  }
}

/** Clear training tour columns when user restarts the tour. */
export async function clearTrainingTourOnProfile(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_profiles')
    .update({
      training_tour_progress: {
        status: 'not_started',
      },
      training_tour_completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (error) {
    console.warn('Failed to clear training tour on profile:', error.message)
  }
}
