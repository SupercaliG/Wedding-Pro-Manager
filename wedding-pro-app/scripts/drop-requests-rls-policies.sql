-- Enable Row Level Security on drop_requests table
ALTER TABLE drop_requests ENABLE ROW LEVEL SECURITY;

-- Create policy for employees to insert their own drop requests
CREATE POLICY "Employees can create drop requests for their own job assignments"
ON drop_requests
FOR INSERT
TO authenticated
WITH CHECK (
  -- Check if the user is an employee
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Employee'
  )
  -- Check if the job assignment belongs to the user
  AND EXISTS (
    SELECT 1 FROM job_assignments
    WHERE job_assignments.id = drop_requests.job_assignment_id
    AND job_assignments.user_id = auth.uid()
  )
);

-- Create policy for employees to view their own drop requests
CREATE POLICY "Employees can view their own drop requests"
ON drop_requests
FOR SELECT
TO authenticated
USING (
  -- User is the one who created the drop request
  requested_by_user_id = auth.uid()
);

-- Create policy for managers to view drop requests for jobs in their organization
CREATE POLICY "Managers can view drop requests for jobs in their organization"
ON drop_requests
FOR SELECT
TO authenticated
USING (
  -- Check if the user is a manager
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Manager'
  )
  -- Check if the job is in the manager's organization
  AND EXISTS (
    SELECT 1 FROM job_assignments
    JOIN jobs ON job_assignments.job_id = jobs.id
    JOIN profiles ON profiles.org_id = jobs.org_id
    WHERE job_assignments.id = drop_requests.job_assignment_id
    AND profiles.id = auth.uid()
  )
);

-- Create policy for managers to update pending drop requests in their organization
CREATE POLICY "Managers can update pending drop requests in their organization"
ON drop_requests
FOR UPDATE
TO authenticated
USING (
  -- Check if the user is a manager
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Manager'
  )
  -- Check if the drop request is pending (not escalated)
  AND drop_requests.status = 'pending'
  -- Check if the job is in the manager's organization
  AND EXISTS (
    SELECT 1 FROM job_assignments
    JOIN jobs ON job_assignments.job_id = jobs.id
    JOIN profiles ON profiles.org_id = jobs.org_id
    WHERE job_assignments.id = drop_requests.job_assignment_id
    AND profiles.id = auth.uid()
  )
)
WITH CHECK (
  -- Only allow updating to 'approved' or 'rejected' status
  drop_requests.status IN ('approved', 'rejected')
  -- Ensure resolved_by_user_id is set to the current user
  AND drop_requests.resolved_by_user_id = auth.uid()
  -- Ensure resolved_at is set
  AND drop_requests.resolved_at IS NOT NULL
);

-- Create policy for admins to view all drop requests in their organization (or all if super admin)
CREATE POLICY "Admins can view drop requests in their organization or all if super admin"
ON drop_requests
FOR SELECT
TO authenticated
USING (
  -- Check if the user is an admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Admin'
  )
  -- Either the admin is a super admin (org_id is null) or the job is in their organization
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.org_id IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments
      JOIN jobs ON job_assignments.job_id = jobs.id
      JOIN profiles ON profiles.org_id = jobs.org_id
      WHERE job_assignments.id = drop_requests.job_assignment_id
      AND profiles.id = auth.uid()
    )
  )
);

-- Create policy for admins to update escalated or pending drop requests
CREATE POLICY "Admins can update escalated or pending drop requests"
ON drop_requests
FOR UPDATE
TO authenticated
USING (
  -- Check if the user is an admin
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Admin'
  )
  -- Check if the drop request is escalated or pending
  AND drop_requests.status IN ('escalated', 'pending')
  -- Either the admin is a super admin (org_id is null) or the job is in their organization
  AND (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.org_id IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM job_assignments
      JOIN jobs ON job_assignments.job_id = jobs.id
      JOIN profiles ON profiles.org_id = jobs.org_id
      WHERE job_assignments.id = drop_requests.job_assignment_id
      AND profiles.id = auth.uid()
    )
  )
)
WITH CHECK (
  -- Only allow updating to 'approved' or 'rejected' status
  drop_requests.status IN ('approved', 'rejected')
  -- Ensure resolved_by_user_id is set to the current user
  AND drop_requests.resolved_by_user_id = auth.uid()
  -- Ensure resolved_at is set
  AND drop_requests.resolved_at IS NOT NULL
);

-- Create policy for the system (service role) to update drop requests for SLA escalation
-- This is used by the scheduled function
CREATE POLICY "System can escalate pending drop requests that exceed SLA"
ON drop_requests
FOR UPDATE
USING (
  -- This policy will be bypassed by the service role key
  false
)
WITH CHECK (
  -- Only allow updating to 'escalated' status
  drop_requests.status = 'escalated'
);