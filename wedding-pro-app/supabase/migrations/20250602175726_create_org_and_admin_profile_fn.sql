-- Enable unaccent extension if not already enabled
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE OR REPLACE FUNCTION public.slugify(value TEXT)
RETURNS TEXT AS $$
BEGIN
  -- Remove accents
  value := unaccent(value);
  -- Convert to lowercase
  value := lower(value);
  -- Replace non-alphanumeric characters with a hyphen
  value := regexp_replace(value, '[^a-z0-9]+', '-', 'g');
  -- Remove leading and trailing hyphens
  value := regexp_replace(value, '^-+|-+$', '', 'g');
  RETURN value;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Grant execute on slugify to roles that might call it directly or if needed by other functions
GRANT EXECUTE ON FUNCTION public.slugify(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slugify(text) TO service_role; -- Or anon if applicable


CREATE OR REPLACE FUNCTION public.create_org_and_admin_profile(
    new_user_id uuid,
    new_org_name text,
    new_org_contact_email text,
    new_user_full_name text,
    new_user_phone_number text,
    OUT created_org_db_id uuid, -- UUID primary key of the new org
    OUT generated_organization_id text -- Textual unique ID (slug)
)
RETURNS record
LANGUAGE plpgsql
SECURITY DEFINER
-- Set a search_path to ensure functions like slugify are found if they are in a different schema.
-- If slugify is in public schema and public is in default search_path, this might not be strictly needed.
-- SET search_path = public; 
AS $$
DECLARE
    base_slug text;
    temp_unique_id text;
    suffix integer;
BEGIN
    -- 1. Generate unique organization_id (slug)
    base_slug := public.slugify(new_org_name); -- Explicitly schema-qualify if needed
    temp_unique_id := base_slug;
    suffix := 1;
    LOOP
        IF NOT EXISTS (SELECT 1 FROM public.orgs WHERE organization_id = temp_unique_id) THEN
            generated_organization_id := temp_unique_id;
            EXIT;
        END IF;
        temp_unique_id := base_slug || '-' || suffix;
        suffix := suffix + 1;
        -- Safety break for very unlikely infinite loop
        IF suffix > 100 THEN 
            RAISE EXCEPTION 'Could not generate unique organization ID after 100 attempts for %', new_org_name;
        END IF;
    END LOOP;

    -- 2. Create the organization
    INSERT INTO public.orgs (name, organization_id, owner_user_id, contact_email)
    VALUES (new_org_name, generated_organization_id, new_user_id, new_org_contact_email)
    RETURNING id INTO created_org_db_id;

    -- 3. Insert or update the user's profile
    INSERT INTO public.profiles (id, org_id, role, approval_status, full_name, phone_number)
    VALUES (new_user_id, created_org_db_id, 'admin', 'approved', new_user_full_name, new_user_phone_number)
    ON CONFLICT (id)
    DO UPDATE SET
        org_id = EXCLUDED.org_id,
        role = EXCLUDED.role,
        approval_status = EXCLUDED.approval_status,
        full_name = EXCLUDED.full_name,
        phone_number = EXCLUDED.phone_number;

    -- 4. Create a record in user_organization_memberships
    -- Ensure this table exists and has appropriate RLS if accessed directly elsewhere.
    -- The SECURITY DEFINER function handles its insertion here.
    INSERT INTO public.user_organization_memberships (user_id, organization_id, role)
    VALUES (new_user_id, generated_organization_id, 'admin');
    
END;
$$;

-- Grant execute permission to the 'authenticated' role
-- The server action will call this as an authenticated user (the one just signed up)
GRANT EXECUTE ON FUNCTION public.create_org_and_admin_profile(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_org_and_admin_profile(uuid, text, text, text, text) TO service_role; -- Also allow service_role if needed for other admin tasks

-- Revoke default public execute if you want to be very strict, though granting to specific roles is usually enough.
-- REVOKE EXECUTE ON FUNCTION public.create_org_and_admin_profile(uuid, text, text, text, text) FROM PUBLIC;