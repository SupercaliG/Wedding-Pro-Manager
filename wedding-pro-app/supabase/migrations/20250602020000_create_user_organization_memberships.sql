-- Create ENUM type for user roles within an organization
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_organization_role') THEN
        CREATE TYPE public.user_organization_role AS ENUM ('admin', 'manager', 'employee');
        RAISE NOTICE 'Created ENUM type user_organization_role.';
    ELSE
        RAISE NOTICE 'ENUM type user_organization_role already exists.';
    END IF;
END
$$;

-- Create the user_organization_memberships table
CREATE TABLE IF NOT EXISTS public.user_organization_memberships (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id TEXT NOT NULL REFERENCES public.orgs(organization_id) ON DELETE CASCADE,
    role public.user_organization_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, organization_id)
);

-- Comments for the new table and its columns
COMMENT ON TABLE public.user_organization_memberships IS 'Join table to manage user memberships and roles within organizations.';
COMMENT ON COLUMN public.user_organization_memberships.user_id IS 'Foreign key referencing the user in auth.users.';
COMMENT ON COLUMN public.user_organization_memberships.organization_id IS 'Foreign key referencing the organization in public.orgs using its textual ID.';
COMMENT ON COLUMN public.user_organization_memberships.role IS 'The role of the user within the organization.';
COMMENT ON COLUMN public.user_organization_memberships.created_at IS 'Timestamp of when the membership was created.';
COMMENT ON COLUMN public.user_organization_memberships.updated_at IS 'Timestamp of when the membership was last updated.';

-- Apply the trigger for updated_at (assuming public.update_updated_at_column() exists from previous migrations)
DROP TRIGGER IF EXISTS update_user_organization_memberships_updated_at ON public.user_organization_memberships;
CREATE TRIGGER update_user_organization_memberships_updated_at
BEFORE UPDATE ON public.user_organization_memberships
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.user_organization_memberships ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow users to see their own memberships
DROP POLICY IF EXISTS "Users can see their own memberships" ON public.user_organization_memberships;
CREATE POLICY "Users can see their own memberships"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Allow organization admins/managers to see memberships for their organization
-- This policy assumes that an admin/manager's role is stored in this same table.
-- A user is considered an admin/manager of an org if they have an 'admin' or 'manager' role in that org.
DROP POLICY IF EXISTS "Org admins/managers can see their org memberships" ON public.user_organization_memberships;
CREATE POLICY "Org admins/managers can see their org memberships"
ON public.user_organization_memberships
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = public.user_organization_memberships.organization_id
          AND uom_check.user_id = auth.uid()
          AND uom_check.role IN ('admin', 'manager')
    )
);

-- Allow organization admins to manage memberships for their organization (insert, update, delete)
DROP POLICY IF EXISTS "Org admins can manage their org memberships" ON public.user_organization_memberships;
CREATE POLICY "Org admins can manage their org memberships"
ON public.user_organization_memberships
FOR ALL -- Covers INSERT, UPDATE, DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = public.user_organization_memberships.organization_id
          AND uom_check.user_id = auth.uid()
          AND uom_check.role = 'admin'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1
        FROM public.user_organization_memberships AS uom_check
        WHERE uom_check.organization_id = public.user_organization_memberships.organization_id
          AND uom_check.user_id = auth.uid()
          AND uom_check.role = 'admin'
    )
);


-- Allow all operations for service_role (typically used for server-side operations)
DROP POLICY IF EXISTS "Allow all for service_role" ON public.user_organization_memberships;
CREATE POLICY "Allow all for service_role"
ON public.user_organization_memberships
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DO $$
BEGIN
    RAISE NOTICE 'Migration for user_organization_memberships table completed.';
END
$$;