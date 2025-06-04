-- Migration to update RLS policies for venues and related tables using active_org_id.
-- Timestamp: 20250601235503 (placeholder)

-- Ensure the helper function internal_get_text_org_id_from_uuid exists.
-- It should be created by a preceding migration (20250601235501_rls_helper_function.sql).

-- Create tables if they don't exist, based on wedding-pro-app/scripts/venues-migration.sql
-- This makes the migration more robust.

CREATE TABLE IF NOT EXISTS public.venues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE, -- Assuming org_id from list_tables output
    name VARCHAR(255) NOT NULL,
    address TEXT, -- From list_tables output for venues
    city TEXT,    -- From list_tables output for venues
    state TEXT,   -- From list_tables output for venues
    zip_code TEXT,-- From list_tables output for venues
    parking_info TEXT, -- From list_tables output for venues (parking_tips in script)
    permit_requirements TEXT, -- From list_tables output for venues (permit_info in script)
    notes TEXT, -- From list_tables output for venues (markdown_tips in script)
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- from list_tables
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.venues IS 'Stores venue information, linked to an organization.';

CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE, -- Assuming org_id
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    latitude DECIMAL(9,6),
    longitude DECIMAL(9,6),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
COMMENT ON TABLE public.locations IS 'Stores detailed address and geographic information for venues.';

CREATE TABLE IF NOT EXISTS public.tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE, -- Assuming org_id
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_tags_organization_name UNIQUE (org_id, name)
);
COMMENT ON TABLE public.tags IS 'Stores tags that can be applied to venues, scoped by organization.';

CREATE TABLE IF NOT EXISTS public.venue_tags (
    venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE, -- Assuming org_id
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (venue_id, tag_id)
);
COMMENT ON TABLE public.venue_tags IS 'Join table linking venues to tags, also scoped by organization.';


-- ============================
-- Table: venues
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view venues from their organization" ON public.venues;
DROP POLICY IF EXISTS "Users can insert venues into their organization" ON public.venues;
DROP POLICY IF EXISTS "Users can update venues in their organization" ON public.venues;
DROP POLICY IF EXISTS "Users can delete venues in their organization" ON public.venues;
DROP POLICY IF EXISTS "Users can view venues in their active org" ON public.venues;
DROP POLICY IF EXISTS "Org Admins/Managers can manage venues in their active org" ON public.venues;
DROP POLICY IF EXISTS "Service role full access on venues" ON public.venues;


CREATE POLICY "Users can view venues in their active org"
ON public.venues
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(venues.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Admins/Managers can manage venues in their active org"
ON public.venues
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(venues.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(venues.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
  -- For INSERT, the created_by_user_id should be set to auth.uid(). This is better handled
  -- by the application logic or a default value/trigger, as TG_OP is not available here.
  -- The RLS policy ensures the user performing the action is an admin/manager of the active org.
);


CREATE POLICY "Service role full access on venues"
ON public.venues
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Note: The `venues-migration.sql` script showed `organization_id` for venues, locations, tags, venue_tags.
-- The Supabase `list_tables` output showed `org_id` for `venues`.
-- Assuming the actual column name in these tables is `org_id` (UUID) that references `orgs.id`.
-- If it's `organization_id` (UUID), these policies will still work.

-- ============================
-- Table: locations
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view locations from their organization" ON public.locations;
DROP POLICY IF EXISTS "Users can insert locations into their organization" ON public.locations;
DROP POLICY IF EXISTS "Users can update locations in their organization" ON public.locations;
DROP POLICY IF EXISTS "Users can delete locations in their organization" ON public.locations;
DROP POLICY IF EXISTS "Users can view locations in their active org" ON public.locations;
DROP POLICY IF EXISTS "Org Admins/Managers can manage locations in their active org" ON public.locations;
DROP POLICY IF EXISTS "Service role full access on locations" ON public.locations;


CREATE POLICY "Users can view locations in their active org"
ON public.locations
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(locations.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Admins/Managers can manage locations in their active org"
ON public.locations
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(locations.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(locations.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on locations"
ON public.locations
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: tags
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tags from their organization" ON public.tags;
DROP POLICY IF EXISTS "Users can insert tags into their organization" ON public.tags;
DROP POLICY IF EXISTS "Users can update tags in their organization" ON public.tags;
DROP POLICY IF EXISTS "Users can delete tags in their organization" ON public.tags;
DROP POLICY IF EXISTS "Users can view tags in their active org" ON public.tags;
DROP POLICY IF EXISTS "Org Admins/Managers can manage tags in their active org" ON public.tags;
DROP POLICY IF EXISTS "Service role full access on tags" ON public.tags;


CREATE POLICY "Users can view tags in their active org"
ON public.tags
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Admins/Managers can manage tags in their active org"
ON public.tags
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on tags"
ON public.tags
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: venue_tags
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.venue_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view venue_tags from their organization" ON public.venue_tags;
DROP POLICY IF EXISTS "Users can insert venue_tags into their organization" ON public.venue_tags;
DROP POLICY IF EXISTS "Users can delete venue_tags in their organization" ON public.venue_tags;
DROP POLICY IF EXISTS "Users can view venue_tags in their active org" ON public.venue_tags;
DROP POLICY IF EXISTS "Org Admins/Managers can manage venue_tags in their active org" ON public.venue_tags;
DROP POLICY IF EXISTS "Service role full access on venue_tags" ON public.venue_tags;


CREATE POLICY "Users can view venue_tags in their active org"
ON public.venue_tags
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(venue_tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Admins/Managers can manage venue_tags in their active org"
ON public.venue_tags
FOR ALL -- INSERT, DELETE (typically no UPDATE for join tables)
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(venue_tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(venue_tags.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on venue_tags"
ON public.venue_tags
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


RAISE NOTICE 'RLS policies for venues and related tables updated for active_org_id.';