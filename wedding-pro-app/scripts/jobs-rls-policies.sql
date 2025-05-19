-- Enable Row Level Security on the jobs table
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Create policy for Admins to have full access to all jobs
CREATE POLICY admin_all_access ON jobs
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

-- Create policy for Managers to read jobs in their organization
CREATE POLICY manager_read_jobs ON jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- Create policy for Managers to insert jobs for their organization
CREATE POLICY manager_insert_jobs ON jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- Create policy for Managers to update jobs in their organization
CREATE POLICY manager_update_jobs ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- Create policy for Managers to delete jobs in their organization
CREATE POLICY manager_delete_jobs ON jobs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Manager'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- Create policy for Employees to read jobs in their organization
CREATE POLICY employee_read_jobs ON jobs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'Employee'
      AND profiles.approval_status = 'approved'
      AND profiles.org_id = jobs.org_id
    )
  );

-- Note: Employees cannot insert, update, or delete jobs
-- They will only be able to read jobs in their organization

-- These policies ensure:
-- 1. Admins have full access to all jobs across all orgs
-- 2. Managers can only CRUD jobs belonging to their org
-- 3. Employees can only read jobs belonging to their organization
-- 4. Unauthenticated users have no access to jobs
-- 5. Users with 'pending' or 'rejected' approval_status have no access to jobs