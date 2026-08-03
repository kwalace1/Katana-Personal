-- Add review_format to distinguish standard manager reviews from self-assessments
ALTER TABLE public.hr_performance_reviews
  ADD COLUMN IF NOT EXISTS review_format text NOT NULL DEFAULT 'standard';

ALTER TABLE public.hr_performance_reviews
  DROP CONSTRAINT IF EXISTS hr_performance_reviews_review_format_check;

ALTER TABLE public.hr_performance_reviews
  ADD CONSTRAINT hr_performance_reviews_review_format_check
  CHECK (review_format IN ('standard', 'self_assessment'));
