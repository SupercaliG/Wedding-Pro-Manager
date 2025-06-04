-- Migration to fix infinite recursion in RLS policies for user_organization_memberships
-- Timestamp: 20250602020001

-- Drop the problematic policies
-- Ensure we drop policies with the exact names we are about to create, making this script idempotent
DROP POLICY IF EXISTS "Org admins/managers can see memberships in their active org" ON public.user_organization_memberships;
DROP POLICY IF EXISTS "Org admins can manage memberships in their active org" ON public.user_organization_memberships;

-- Recreate policy for admins/managers to SELECT memberships using active_org_id
CREATE POLICY "Org admins/managers can see memberships in their active org"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (
    -- The membership being accessed must belong to the user's active organization
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND
    -- The current user must have an 'admin' or 'manager' role in their active organization
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_role_check
        WHERE uom_role_check.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom_role_check.user_id = auth.uid()
          AND uom_role_check.role IN ('admin', 'manager')
    )
);

-- Recreate policy for admins to manage memberships (INSERT, UPDATE, DELETE) using active_org_id
CREATE POLICY "Org admins can manage memberships in their active org"
ON public.user_organization_memberships
FOR ALL -- Covers INSERT, UPDATE, DELETE
TO authenticated
USING (
    -- The membership being managed must belong to the user's active organization
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND
    -- The current user must have an 'admin' role in their active organization
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_role_check
        WHERE uom_role_check.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom_role_check.user_id = auth.uid()
          AND uom_role_check.role = 'admin'
    )
)
WITH CHECK (
    -- When inserting/updating, the target organization_id must be the user's active organization
    public.user_organization_memberships.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND
    -- The current user must still have an 'admin' role in their active organization (redundant with USING for check, but good for clarity)
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_role_check_wc
        WHERE uom_role_check_wc.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom_role_check_wc.user_id = auth.uid()
          AND uom_role_check_wc.role = 'admin'
    )
);

DO $$
BEGIN
RAISE NOTICE 'RLS policies for user_organization_memberships updated to fix recursion.';
END $$;