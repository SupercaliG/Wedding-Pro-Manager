-- Migration to update RLS policies for jobs and related tables using active_org_id.
-- Timestamp: 20250601235502 (placeholder)

-- Ensure the helper function internal_get_text_org_id_from_uuid exists.
-- It should be created by a preceding migration (20250601235501_rls_helper_function.sql).

-- ============================
-- Table: jobs
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies that might conflict or are based on profiles.org_id
DROP POLICY IF EXISTS "admin_all_access" ON public.jobs;
DROP POLICY IF EXISTS "manager_read_jobs" ON public.jobs;
DROP POLICY IF EXISTS "manager_insert_jobs" ON public.jobs;
DROP POLICY IF EXISTS "manager_update_jobs" ON public.jobs;
DROP POLICY IF EXISTS "manager_delete_jobs" ON public.jobs;
DROP POLICY IF EXISTS "employee_read_jobs" ON public.jobs;
DROP POLICY IF EXISTS "Users can view jobs in their active org" ON public.jobs;
DROP POLICY IF EXISTS "Org Members can manage jobs in their active org based on role" ON public.jobs;
DROP POLICY IF EXISTS "Service role full access on jobs" ON public.jobs;


-- New Policies for jobs using active_org_id
CREATE POLICY "Users can view jobs in their active org"
ON public.jobs
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(jobs.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
);

CREATE POLICY "Org Members can manage jobs in their active org based on role"
ON public.jobs
FOR ALL -- INSERT, UPDATE, DELETE
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(jobs.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager') -- Admins and Managers can manage
  )
)
WITH CHECK (
  internal_get_text_org_id_from_uuid(jobs.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

-- Policy for service_role (bypasses RLS)
CREATE POLICY "Service role full access on jobs"
ON public.jobs
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: job_assignments
-- Links to jobs.org_id (UUID)
-- ============================
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_assignments in their active org" ON public.job_assignments;
DROP POLICY IF EXISTS "Org Members can manage job_assignments in active org based on role" ON public.job_assignments;
DROP POLICY IF EXISTS "Employees can view their own specific job assignments" ON public.job_assignments;
DROP POLICY IF EXISTS "Service role full access on job_assignments" ON public.job_assignments;


CREATE POLICY "Users can view job_assignments in their active org"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Members can manage job_assignments in active org based on role"
ON public.job_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Employees can view their own specific job assignments"
ON public.job_assignments
FOR SELECT
TO authenticated
USING (
  job_assignments.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.jobs j
    JOIN public.user_organization_memberships uom ON internal_get_text_org_id_from_uuid(j.org_id) = uom.organization_id
    WHERE j.id = job_assignments.job_id AND uom.user_id = auth.uid()
    AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT -- Ensure the membership is for the active org
  )
);


CREATE POLICY "Service role full access on job_assignments"
ON public.job_assignments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: drop_requests
-- Links to job_assignments -> jobs.org_id (UUID)
-- ============================
ALTER TABLE public.drop_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employee_insert_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "employee_select_own_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "manager_select_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "manager_update_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "admin_select_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "admin_update_drop_requests" ON public.drop_requests;
DROP POLICY IF EXISTS "Employees can create drop requests for their own job assignments" ON public.drop_requests;
DROP POLICY IF EXISTS "Employees can view their own drop requests" ON public.drop_requests;
DROP POLICY IF EXISTS "Managers can view drop requests for jobs in their organization" ON public.drop_requests;
DROP POLICY IF EXISTS "Managers can update pending drop requests in their organization" ON public.drop_requests;
DROP POLICY IF EXISTS "Admins can view drop requests in their organization or all if super admin" ON public.drop_requests;
DROP POLICY IF EXISTS "Admins can update escalated or pending drop requests" ON public.drop_requests;
DROP POLICY IF EXISTS "System can escalate pending drop requests that exceed SLA" ON public.drop_requests;
DROP POLICY IF EXISTS "Employees can create drop_requests for their assignments in active org" ON public.drop_requests;
DROP POLICY IF EXISTS "Users can view their own drop_requests if related job is in active org" ON public.drop_requests;
DROP POLICY IF EXISTS "Org Admins/Managers can view drop_requests in their active org" ON public.drop_requests;
DROP POLICY IF EXISTS "Org Admins/Managers can update drop_requests in their active org" ON public.drop_requests;
DROP POLICY IF EXISTS "Service role full access on drop_requests" ON public.drop_requests;


CREATE POLICY "Employees can create drop_requests for their assignments in active org"
ON public.drop_requests
FOR INSERT
TO authenticated
WITH CHECK (
  requested_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.id = drop_requests.job_assignment_id
    AND ja.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Users can view their own drop_requests if related job is in active org"
ON public.drop_requests
FOR SELECT
TO authenticated
USING (
  requested_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.id = drop_requests.job_assignment_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Admins/Managers can view drop_requests in their active org"
ON public.drop_requests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.id = drop_requests.job_assignment_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Org Admins/Managers can update drop_requests in their active org"
ON public.drop_requests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.id = drop_requests.job_assignment_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  resolved_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON ja.job_id = j.id
    WHERE ja.id = drop_requests.job_assignment_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Service role full access on drop_requests"
ON public.drop_requests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: job_interests
-- Links to jobs.org_id (UUID)
-- ============================
ALTER TABLE public.job_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own job_interests for jobs in active org" ON public.job_interests;
DROP POLICY IF EXISTS "Org Admins/Managers can view job_interests for jobs in their active org" ON public.job_interests;
DROP POLICY IF EXISTS "Service role full access on job_interests" ON public.job_interests;


CREATE POLICY "Users can manage their own job_interests for jobs in active org"
ON public.job_interests
FOR ALL
TO authenticated
USING (
  job_interests.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_interests.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
)
WITH CHECK (
  job_interests.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_interests.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Admins/Managers can view job_interests for jobs in their active org"
ON public.job_interests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_interests.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on job_interests"
ON public.job_interests
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: job_required_roles
-- Links to jobs.org_id (UUID)
-- ============================
ALTER TABLE public.job_required_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view job_required_roles for jobs in their active org" ON public.job_required_roles;
DROP POLICY IF EXISTS "Org Admins/Managers can manage job_required_roles for jobs in active org" ON public.job_required_roles;
DROP POLICY IF EXISTS "Service role full access on job_required_roles" ON public.job_required_roles;


CREATE POLICY "Users can view job_required_roles for jobs in their active org"
ON public.job_required_roles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_required_roles.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Org Admins/Managers can manage job_required_roles for jobs in active org"
ON public.job_required_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_required_roles.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_required_roles.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Service role full access on job_required_roles"
ON public.job_required_roles
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

RAISE NOTICE 'RLS policies for jobs and related tables updated for active_org_id.';