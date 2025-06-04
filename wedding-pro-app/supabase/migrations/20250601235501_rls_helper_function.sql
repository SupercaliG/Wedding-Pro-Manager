-- Migration to create RLS helper function.
-- Timestamp: 20250601235501 (placeholder)

-- Helper function to get the TEXT organization_id from a UUID org_id
CREATE OR REPLACE FUNCTION internal_get_text_org_id_from_uuid(uuid_org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT organization_id FROM public.orgs WHERE id = uuid_org_id;
$$;

COMMENT ON FUNCTION internal_get_text_org_id_from_uuid(UUID) IS 'Returns the TEXT organization_id from orgs table based on its UUID primary key.';

RAISE NOTICE 'RLS helper function internal_get_text_org_id_from_uuid created/updated.';