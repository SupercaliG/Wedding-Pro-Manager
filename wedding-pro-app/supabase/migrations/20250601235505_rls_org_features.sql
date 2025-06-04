-- Migration to update RLS policies for organization features tables using active_org_id.
-- Timestamp: 20250601235505 (placeholder)

-- Ensure the helper function internal_get_text_org_id_from_uuid exists.
-- It should be created by a preceding migration (20250601235501_rls_helper_function.sql).

-- ============================
-- Table: org_announcements
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.org_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view announcements for their organization" ON public.org_announcements;
DROP POLICY IF EXISTS "Admins and managers can insert announcements" ON public.org_announcements;
DROP POLICY IF EXISTS "Admins and managers can update announcements" ON public.org_announcements;
DROP POLICY IF EXISTS "Admins and managers can delete announcements" ON public.org_announcements;
DROP POLICY IF EXISTS "Users can view org_announcements for their active org" ON public.org_announcements;
DROP POLICY IF EXISTS "Org Admins/Managers can manage org_announcements for their active org" ON public.org_announcements;
DROP POLICY IF EXISTS "Service role full access on org_announcements" ON public.org_announcements;


CREATE POLICY "Users can view org_announcements for their active org"
ON public.org_announcements
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(org_announcements.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Admins/Managers can manage org_announcements for their active org"
ON public.org_announcements
FOR ALL
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(org_announcements.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(org_announcements.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
  -- For INSERT, the user_id should be set to auth.uid(). This is better handled
  -- by the application logic or a default value/trigger, as TG_OP is not available here.
  -- The RLS policy ensures the user performing the action is an admin/manager of the active org.
);

CREATE POLICY "Service role full access on org_announcements"
ON public.org_announcements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: announcement_engagements
-- Links to org_announcements.org_id (UUID)
-- ============================
ALTER TABLE public.announcement_engagements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own engagement records" ON public.announcement_engagements;
DROP POLICY IF EXISTS "Users can insert their own engagement records" ON public.announcement_engagements;
DROP POLICY IF EXISTS "Admins can view all engagement records for their organization" ON public.announcement_engagements;
DROP POLICY IF EXISTS "Users can manage their own announcement_engagements for active org announcements" ON public.announcement_engagements;
DROP POLICY IF EXISTS "Org Admins/Managers can view announcement_engagements for their active org" ON public.announcement_engagements;
DROP POLICY IF EXISTS "Service role full access on announcement_engagements" ON public.announcement_engagements;


CREATE POLICY "Users can manage their own announcement_engagements for active org announcements"
ON public.announcement_engagements
FOR ALL -- SELECT, INSERT, UPDATE, DELETE
TO authenticated
USING (
  announcement_engagements.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.org_announcements oa
    WHERE oa.id = announcement_engagements.announcement_id
    AND internal_get_text_org_id_from_uuid(oa.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
)
WITH CHECK (
  announcement_engagements.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.org_announcements oa
    WHERE oa.id = announcement_engagements.announcement_id
    AND internal_get_text_org_id_from_uuid(oa.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Admins/Managers can view announcement_engagements for their active org"
ON public.announcement_engagements
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.org_announcements oa
    WHERE oa.id = announcement_engagements.announcement_id
    AND internal_get_text_org_id_from_uuid(oa.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on announcement_engagements"
ON public.announcement_engagements
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: audit_logs
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies, including the ones with combined commands
DROP POLICY IF EXISTS "Org Admins/Managers can view audit_logs for their active org" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "No direct updates or deletes on audit_logs for authenticated users" ON public.audit_logs; -- Old combined name
DROP POLICY IF EXISTS "Service role can update/delete audit_logs if necessary (e.g. for GDPR)" ON public.audit_logs; -- Old combined name

-- New specific policies (add individual drops for idempotency if script is re-run after this fix)
DROP POLICY IF EXISTS "Authenticated users cannot update audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users cannot delete audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can update audit_logs for GDPR" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can delete audit_logs for GDPR" ON public.audit_logs;


CREATE POLICY "Org Admins/Managers can view audit_logs for their active org"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(audit_logs.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

-- Audit logs should generally be append-only by the system (service_role)
CREATE POLICY "Service role can insert audit_logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Prevent direct updates by authenticated users to maintain integrity
CREATE POLICY "Authenticated users cannot update audit_logs"
ON public.audit_logs
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false); -- Ensures new/modified data would also be rejected

-- Prevent direct deletes by authenticated users to maintain integrity
CREATE POLICY "Authenticated users cannot delete audit_logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (false);

-- Allow service role to update audit_logs if necessary (e.g. for GDPR)
CREATE POLICY "Service role can update audit_logs for GDPR"
ON public.audit_logs
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true); -- Ensures updated rows still meet the condition (which is 'true')

-- Allow service role to delete audit_logs if necessary (e.g. for GDPR)
CREATE POLICY "Service role can delete audit_logs for GDPR"
ON public.audit_logs
FOR DELETE
TO service_role
USING (true);


-- ============================
-- Table: notifications
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications; -- Old policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can view their own notifications if related to active org" ON public.notifications;
DROP POLICY IF EXISTS "Org Admins/Managers can view all notifications for their active org" ON public.notifications;
DROP POLICY IF EXISTS "Service role can manage notifications" ON public.notifications;


CREATE POLICY "Users can view their own notifications if related to active org"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  notifications.user_id = auth.uid() AND
  internal_get_text_org_id_from_uuid(notifications.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Admins/Managers can view all notifications for their active org"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(notifications.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

-- Notifications are typically created and managed by the system (service_role)
CREATE POLICY "Service role can manage notifications"
ON public.notifications
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


RAISE NOTICE 'RLS policies for organization features tables updated for active_org_id.';