-- Migration to fix RLS recursion on user_organization_memberships (v2)
-- and update custom_access_token_hook to include active_org_role.
-- Timestamp: 20250602102800

BEGIN;

-- Part 1: Modify the custom access token hook
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_profile_role TEXT;         -- Role from public.profiles
  user_profile_org_id UUID;       -- User's primary org_id (UUID) from public.profiles
  user_active_org_id TEXT;        -- Currently active org_id (TEXT) from auth.users.raw_app_meta_data
  user_active_org_role TEXT;      -- User's role in the active_org_id
  user_auth_id UUID;
BEGIN
  user_auth_id := (event->>'user_id')::uuid;
  claims := event->'claims';

  -- Ensure 'app_metadata' exists
  IF jsonb_typeof(claims->'app_metadata') IS NULL THEN
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  END IF;

  -- Fetch role and org_id (UUID) from public.profiles
  SELECT
    p.role,
    p.org_id
  INTO
    user_profile_role,
    user_profile_org_id
  FROM
    public.profiles p
  WHERE
    p.id = user_auth_id;

  IF user_profile_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, app_metadata_user_role}', to_jsonb(user_profile_role));
  ELSE
    RAISE LOG 'User role not found in profiles for user_id: %', user_auth_id;
  END IF;

  IF user_profile_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, app_metadata_user_org_id}', to_jsonb(user_profile_org_id));
  ELSE
    RAISE LOG 'User org_id (UUID) not found in profiles for user_id: %', user_auth_id;
  END IF;

  -- Fetch active_org_id (TEXT) from auth.users.raw_app_meta_data
  SELECT raw_app_meta_data->>'active_org_id'
  INTO user_active_org_id
  FROM auth.users
  WHERE id = user_auth_id;

  IF user_active_org_id IS NOT NULL THEN
    -- Add active_org_id to claims
    claims := jsonb_set(claims, '{app_metadata, active_org_id}', to_jsonb(user_active_org_id));

    -- Fetch the user's role in the active organization
    SELECT uom.role
    INTO user_active_org_role
    FROM public.user_organization_memberships uom
    WHERE uom.user_id = user_auth_id
      AND uom.organization_id = user_active_org_id;

    IF user_active_org_role IS NOT NULL THEN
      claims := jsonb_set(claims, '{app_metadata, active_org_role}', to_jsonb(user_active_org_role));
    ELSE
      RAISE LOG 'active_org_role not found in user_organization_memberships for user_id: % and active_org_id: %', user_auth_id, user_active_org_id;
      -- Optionally remove the claim if it's null or set a default
      -- claims := claims - '{app_metadata, active_org_role}';
    END IF;
  ELSE
    RAISE LOG 'active_org_id not found in app_metadata for user_id: %', user_auth_id;
    -- Optionally remove the claims if active_org_id is null
    -- claims := claims - '{app_metadata, active_org_id}';
    -- claims := claims - '{app_metadata, active_org_role}';
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS 'Custom JWT hook to add user_role (profile), user_org_id (profile''s org), active_org_id, and active_org_role to app_metadata.';

-- Grants for the hook function
GRANT SELECT (user_id, organization_id, role) ON TABLE public.user_organization_memberships TO supabase_auth_admin;


-- Part 2: Update RLS Policies for public.user_organization_memberships

-- Drop all potentially conflicting or old policies for authenticated users first
DROP POLICY IF EXISTS "Users can see their own memberships" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins/managers can see their org memberships" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins can manage their org memberships" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins/managers can see memberships in their active org" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins can manage memberships in their active org" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins/managers can see their org memberships based on active_org_id" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins can manage their org memberships based on active_org_id" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins/managers can see their org memberships based on acti" ON public.user_organization_memberships; -- Truncated name
DROP POLICY IF EXISTS "Org admins can manage their org memberships based on active_org" ON public.user_organization_memberships; -- Truncated name
DROP POLICY IF EXISTS "Users can see memberships in their active org if admin or manager" ON public.user_organization_memberships; -- Pre-emptive drop for new name
DROP POLICY IF EXISTS "Users can manage memberships in their active org if admin" ON public.user_organization_memberships; -- Pre-emptive drop for new name


-- Policy 1: Users can see their own memberships
CREATE POLICY "Users can see their own memberships"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy 2: Users can see memberships in their active org if they are an admin or manager of that org
CREATE POLICY "Users can see memberships in their active org if admin or manager"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (
    (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT IS NOT NULL AND
    (auth.jwt()->'app_metadata'->>'active_org_role')::TEXT IN ('admin', 'manager') AND
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

-- Policy 3: Users can manage (INSERT, UPDATE, DELETE) memberships in their active org if they are an admin of that org
CREATE POLICY "Users can manage memberships in their active org if admin"
ON public.user_organization_memberships
FOR ALL
TO authenticated
USING (
    (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT IS NOT NULL AND
    (auth.jwt()->'app_metadata'->>'active_org_role')::TEXT = 'admin' AND
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
)
WITH CHECK (
    (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT IS NOT NULL AND
    (auth.jwt()->'app_metadata'->>'active_org_role')::TEXT = 'admin' AND
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

-- Policy 4: Allow all operations for service_role (ensure it's present and correct)
DROP POLICY IF EXISTS "Allow all for service_role" ON public.user_organization_memberships;
CREATE POLICY "Allow all for service_role"
ON public.user_organization_memberships
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMIT;

-- End of migration