-- Migration to update RLS policies for integrations and settings tables using active_org_id.
-- Timestamp: 20250601235506 (placeholder)

-- Ensure the helper function internal_get_text_org_id_from_uuid exists.
-- It should be created by a preceding migration (20250601235501_rls_helper_function.sql).

-- ============================
-- Table: honeybook_oauth_tokens
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.honeybook_oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org Admins can manage Honeybook OAuth tokens for their active org" ON public.honeybook_oauth_tokens;
DROP POLICY IF EXISTS "Service role full access on honeybook_oauth_tokens" ON public.honeybook_oauth_tokens;


CREATE POLICY "Org Admins can manage Honeybook OAuth tokens for their active org"
ON public.honeybook_oauth_tokens
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(honeybook_oauth_tokens.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role = 'admin'
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(honeybook_oauth_tokens.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role = 'admin'
  )
);

CREATE POLICY "Service role full access on honeybook_oauth_tokens"
ON public.honeybook_oauth_tokens
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: honeybook_webhooks
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.honeybook_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org Admins can manage Honeybook webhooks for their active org" ON public.honeybook_webhooks;
DROP POLICY IF EXISTS "Service role full access on honeybook_webhooks" ON public.honeybook_webhooks;


CREATE POLICY "Org Admins can manage Honeybook webhooks for their active org"
ON public.honeybook_webhooks
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(honeybook_webhooks.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role = 'admin'
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(honeybook_webhooks.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role = 'admin'
  )
);

CREATE POLICY "Service role full access on honeybook_webhooks"
ON public.honeybook_webhooks
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: organization_invitation_codes
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.organization_invitation_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org Admins/Managers can manage invitation codes for their active org" ON public.organization_invitation_codes;
DROP POLICY IF EXISTS "Service role full access on organization_invitation_codes" ON public.organization_invitation_codes;


CREATE POLICY "Org Admins/Managers can manage invitation codes for their active org"
ON public.organization_invitation_codes
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(organization_invitation_codes.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(organization_invitation_codes.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
  -- For INSERT, the created_by should be set to auth.uid(). This is better handled
  -- by the application logic or a default value/trigger, as TG_OP is not available here.
  -- The RLS policy ensures the user performing the action is an admin/manager of the active org.
);

CREATE POLICY "Service role full access on organization_invitation_codes"
ON public.organization_invitation_codes
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: subscriptions
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org Admins can view subscriptions for their active org" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can manage subscriptions" ON public.subscriptions;


CREATE POLICY "Org Admins can view subscriptions for their active org"
ON public.subscriptions
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(subscriptions.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role = 'admin'
  )
);

-- Subscriptions are typically managed by service_role or specific backend processes
CREATE POLICY "Service role can manage subscriptions"
ON public.subscriptions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

DO $$
BEGIN
RAISE NOTICE 'RLS policies for integrations and settings tables updated for active_org_id.';
END $$;