-- Enable Row Level Security for job_interests table
ALTER TABLE job_interests ENABLE ROW LEVEL SECURITY;

-- Create policy for employees to insert their own interest records
CREATE POLICY "Employees can express interest in jobs"
ON job_interests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Create policy for employees to select their own interest records
CREATE POLICY "Employees can view their own interest records"
ON job_interests
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for employees to delete their own interest records
CREATE POLICY "Employees can withdraw their interest"
ON job_interests
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create policy for managers to view interest records for jobs in their organization
CREATE POLICY "Managers can view interest records for their organization's jobs"
ON job_interests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM jobs
    JOIN profiles ON profiles.org_id = jobs.org_id
    WHERE 
      jobs.id = job_interests.job_id
      AND profiles.id = auth.uid()
      AND profiles.role IN ('Manager', 'Admin')
  )
);

-- Create policy for admins to view all interest records
CREATE POLICY "Admins can view all interest records"
ON job_interests
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE 
      profiles.id = auth.uid()
      AND profiles.role = 'Admin'
  )
);