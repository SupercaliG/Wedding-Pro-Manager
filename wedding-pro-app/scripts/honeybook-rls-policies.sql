-- Honeybook RLS Policies Migration
-- This script enforces Row-Level Security for HoneyBook-synced data

-- ==========================================
-- VENUES TABLE RLS POLICIES
-- ==========================================

-- Enable Row Level Security on the venues table
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

-- Create policy for Admins to have full access to all venues
CREATE POLICY admin_all_venues ON venues
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
      AND profiles.approval_status = 'approved'
    )
  );

-- Create policy for Managers to read venues in their organization
CREATE POLICY manager_read_venues ON venues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  );

-- Create policy for Managers to insert venues for their organization
CREATE POLICY manager_insert_venues ON venues
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  );

-- Create policy for Managers to update venues in their organization
CREATE POLICY manager_update_venues ON venues
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  );

-- Create policy for Managers to delete venues in their organization
CREATE POLICY manager_delete_venues ON venues
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  );

-- Create policy for Employees to read venues in their organization
CREATE POLICY employee_read_venues ON venues
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Employee'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = venues.org_id
    )
  );

-- ==========================================
-- JOB_REQUIRED_ROLES TABLE RLS POLICIES
-- ==========================================

-- Enable Row Level Security on the job_required_roles table
ALTER TABLE job_required_roles ENABLE ROW LEVEL SECURITY;

-- Create policy for Admins to have full access to all job_required_roles
CREATE POLICY admin_all_job_roles ON job_required_roles
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
      AND profiles.approval_status = 'approved'
    )
  );

-- Create policy for Managers to read job_required_roles in their organization
CREATE POLICY manager_read_job_roles ON job_required_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  );

-- Create policy for Managers to insert job_required_roles for their organization
CREATE POLICY manager_insert_job_roles ON job_required_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  );

-- Create policy for Managers to update job_required_roles in their organization
CREATE POLICY manager_update_job_roles ON job_required_roles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  );

-- Create policy for Managers to delete job_required_roles in their organization
CREATE POLICY manager_delete_job_roles ON job_required_roles
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  );

-- Create policy for Employees to read job_required_roles in their organization
CREATE POLICY employee_read_job_roles ON job_required_roles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN jobs j ON p.org_id = j.org_id
      WHERE p.id = auth.uid()
      AND p.role = 'Employee'
      AND p.approval_status = 'approved'
      AND j.id = job_required_roles.job_id
    )
  );

-- ==========================================
-- ADDITIONAL JOBS TABLE RLS POLICIES FOR HONEYBOOK
-- ==========================================

-- Note: The existing RLS policies for the jobs table already filter by org_id,
-- which ensures proper data isolation for HoneyBook-synced jobs.
-- However, we might want to add specific policies for HoneyBook-synced jobs.

-- Create policy to prevent manual deletion of HoneyBook-synced jobs by Managers
-- (They should only be managed through HoneyBook)
CREATE POLICY prevent_delete_honeybook_jobs ON jobs
  FOR DELETE
  TO authenticated
  USING (
    -- Allow deletion only if the job is not a HoneyBook job (honeybook_project_id is null)
    -- OR if the user is an Admin (who can delete any job)
    honeybook_project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
      AND profiles.approval_status = 'approved'
    )
  );

-- Create policy to restrict updates to HoneyBook-synced jobs
-- (Only certain fields should be updatable by Managers)
CREATE POLICY restrict_update_honeybook_jobs ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- Allow updates if the job is not a HoneyBook job (honeybook_project_id is null)
    -- OR if the user is an Admin
    -- OR if the user is a Manager in the same organization
    honeybook_project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
      AND profiles.approval_status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  )
  WITH CHECK (
    -- Same conditions as USING clause
    honeybook_project_id IS NULL
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Admin'
      AND profiles.approval_status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- ==========================================
-- TESTING QUERIES
-- ==========================================

-- These queries can be used to test the RLS policies
-- Note: Replace placeholders with actual values when testing

/*
-- Test 1: Verify a user from Org A cannot access jobs from Org B
-- Step 1: Set the current user context (e.g., a Manager from Org A)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "user_id_from_org_a", "role": "authenticated"}';

-- Step 2: Try to select jobs from Org B
SELECT * FROM jobs WHERE org_id = 'org_b_id';
-- Expected: No rows returned

-- Test 2: Verify different roles within the same organization
-- Step 1: Set the current user context (e.g., an Employee from Org A)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "employee_user_id", "role": "authenticated"}';

-- Step 2: Try to select jobs from their organization
SELECT * FROM jobs WHERE org_id = 'org_a_id';
-- Expected: Rows returned (read access allowed)

-- Step 3: Try to update a job
UPDATE jobs SET title = 'Updated Title' WHERE id = 'job_id' AND org_id = 'org_a_id';
-- Expected: Error (update access denied for Employees)

-- Test 3: Verify HoneyBook-specific policies
-- Step 1: Set the current user context (e.g., a Manager from Org A)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub": "manager_user_id", "role": "authenticated"}';

-- Step 2: Try to delete a HoneyBook-synced job
DELETE FROM jobs WHERE id = 'honeybook_job_id' AND org_id = 'org_a_id' AND honeybook_project_id IS NOT NULL;
-- Expected: No rows deleted (delete access denied for HoneyBook jobs)

-- Step 3: Try to update a HoneyBook-synced job
UPDATE jobs SET title = 'Updated Title' WHERE id = 'honeybook_job_id' AND org_id = 'org_a_id' AND honeybook_project_id IS NOT NULL;
-- Expected: Row updated (limited update access allowed for Managers)
*/