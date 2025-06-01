-- Update RLS policies on public.profiles to use JWT claims

-- Policy: Admins can update profiles in their org
ALTER POLICY "Admins can update profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Admin') AND ((auth.jwt()->>'app_metadata_user_org_id')::uuid = profiles.org_id));

-- Policy: Admins can view profiles in their org
ALTER POLICY "Admins can view profiles in their org"
ON public.profiles
FOR SELECT
TO authenticated
USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Admin') AND ((auth.jwt()->>'app_metadata_user_org_id')::uuid = profiles.org_id));

-- Policy: Managers can update employee profiles in their org
ALTER POLICY "Managers can update employee profiles in their org"
ON public.profiles
FOR UPDATE
TO authenticated
USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Manager') AND ((auth.jwt()->>'app_metadata_user_org_id')::uuid = profiles.org_id) AND (profiles.role = 'Employee'::text));

-- Policy: Managers can view employee profiles in their org
ALTER POLICY "Managers can view employee profiles in their org"
ON public.profiles
FOR SELECT
TO authenticated
USING (((auth.jwt()->>'app_metadata_user_role')::text = 'Manager') AND ((auth.jwt()->>'app_metadata_user_org_id')::uuid = profiles.org_id) AND (profiles.role = 'Employee'::text));