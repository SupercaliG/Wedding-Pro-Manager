-- Add new columns to jobs table for analytics
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS first_assigned_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS time_to_fill_duration INTERVAL,
ADD COLUMN IF NOT EXISTS assignment_to_completion_duration INTERVAL;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  org_id UUID REFERENCES orgs(id),
  action TEXT NOT NULL,
  details JSONB,
  ip_address TEXT
);

-- Create RLS policies for audit_logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all audit logs
CREATE POLICY "Admins can view all audit logs"
ON audit_logs FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'Admin'
  )
);

-- Allow users to insert audit logs
CREATE POLICY "Authenticated users can insert audit logs"
ON audit_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create function for job_assignments trigger
CREATE OR REPLACE FUNCTION set_first_assigned_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if this is the first assignment for this job
  UPDATE jobs
  SET first_assigned_at = NOW()
  WHERE id = NEW.job_id
  AND first_assigned_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on job_assignments table
DROP TRIGGER IF EXISTS trigger_set_first_assigned_at ON job_assignments;
CREATE TRIGGER trigger_set_first_assigned_at
AFTER INSERT ON job_assignments
FOR EACH ROW
EXECUTE FUNCTION set_first_assigned_at();