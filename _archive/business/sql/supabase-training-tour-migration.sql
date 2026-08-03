-- Training tour progress persisted per user (cross-device onboarding).
-- Safe to run multiple times.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS training_tour_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS training_tour_progress jsonb;

COMMENT ON COLUMN public.user_profiles.training_tour_completed_at IS
  'When the user finished the full-system Katana training tour.';
COMMENT ON COLUMN public.user_profiles.training_tour_progress IS
  'In-progress training tour state: status, moduleQueue, currentModuleIndex, startedAt.';
