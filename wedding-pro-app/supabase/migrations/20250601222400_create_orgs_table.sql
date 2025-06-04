-- Create the table only if it doesn't exist
CREATE TABLE IF NOT EXISTS public.orgs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT, -- Will be set to NOT NULL below
    -- organization_id will be added/altered below
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    contact_email TEXT,
    created_at TIMESTAMPTZ, -- Will be set to NOT NULL with DEFAULT below
    updated_at TIMESTAMPTZ  -- Will be set to NOT NULL with DEFAULT below
);

-- Ensure 'name' column exists and is NOT NULL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'name'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN name TEXT;
        RAISE NOTICE 'Column name added to public.orgs.';
    END IF;
    ALTER TABLE public.orgs ALTER COLUMN name SET NOT NULL;
END $$;

-- Ensure 'organization_id' column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'organization_id'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN organization_id TEXT;
        RAISE NOTICE 'Column organization_id added to public.orgs.';
    ELSE
        RAISE NOTICE 'Column organization_id already exists in public.orgs.';
    END IF;
END $$;

-- Set organization_id to NOT NULL
-- This may fail if the column exists and contains NULL values. This is intentional
-- as the requirement is for this column to be NOT NULL.
ALTER TABLE public.orgs ALTER COLUMN organization_id SET NOT NULL;

-- Add UNIQUE constraint orgs_organization_id_key to organization_id if no unique constraint already exists on the column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.conrelid = 'public.orgs'::regclass
          AND att.attname = 'organization_id'
          AND con.contype = 'u'
    ) THEN
        ALTER TABLE public.orgs ADD CONSTRAINT orgs_organization_id_key UNIQUE (organization_id);
        RAISE NOTICE 'Added UNIQUE constraint orgs_organization_id_key on organization_id.';
    ELSE
        RAISE NOTICE 'A unique constraint already exists on organization_id for public.orgs. Skipping addition of orgs_organization_id_key.';
    END IF;
END $$;

-- Ensure 'owner_user_id' column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'owner_user_id'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
        RAISE NOTICE 'Column owner_user_id added to public.orgs.';
    END IF;
END $$;

-- Ensure 'contact_email' column exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'contact_email'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN contact_email TEXT;
        RAISE NOTICE 'Column contact_email added to public.orgs.';
    END IF;
END $$;

-- Ensure 'created_at' column exists, is NOT NULL, and has a DEFAULT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'created_at'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN created_at TIMESTAMPTZ;
        RAISE NOTICE 'Column created_at added to public.orgs.';
    END IF;
    ALTER TABLE public.orgs ALTER COLUMN created_at SET NOT NULL;
    ALTER TABLE public.orgs ALTER COLUMN created_at SET DEFAULT NOW();
END $$;

-- Ensure 'updated_at' column exists, is NOT NULL, and has a DEFAULT
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.orgs ADD COLUMN updated_at TIMESTAMPTZ;
        RAISE NOTICE 'Column updated_at added to public.orgs.';
    END IF;
    ALTER TABLE public.orgs ALTER COLUMN updated_at SET NOT NULL;
    ALTER TABLE public.orgs ALTER COLUMN updated_at SET DEFAULT NOW();
END $$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger (idempotently by dropping if exists)
DROP TRIGGER IF EXISTS update_orgs_updated_at ON public.orgs;
CREATE TRIGGER update_orgs_updated_at
BEFORE UPDATE ON public.orgs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- RLS policies (idempotently by dropping if exists)
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to orgs for authenticated users" ON public.orgs;
CREATE POLICY "Allow all access to orgs for authenticated users"
ON public.orgs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Comments (safe to re-apply)
COMMENT ON TABLE public.orgs IS 'Stores organization data, including a unique textual identifier.';
COMMENT ON COLUMN public.orgs.id IS 'Primary key for the organization (UUID).';
COMMENT ON COLUMN public.orgs.name IS 'Display name of the organization.';
COMMENT ON COLUMN public.orgs.organization_id IS 'Unique, URL-friendly identifier for the organization, derived from its name.';
COMMENT ON COLUMN public.orgs.owner_user_id IS 'User ID of the organization owner/creator.';
COMMENT ON COLUMN public.orgs.contact_email IS 'Primary contact email for the organization.';
COMMENT ON COLUMN public.orgs.created_at IS 'Timestamp of when the organization was created.';
COMMENT ON COLUMN public.orgs.updated_at IS 'Timestamp of when the organization was last updated.';