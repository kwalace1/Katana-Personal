-- =============================================================================
-- HR portal: allow employees to SELECT their own goals/reviews/learning/recognitions
-- Replaces blanket user_isolation FOR ALL (creator-only) so portal works when
-- user_id is the manager who created the row.
-- Run after supabase-user-isolation-migration.sql
-- =============================================================================

-- Match logged-in user to HR employee row (email is the link)
-- Used in policies below as: EXISTS (SELECT 1 FROM public.hr_employees e JOIN auth.users u ...)

-- -----------------------------------------------------------------------------
-- hr_goals
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_isolation_hr_goals" ON public.hr_goals;

CREATE POLICY "hr_goals_select_creator_or_subject"
  ON public.hr_goals FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_goals.employee_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "hr_goals_insert_creator"
  ON public.hr_goals FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_goals_update_creator"
  ON public.hr_goals FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_goals_delete_creator"
  ON public.hr_goals FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- hr_performance_reviews
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_isolation_hr_reviews" ON public.hr_performance_reviews;

CREATE POLICY "hr_reviews_select_creator_or_subject"
  ON public.hr_performance_reviews FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_performance_reviews.employee_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "hr_reviews_insert_creator"
  ON public.hr_performance_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_reviews_update_creator"
  ON public.hr_performance_reviews FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_reviews_delete_creator"
  ON public.hr_performance_reviews FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- hr_learning_paths
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_isolation_hr_learning" ON public.hr_learning_paths;

CREATE POLICY "hr_learning_select_creator_or_subject"
  ON public.hr_learning_paths FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_learning_paths.employee_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "hr_learning_insert_creator"
  ON public.hr_learning_paths FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_learning_update_creator"
  ON public.hr_learning_paths FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_learning_delete_creator"
  ON public.hr_learning_paths FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- hr_recognitions (recipient = to_id → hr_employees.id)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "user_isolation_hr_recognitions" ON public.hr_recognitions;

CREATE POLICY "hr_recognitions_select_creator_or_recipient"
  ON public.hr_recognitions FOR SELECT
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.hr_employees e
      INNER JOIN auth.users u ON lower(trim(both from u.email::text)) = lower(trim(both from e.email::text))
      WHERE e.id = hr_recognitions.to_id AND u.id = auth.uid()
    )
  );

CREATE POLICY "hr_recognitions_insert_creator"
  ON public.hr_recognitions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_recognitions_update_creator"
  ON public.hr_recognitions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "hr_recognitions_delete_creator"
  ON public.hr_recognitions FOR DELETE USING (auth.uid() = user_id);
