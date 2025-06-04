-- Migration to add active_org_id JWT claim, related functions, and update RLS policies.

-- Part 1: Function to set the active organization for a user
CREATE OR REPLACE FUNCTION public.set_active_user_organization(target_org_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- To update auth.users table
AS $$
BEGIN
    -- Verify the user is a member of the target organization
    IF NOT EXISTS (
        SELECT 1
        FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid() AND uom.organization_id = target_org_id
    ) THEN
        RAISE EXCEPTION 'User % is not a member of organization %', auth.uid(), target_org_id;
    END IF;

    -- Update the user's app_metadata with the active_org_id
    UPDATE auth.users
    SET raw_app_meta_data = raw_app_meta_data || jsonb_build_object('active_org_id', target_org_id)
    WHERE id = auth.uid();

    RAISE LOG 'User % set active organization to %', auth.uid(), target_org_id;
END;
$$;

COMMENT ON FUNCTION public.set_active_user_organization(TEXT) IS 'Sets the active_org_id in the user''s app_metadata. Called by an Edge Function when a user switches organizations.';

-- Grant execute permission on the function to authenticated users
-- This allows users to call this (via an Edge Function) to change their own active org.
GRANT EXECUTE ON FUNCTION public.set_active_user_organization(TEXT) TO authenticated;


-- Part 2: Modify the custom access token hook to include active_org_id
-- This function should ideally be an ALTER OR REPLACE of the existing one from
-- wedding-pro-app/scripts/custom-auth-claims-hook.sql
-- For simplicity in this migration, we redefine it. Ensure this is the sole definition post-migration.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_profile_role TEXT;
  user_profile_org_id UUID; -- This is orgs.id (UUID) from profiles table
  user_active_org_id TEXT;  -- This will be orgs.organization_id (TEXT) from auth.users.raw_app_meta_data
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
    p.org_id -- This is the UUID foreign key to orgs.id
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
    -- This claim stores the UUID of the user's primary org from their profile
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
    -- This claim stores the TEXT ID of the currently active organization
    claims := jsonb_set(claims, '{app_metadata, active_org_id}', to_jsonb(user_active_org_id));
  ELSE
    RAISE LOG 'active_org_id not found in app_metadata for user_id: %', user_auth_id;
    -- Optionally, remove the claim if it's null to ensure it's not present
    -- claims := claims - '{app_metadata, active_org_id}';
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS 'Custom JWT hook to add user_role, user_org_id (profile''s org), and active_org_id (currently selected org) to app_metadata.';

-- Grants for the hook function
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
-- Grant SELECT on specific columns of public.profiles
GRANT SELECT (id, role, org_id) ON TABLE public.profiles TO supabase_auth_admin;
-- Grant SELECT on specific columns of auth.users (needed for raw_app_meta_data)
GRANT SELECT (id, raw_app_meta_data) ON TABLE auth.users TO supabase_auth_admin;


-- Part 3: Update RLS Policies to use active_org_id

-- Example: RLS for a hypothetical 'projects' table
-- CREATE TABLE IF NOT EXISTS public.projects (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   organization_id TEXT NOT NULL REFERENCES public.orgs(organization_id), -- TEXT org ID
--   name TEXT NOT NULL,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
-- ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- DROP POLICY IF EXISTS "Users can view projects in their active org" ON public.projects;
-- CREATE POLICY "Users can view projects in their active org"
-- ON public.projects
-- FOR SELECT
-- TO authenticated
-- USING (
--   (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT = organization_id
-- );

-- DROP POLICY IF EXISTS "Org members can manage projects in their active org" ON public.projects;
-- CREATE POLICY "Org members can manage projects in their active org"
-- ON public.projects
-- FOR ALL -- INSERT, UPDATE, DELETE
-- TO authenticated
-- USING (
--   (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT = organization_id AND
--   EXISTS ( -- Ensure user is a member of this active org
--     SELECT 1 FROM public.user_organization_memberships uom
--     WHERE uom.user_id = auth.uid()
--       AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
--       -- Optionally add role checks here, e.g. AND uom.role IN ('admin', 'manager')
--   )
-- )
-- WITH CHECK (
--   (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT = organization_id AND
--   EXISTS (
--     SELECT 1 FROM public.user_organization_memberships uom
--     WHERE uom.user_id = auth.uid()
--       AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
--   )
-- );


-- RLS Updates for existing tables:

-- public.profiles
-- The existing policies on profiles use `app_metadata_user_org_id` which is the user's *primary* org_id from their profile.
-- For viewing/editing profiles, it might still make sense to use the primary org_id or a combination.
-- However, if profile access should be strictly tied to the *active* org, these need to change.
-- For now, assuming profile management is tied to their main org, not the active one.
-- If active_org_id should govern profile access, the policies below would need to be uncommented and adjusted.

-- Example if profiles were to be filtered by active_org_id:
-- ALTER POLICY "Admins can update profiles in their org" ON public.profiles
-- USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Admin') AND ((auth.jwt()->>'app_metadata'->>'active_org_id')::TEXT = (SELECT organization_id FROM public.orgs WHERE id = profiles.org_id)));
-- ALTER POLICY "Admins can view profiles in their org" ON public.profiles
-- USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Admin') AND ((auth.jwt()->>'app_metadata'->>'active_org_id')::TEXT = (SELECT organization_id FROM public.orgs WHERE id = profiles.org_id)));
-- ... and so on for other profile policies. This requires joining orgs table if profiles.org_id is UUID.
-- Given profiles.org_id is UUID, and active_org_id is TEXT, direct comparison is not possible without a join or storing active_org_id as UUID.
-- Sticking to TEXT for active_org_id for now. The RLS on profiles might need careful consideration based on product logic.

-- public.user_organization_memberships
-- Policies here already use auth.uid() or check roles within a specific org.
-- The "Org admins/managers can see their org memberships" and "Org admins can manage their org memberships"
-- policies correctly check if the acting user is an admin/manager of THE organization whose memberships are being accessed.
-- These might not need to change if the context of "their org" is derived correctly by the application logic
-- (i.e., application ensures it only tries to list/manage memberships for the active_org_id).
-- However, to strictly enforce it at RLS level based on the active_org_id JWT claim:

DROP POLICY IF EXISTS "Org admins/managers can see their org memberships based on active_org_id" ON public.user_organization_memberships;
CREATE POLICY "Org admins/managers can see their org memberships based on active_org_id"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT -- Current active org
          AND uom_check.user_id = auth.uid()
          AND uom_check.role IN ('admin', 'manager')
    )
);
-- Note: This replaces the previous "Org admins/managers can see their org memberships"
-- Make sure to drop the old one if this is the desired logic.
DROP POLICY IF EXISTS "Org admins/managers can see their org memberships" ON public.user_organization_memberships;


DROP POLICY IF EXISTS "Org admins can manage their org memberships based on active_org_id" ON public.user_organization_memberships;
CREATE POLICY "Org admins can manage their org memberships based on active_org_id"
ON public.user_organization_memberships
FOR ALL
TO authenticated
USING (
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT -- Current active org
          AND uom_check.user_id = auth.uid()
          AND uom_check.role = 'admin'
    )
)
WITH CHECK (
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT -- Current active org
          AND uom_check.user_id = auth.uid()
          AND uom_check.role = 'admin'
    )
);
-- Note: This replaces the previous "Org admins can manage their org memberships"
DROP POLICY IF EXISTS "Org admins can manage their org memberships" ON public.user_organization_memberships;


-- public.orgs
-- Current policy "Allow all access to orgs for authenticated users" is very permissive.
-- It should likely be restricted so users can only see/manage orgs they are members of,
-- or perhaps only their active_org_id.
DROP POLICY IF EXISTS "Users can view their active organization" ON public.orgs;
CREATE POLICY "Users can view their active organization"
ON public.orgs
FOR SELECT
TO authenticated
USING (
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

DROP POLICY IF EXISTS "Org admins can update their active organization details" ON public.orgs;
CREATE POLICY "Org admins can update their active organization details"
ON public.orgs
FOR UPDATE
TO authenticated
USING (
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS (
        SELECT 1
        FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
          AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom.role = 'admin'
    )
)
WITH CHECK (
    organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);
-- Note: INSERT and DELETE for orgs are typically more restricted (e.g., service_role only or specific admin functions).
-- The "Allow all access to orgs for authenticated users" should be dropped if these more specific policies are sufficient.
DROP POLICY IF EXISTS "Allow all access to orgs for authenticated users" ON public.orgs;


-- TODO: Review and update RLS policies for ALL other relevant tables.
-- This includes any tables created in Task 2, 3, 51, and 54.2, and any other table
-- that stores organization-specific data.
-- The general pattern will be:
-- USING ( (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT = your_table.organization_id_column )
-- AND potentially further checks on user role within that active_org_id using user_organization_memberships.

DO $$
BEGIN
RAISE NOTICE 'Migration for active_org_id claim and initial RLS updates completed.';
RAISE NOTICE 'IMPORTANT: Review ALL RLS policies for tables with organization-specific data to ensure they use active_org_id.';
RAISE NOTICE 'IMPORTANT: The custom_access_token_hook has been redefined. Ensure this is the correct and sole version.';
END $$;