-- =============================================================================
-- Invite signup completion: link user_profiles + hr_employees after email signup.
-- Run in Supabase SQL Editor after supabase-invite-email-auth-migration.sql
-- =============================================================================

-- 1) Strengthen trigger: link HR employee row by email when auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user_from_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv record;
  org_id uuid;
  inv_role text;
  emp_name text;
BEGIN
  SELECT organization_id, role, email INTO inv
  FROM public.organization_invitations
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.organization_id IS NULL THEN
    RETURN new;
  END IF;

  org_id := inv.organization_id;
  inv_role := COALESCE(inv.role, 'member');

  SELECT name INTO emp_name
  FROM public.hr_employees
  WHERE organization_id = org_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(new.email))
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.user_profiles (
    id,
    organization_id,
    email,
    full_name,
    avatar_url,
    role,
    department,
    job_title,
    is_active,
    last_login_at,
    created_at,
    updated_at
  ) VALUES (
    new.id,
    org_id,
    COALESCE(new.email, ''),
    COALESCE(
      emp_name,
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(COALESCE(new.email, ''), '@', 1)
    ),
    new.raw_user_meta_data ->> 'avatar_url',
    inv_role::text,
    NULL,
    NULL,
    true,
    NULL,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = EXCLUDED.role,
    updated_at = now();

  UPDATE public.hr_employees
  SET user_id = new.id,
      updated_at = now()
  WHERE organization_id = org_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    AND (user_id IS NULL OR user_id = new.id);

  UPDATE public.organization_invitations
  SET accepted_at = now()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  RETURN new;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user_from_invite failed: %', SQLERRM;
    RETURN new;
END;
$$;

-- 2) RPC: idempotent completion after client signup (fixes race with ensure_my_organization)
CREATE OR REPLACE FUNCTION public.complete_invite_signup(p_invite_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_inv record;
  v_auth_email text;
  emp_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT i.id, i.email, i.organization_id, i.role
  INTO v_inv
  FROM public.organization_invitations i
  WHERE i.id = p_invite_id
  LIMIT 1;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  SELECT email INTO v_auth_email FROM auth.users WHERE id = v_uid LIMIT 1;
  IF LOWER(TRIM(COALESCE(v_auth_email, ''))) <> LOWER(TRIM(v_inv.email)) THEN
    RAISE EXCEPTION 'Signed-in email does not match this invite';
  END IF;

  SELECT name INTO emp_name
  FROM public.hr_employees
  WHERE organization_id = v_inv.organization_id
    AND LOWER(TRIM(email)) = LOWER(TRIM(v_inv.email))
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.user_profiles (
    id, organization_id, email, full_name, role, is_active, created_at, updated_at
  ) VALUES (
    v_uid,
    v_inv.organization_id,
    LOWER(TRIM(v_inv.email)),
    COALESCE(emp_name, split_part(v_inv.email, '@', 1)),
    COALESCE(v_inv.role, 'member'),
    true,
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, public.user_profiles.full_name),
    role = EXCLUDED.role,
    updated_at = now();

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'hr_employees' AND column_name = 'organization_id'
  ) THEN
    UPDATE public.hr_employees
    SET user_id = v_uid, updated_at = now()
    WHERE organization_id = v_inv.organization_id
      AND LOWER(TRIM(email)) = LOWER(TRIM(v_inv.email))
      AND (user_id IS NULL OR user_id = v_uid);
  ELSE
    UPDATE public.hr_employees
    SET user_id = v_uid, updated_at = now()
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(v_inv.email))
      AND (user_id IS NULL OR user_id = v_uid);
  END IF;

  UPDATE public.organization_invitations
  SET accepted_at = COALESCE(accepted_at, now())
  WHERE id = p_invite_id;

  RETURN v_inv.organization_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_invite_signup(uuid) TO authenticated;
