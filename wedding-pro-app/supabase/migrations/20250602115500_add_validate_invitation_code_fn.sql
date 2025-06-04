-- Migration to create a security definer function for validating invitation codes
-- and adjust RLS on organization_invitation_codes to allow anon/auth users to call it.
-- Timestamp: 20250602115500

BEGIN;

-- Part 1: Create the security definer function to validate invitation codes
CREATE OR REPLACE FUNCTION public.validate_organization_invitation_code(
    input_code TEXT
)
RETURNS TABLE (
    id UUID,
    org_id UUID,
    expires_at TIMESTAMPTZ,
    max_uses INTEGER,
    uses_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    code_data record;
BEGIN
    SELECT
        oic.id,
        oic.org_id,
        oic.expires_at,
        oic.max_uses,
        oic.uses_count
    INTO code_data
    FROM public.organization_invitation_codes oic
    WHERE oic.code = input_code;

    IF NOT FOUND THEN
        -- Optionally, you could raise an exception here,
        -- but returning empty and letting the calling code handle it is also fine.
        -- RAISE EXCEPTION 'INVITATION_CODE_NOT_FOUND';
        RETURN;
    END IF;

    -- Perform checks within the function to ensure atomicity if desired,
    -- or let the calling server-side code do it.
    -- For example, checking expiration and max_uses here:
    IF code_data.expires_at IS NOT NULL AND code_data.expires_at < NOW() THEN
        RAISE EXCEPTION 'INVITATION_CODE_EXPIRED';
    END IF;

    IF code_data.max_uses IS NOT NULL AND code_data.uses_count >= code_data.max_uses THEN
        RAISE EXCEPTION 'INVITATION_CODE_MAX_USES_REACHED';
    END IF;

    RETURN QUERY SELECT code_data.id, code_data.org_id, code_data.expires_at, code_data.max_uses, code_data.uses_count;
END;
$$;

COMMENT ON FUNCTION public.validate_organization_invitation_code(TEXT)
IS 'Validates an organization invitation code. Returns code details if valid and active, otherwise raises an error or returns empty. SECURITY DEFINER to bypass RLS for lookup.';

-- Grant execute to anon and authenticated roles so they can call this RPC
GRANT EXECUTE ON FUNCTION public.validate_organization_invitation_code(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.validate_organization_invitation_code(TEXT) TO authenticated;


-- Part 2: (Optional but Recommended) Adjust RLS on organization_invitation_codes
-- The "deny_all_for_authenticated_users" policy is very strict.
-- While the SECURITY DEFINER function bypasses RLS for its internal query,
-- it's good practice to ensure no overly broad policies exist.
-- The existing policies for org admins are fine.
-- The "deny_all_for_authenticated_users" effectively blocks any direct table access
-- by general authenticated users, which is intended.
-- No changes needed to RLS policies on organization_invitation_codes itself,
-- as access is now channeled through the SECURITY DEFINER RPC.

COMMIT;