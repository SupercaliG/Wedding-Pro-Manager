-- Supabase Custom Access Token Hook to add user_role and org_id to JWT
--
-- This script creates a PostgreSQL function that will be used as a
-- "Custom Access Token" hook in Supabase Auth.
-- It fetches 'role' and 'org_id' from the 'public.profiles' table
-- for the authenticated user and adds them as custom claims to the JWT.
--
-- Claims added:
-- - app_metadata_user_role: The user's role from profiles.role
-- - app_metadata_user_org_id: The user's organization ID from profiles.org_id

-- 1. Define the PostgreSQL function
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer -- Important for accessing other tables securely
set search_path = public -- Ensures 'profiles' table is found
as $$
declare
  claims jsonb;
  user_role text;
  user_org_id uuid;
begin
  -- Get existing claims from the event
  claims := event->'claims';

  -- Fetch role and org_id from public.profiles table
  -- The user_id in the event is text, so it needs to be cast to UUID
  select
    p.role,
    p.org_id
  into
    user_role,
    user_org_id
  from
    public.profiles p
  where
    p.id = (event->>'user_id')::uuid;

  -- Ensure 'app_metadata' exists in claims, create if not
  if jsonb_typeof(claims->'app_metadata') is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;

  -- Add custom claims if values were found
  -- If role is null, it won't be added. If org_id is null, it won't be added.
  -- This is generally fine, as RLS policies can check for existence or null.
  if user_role is not null then
    claims := jsonb_set(claims, '{app_metadata, app_metadata_user_role}', to_jsonb(user_role));
  else
    -- Optionally, set a default or remove if it exists from a previous state
    -- For now, we simply don't add it if null.
    -- To remove: claims := claims - '{app_metadata, app_metadata_user_role}';
    -- To set default: claims := jsonb_set(claims, '{app_metadata, app_metadata_user_role}', to_jsonb("default_role_value"));
    raise log 'User role not found for user_id: %', (event->>'user_id');
  end if;

  if user_org_id is not null then
    claims := jsonb_set(claims, '{app_metadata, app_metadata_user_org_id}', to_jsonb(user_org_id));
  else
    raise log 'User org_id not found for user_id: %', (event->>'user_id');
  end if;

  -- Update the 'claims' in the original event
  event := jsonb_set(event, '{claims}', claims);

  -- Return the modified event
  return event;
end;
$$;

-- 2. Grant necessary permissions
-- Grant execute on the function to supabase_auth_admin (the role that runs auth hooks)
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- The supabase_auth_admin role needs to be able to SELECT from public.profiles
-- Ensure this grant is specific enough for your security requirements.
-- Granting SELECT on specific columns (id, role, org_id) is more secure.
grant select (id, role, org_id) on table public.profiles to supabase_auth_admin;

-- Revoke execution from other roles to prevent direct invocation if desired,
-- though Supabase typically handles hook security.
-- revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon;

-- 3. How to enable this hook:
--    a. Go to your Supabase project dashboard.
--    b. Navigate to "Authentication" -> "Hooks".
--    c. In the "Custom Access Token Hook" section, select "public.custom_access_token_hook"
--       from the dropdown menu.
--    d. Save the changes.
--
--    For local development (Supabase CLI):
--    You might need to configure this in your `supabase/config.toml` if not using the dashboard:
--    [auth.hooks]
--    custom_access_token = "public.custom_access_token_hook"
--
--    Or ensure your local Supabase Auth service (GoTrue) is configured with environment variables:
--    GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_ENABLED=true
--    GOTRUE_HOOK_CUSTOM_ACCESS_TOKEN_URI="pg-functions://postgres/public/custom_access_token_hook" (adjust if schema/db differs)

-- 4. Verification:
--    After enabling the hook and a user logs in or their token is refreshed:
--    a. Client-side:
--       - Get the access token: `const { data, error } = await supabase.auth.getSession()`
--       - Decode the `data.session.access_token` using a JWT decoding library (e.g., `jwt-decode`).
--       - Inspect the decoded token's `app_metadata` object for `app_metadata_user_role` and `app_metadata_user_org_id`.
--    b. Server-side (e.g., in another Edge Function or RLS policy):
--       - In RLS policies, you can use:
--         `auth.jwt()->>'app_metadata_user_role'`
--         `auth.jwt()->>'app_metadata_user_org_id'`
--       - In Edge Functions, retrieve the JWT from the Authorization header, verify it, and then inspect its payload.
--
-- Note on `security definer`:
-- Using `security definer` allows the function to execute with the permissions of the user who defined it
-- (typically a superuser or the `postgres` role during migrations) rather than the calling user (`supabase_auth_admin`).
-- This is often necessary for auth hooks to access tables like `public.profiles` if `supabase_auth_admin`
-- doesn't have direct grants. The `set search_path = public` is good practice with `security definer`
-- to control the schema resolution. Ensure `public.profiles` exists and has `id`, `role`, and `org_id` columns.