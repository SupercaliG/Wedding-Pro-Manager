-- Migration: Create organization_invitation_codes table and RLS policies

-- Create organization_invitation_codes table
CREATE TABLE public.organization_invitation_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
    code TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL, -- Automatically tracks creator
    max_uses INTEGER NULL,
    uses_count INTEGER NOT NULL DEFAULT 0
);

-- Enable Row Level Security for the table
ALTER TABLE public.organization_invitation_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Organization Admins can SELECT invitation codes for their own organization.
CREATE POLICY org_admins_can_select_own_org_invitation_codes
ON public.organization_invitation_codes
FOR SELECT
TO authenticated
USING (
    auth.uid() IN (
        SELECT id
        FROM public.profiles
        WHERE profiles.org_id = organization_invitation_codes.org_id
        AND profiles.role = 'admin'
    )
);

-- Policy: Organization Admins can INSERT invitation codes for their own organization.
CREATE POLICY org_admins_can_insert_own_org_invitation_codes
ON public.organization_invitation_codes
FOR INSERT
TO authenticated
WITH CHECK (
    auth.uid() IN (
        SELECT id
        FROM public.profiles
        WHERE profiles.org_id = organization_invitation_codes.org_id
        AND profiles.role = 'admin'
    )
    AND organization_invitation_codes.org_id = (
        SELECT org_id
        FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
        LIMIT 1
    )
);

-- Policy: Organization Admins can UPDATE invitation codes for their own organization.
CREATE POLICY org_admins_can_update_own_org_invitation_codes
ON public.organization_invitation_codes
FOR UPDATE
TO authenticated
USING (
    auth.uid() IN (
        SELECT id
        FROM public.profiles
        WHERE profiles.org_id = organization_invitation_codes.org_id
        AND profiles.role = 'admin'
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT id
        FROM public.profiles
        WHERE profiles.org_id = organization_invitation_codes.org_id
        AND profiles.role = 'admin'
    )
);

-- Policy: Organization Admins can DELETE invitation codes for their own organization.
CREATE POLICY org_admins_can_delete_own_org_invitation_codes
ON public.organization_invitation_codes
FOR DELETE
TO authenticated
USING (
    auth.uid() IN (
        SELECT id
        FROM public.profiles
        WHERE profiles.org_id = organization_invitation_codes.org_id
        AND profiles.role = 'admin'
    )
);

-- Policy: Deny all access for general authenticated users by default.
-- Specific access for general authenticated users (not org admins for the specific resource)
-- will be granted via security definer functions as needed in other tasks.
CREATE POLICY "deny_all_for_authenticated_users"
ON public.organization_invitation_codes
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);