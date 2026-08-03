-- =============================================================================
-- Invite code: create organizations + organization_invitations if missing, add code, RPC get_invite_by_code.
-- Safe to run even if tables already exist. Creates organizations and user_profiles if missing.
-- =============================================================================

-- 0) Create organizations table if it doesn't exist (required for invite flow and app auth)
CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Organization',
  domain text,
  slug text NOT NULL DEFAULT 'default',
  subscription_tier text NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'starter', 'professional', 'enterprise')),
  subscription_status text NOT NULL DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),
  max_users int NOT NULL DEFAULT 10,
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);

-- Create user_profiles if missing (app expects this for auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL DEFAULT '',
  full_name text,
  avatar_url text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  department text,
  job_title text,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_organization ON public.user_profiles(organization_id);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: users can read/update own profile; allow read for same org (simplified)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can read own profile') THEN
    CREATE POLICY "Users can read own profile" ON public.user_profiles FOR SELECT USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can update own profile') THEN
    CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Allow insert for authenticated') THEN
    CREATE POLICY "Allow insert for authenticated" ON public.user_profiles FOR INSERT WITH CHECK (id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'Users can read same org') THEN
    CREATE POLICY "Users can read same org" ON public.user_profiles FOR SELECT USING (
      organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1) Create organization_invitations table if it doesn't exist (required for invite flow)
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  token uuid UNIQUE DEFAULT gen_random_uuid(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  code text UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_organization_invitations_org_email
  ON public.organization_invitations(organization_id, email);
CREATE INDEX IF NOT EXISTS idx_organization_invitations_token
  ON public.organization_invitations(token) WHERE token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organization_invitations_code
  ON public.organization_invitations(upper(trim(code))) WHERE code IS NOT NULL;

ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- RLS: allow authenticated users to read invites for their org, admins to insert
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_invitations' AND policyname = 'Allow read own org invitations') THEN
    CREATE POLICY "Allow read own org invitations" ON public.organization_invitations
      FOR SELECT USING (
        organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid())
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_invitations' AND policyname = 'Allow insert for org admins') THEN
    CREATE POLICY "Allow insert for org admins" ON public.organization_invitations
      FOR INSERT WITH CHECK (
        organization_id IN (SELECT organization_id FROM public.user_profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
      );
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- 2) Add code column if table existed but without code (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'organization_invitations' AND column_name = 'code') THEN
    ALTER TABLE public.organization_invitations ADD COLUMN code text UNIQUE;
  END IF;
END $$;

-- Generate codes for existing rows that don't have one (optional; new invites get code on insert)
-- Using a simple 8-char uppercase alphanumeric pattern
CREATE OR REPLACE FUNCTION public.gen_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, 1 + floor(random() * length(chars))::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- Ensure existing rows get a code (run once)
UPDATE public.organization_invitations
SET code = public.gen_invite_code()
WHERE code IS NULL;

-- RPC: get invite by code (callable by anon for accept-invite page)
CREATE OR REPLACE FUNCTION public.get_invite_by_code(invite_code text)
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
  WHERE upper(trim(i.code)) = upper(trim(invite_code))
    AND i.accepted_at IS NULL
    AND (i.expires_at IS NULL OR i.expires_at > now());
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_code(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invite_by_code(text) TO authenticated;

-- RPC: create invite and return row (code included). Bypasses RLS on SELECT-after-INSERT.
-- Caller must be authenticated and (role owner/admin OR the only user in their org).
CREATE OR REPLACE FUNCTION public.create_employee_invite(p_email text, p_role text DEFAULT 'member')
RETURNS TABLE (
  id uuid,
  email text,
  role text,
  token uuid,
  code text,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_code text;
  v_member_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Allow if user has role owner or admin
  SELECT up.organization_id INTO v_org_id
  FROM public.user_profiles up
  WHERE up.id = v_uid AND up.role IN ('owner', 'admin')
  LIMIT 1;

  -- If not admin/owner, allow if they are the only user in their org (treat as de facto owner)
  IF v_org_id IS NULL THEN
    SELECT up.organization_id INTO v_org_id
    FROM public.user_profiles up
    WHERE up.id = v_uid AND up.organization_id IS NOT NULL
    LIMIT 1;
    IF v_org_id IS NOT NULL THEN
      SELECT count(*) INTO v_member_count FROM public.user_profiles WHERE organization_id = v_org_id;
      IF v_member_count <> 1 THEN
        v_org_id := NULL;
      END IF;
    END IF;
  END IF;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized: Only admins (or the only member of your organization) can generate invite codes. Ask an admin to set your role to Owner or Admin.';
  END IF;

  v_code := public.gen_invite_code();

  RETURN QUERY
  INSERT INTO public.organization_invitations (
    organization_id,
    email,
    role,
    invited_by,
    expires_at,
    code
  )
  VALUES (
    v_org_id,
    lower(trim(p_email)),
    coalesce(nullif(trim(p_role), ''), 'member'),
    v_uid,
    now() + interval '7 days',
    v_code
  )
  RETURNING
    organization_invitations.id,
    organization_invitations.email,
    organization_invitations.role,
    organization_invitations.token,
    organization_invitations.code,
    organization_invitations.expires_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_employee_invite(text, text) TO authenticated;

-- RPC: ensure the current user has an organization (and user_profiles row). Creates default org + profile if missing.
-- Call this when getCurrentOrganizationId() would return null (e.g. first-time or non-invite users).
CREATE OR REPLACE FUNCTION public.ensure_my_organization()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_org_id uuid;
  v_email text;
  v_slug text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Already have a profile with an org?
  SELECT organization_id INTO v_org_id
  FROM public.user_profiles
  WHERE id = v_uid AND organization_id IS NOT NULL
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    RETURN v_org_id;
  END IF;

  -- Get email from auth.users (SECURITY DEFINER allows reading auth schema)
  SELECT email INTO v_email FROM auth.users WHERE id = v_uid LIMIT 1;
  v_email := COALESCE(trim(v_email), '');

  -- Unique slug for new org (default slug may already exist)
  v_slug := 'org-' || replace(substr(v_uid::text, 1, 8), '-', '') || substr(md5(random()::text), 1, 4);

  -- Create default organization
  INSERT INTO public.organizations (name, slug)
  VALUES ('My Organization', v_slug)
  RETURNING id INTO v_org_id;

  -- Create or update user_profiles so user is owner of this org
  INSERT INTO public.user_profiles (id, organization_id, email, role)
  VALUES (v_uid, v_org_id, v_email, 'owner')
  ON CONFLICT (id) DO UPDATE SET
    organization_id = excluded.organization_id,
    role = 'owner',
    updated_at = now();

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_my_organization() TO authenticated;
