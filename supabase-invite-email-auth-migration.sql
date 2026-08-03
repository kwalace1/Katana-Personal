-- =============================================================================
-- Invite-by-email + Email/Password auth: organization_invitations token,
-- RPC to fetch invite by token, and trigger to create user_profiles from invite.
-- Run this in Supabase SQL Editor after enabling "Email" auth provider.
-- =============================================================================

-- 1) Ensure organization_invitations has token and expires_at (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invitations' AND column_name = 'token') THEN
    ALTER TABLE public.organization_invitations ADD COLUMN token uuid UNIQUE DEFAULT gen_random_uuid();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invitations' AND column_name = 'expires_at') THEN
    ALTER TABLE public.organization_invitations ADD COLUMN expires_at timestamptz DEFAULT (now() + interval '7 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invitations' AND column_name = 'accepted_at') THEN
    ALTER TABLE public.organization_invitations ADD COLUMN accepted_at timestamptz;
  END IF;
END $$;

-- Ensure existing rows have a token and expires_at
UPDATE public.organization_invitations
SET token = gen_random_uuid()
WHERE token IS NULL;
UPDATE public.organization_invitations
SET expires_at = created_at + interval '7 days'
WHERE expires_at IS NULL AND created_at IS NOT NULL;

-- 2) RPC: get invite by token (callable by anon for accept-invite page)
CREATE OR REPLACE FUNCTION public.get_invite_by_token(invite_token uuid)
RETURNS TABLE (
  id uuid,
  email text,
  organization_id uuid,
  organization_name text,
  role text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    i.id,
    i.email,
    i.organization_id,
    o.name AS organization_name,
    i.role
  FROM public.organization_invitations i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.token = invite_token
    AND i.accepted_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now());
$$;

-- Allow anon and authenticated to call (needed for accept-invite page before login)
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(uuid) TO authenticated;

-- 3) On new auth user signup: if there is a pending invite for this email, create user_profiles and mark invite accepted
CREATE OR REPLACE FUNCTION public.handle_new_user_from_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  inv record;
  org_id uuid;
  inv_role text;
BEGIN
  -- Find a valid pending invite for this email
  SELECT organization_id, role INTO inv
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

  -- Create user_profiles row (match your existing user_profiles columns)
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
    COALESCE(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(COALESCE(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    inv_role::text,
    NULL,
    NULL,
    true,
    NULL,
    now(),
    now()
  );

  -- Mark invite as accepted
  UPDATE public.organization_invitations
  SET accepted_at = now()
  WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    AND accepted_at IS NULL
    AND (expires_at IS NULL OR expires_at > now());

  RETURN new;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists (e.g. from another flow); ignore
    RETURN new;
  WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user_from_invite failed: %', SQLERRM;
    RETURN new;
END;
$$;

-- Drop trigger if exists then create (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created_from_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_from_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_from_invite();
