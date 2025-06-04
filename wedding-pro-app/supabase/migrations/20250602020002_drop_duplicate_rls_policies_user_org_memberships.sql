-- Migration to drop duplicate/old RLS policies for user_organization_memberships
-- Timestamp: 20250602020002

-- Drop the specific old policies that were causing recursion and were not correctly dropped previously.
-- Names are taken from the pg_policy query result.

DROP POLICY IF EXISTS "Org admins/managers can see their org memberships based on acti" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins can manage their org memberships based on active_org" ON public.user_organization_memberships;

-- The policies created in 20250602020001_fix_rls_recursion_user_org_memberships.sql should now be the effective ones:
-- "Org admins/managers can see memberships in their active org"
-- "Org admins can manage memberships in their active org"

DO $$
BEGIN
RAISE NOTICE 'Dropped duplicate/old RLS policies for user_organization_memberships.'; 
END $$;