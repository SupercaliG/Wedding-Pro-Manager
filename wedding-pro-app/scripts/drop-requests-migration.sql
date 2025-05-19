-- Create drop_requests table
CREATE TABLE IF NOT EXISTS drop_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_assignment_id UUID NOT NULL REFERENCES job_assignments(id) ON DELETE CASCADE,
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'escalated')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS drop_requests_job_assignment_id_idx ON drop_requests(job_assignment_id);
CREATE INDEX IF NOT EXISTS drop_requests_requested_by_user_id_idx ON drop_requests(requested_by_user_id);
CREATE INDEX IF NOT EXISTS drop_requests_status_idx ON drop_requests(status);

-- Enable Row Level Security
ALTER TABLE drop_requests ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies

-- Employees can insert drop requests for their own job assignments
CREATE POLICY employee_insert_drop_requests ON drop_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM job_assignments ja
      WHERE ja.id = job_assignment_id
      AND ja.user_id = auth.uid()
    )
  );

-- Employees can view their own drop requests
CREATE POLICY employee_select_own_drop_requests ON drop_requests
  FOR SELECT
  TO authenticated
  USING (
    requested_by_user_id = auth.uid()
  );

-- Managers can view drop requests for jobs in their organization
CREATE POLICY manager_select_drop_requests ON drop_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN job_assignments ja ON drop_requests.job_assignment_id = ja.id
      JOIN jobs j ON ja.job_id = j.id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND p.org_id = j.org_id
    )
  );

-- Managers can update status of pending drop requests in their organization
CREATE POLICY manager_update_drop_requests ON drop_requests
  FOR UPDATE
  TO authenticated
  USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN job_assignments ja ON drop_requests.job_assignment_id = ja.id
      JOIN jobs j ON ja.job_id = j.id
      WHERE p.id = auth.uid()
      AND p.role = 'Manager'
      AND p.approval_status = 'approved'
      AND p.org_id = j.org_id
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected') AND
    resolved_by_user_id = auth.uid() AND
    resolved_at IS NOT NULL
  );

-- Admins can view all drop requests in their organization (or all if super admin)
CREATE POLICY admin_select_drop_requests ON drop_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'Admin'
      AND p.approval_status = 'approved'
      AND (
        p.org_id IS NULL OR
        EXISTS (
          SELECT 1 FROM job_assignments ja
          JOIN jobs j ON ja.job_id = j.id
          WHERE drop_requests.job_assignment_id = ja.id
          AND j.org_id = p.org_id
        )
      )
    )
  );

-- Admins can update status of any drop requests in their organization (or all if super admin)
CREATE POLICY admin_update_drop_requests ON drop_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'Admin'
      AND p.approval_status = 'approved'
      AND (
        p.org_id IS NULL OR
        EXISTS (
          SELECT 1 FROM job_assignments ja
          JOIN jobs j ON ja.job_id = j.id
          WHERE drop_requests.job_assignment_id = ja.id
          AND j.org_id = p.org_id
        )
      )
    )
  )
  WITH CHECK (
    status IN ('approved', 'rejected') AND
    resolved_by_user_id = auth.uid() AND
    resolved_at IS NOT NULL
  );

-- Create function for approving drop requests (transaction)
CREATE OR REPLACE FUNCTION approve_drop_request(
  p_drop_request_id UUID,
  p_resolver_user_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_job_assignment_id UUID;
  v_job_id UUID;
  v_result JSONB;
BEGIN
  -- Get the job_assignment_id from the drop request
  SELECT job_assignment_id, job_assignment.job_id
  INTO v_job_assignment_id, v_job_id
  FROM drop_requests
  JOIN job_assignments ON drop_requests.job_assignment_id = job_assignments.id
  WHERE drop_requests.id = p_drop_request_id;
  
  -- Update the drop request status
  UPDATE drop_requests
  SET 
    status = 'approved',
    resolved_at = NOW(),
    resolved_by_user_id = p_resolver_user_id
  WHERE id = p_drop_request_id;
  
  -- Delete the job assignment
  DELETE FROM job_assignments
  WHERE id = v_job_assignment_id;
  
  -- Update the job status to indicate it needs refilling
  UPDATE jobs
  SET status = 'available'
  WHERE id = v_job_id
  AND status = 'upcoming';
  
  v_result := jsonb_build_object(
    'success', true,
    'message', 'Drop request approved successfully'
  );
  
  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    v_result := jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;