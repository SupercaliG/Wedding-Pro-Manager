-- Enable RLS for orgs table
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;

-- Allow admins full access to their own organization
CREATE POLICY "Admins can manage their own organization" ON orgs
FOR ALL
TO authenticated
USING (auth.uid() = owner_user_id)
WITH CHECK (auth.uid() = owner_user_id);

-- Allow managers and employees read-only access to their organization
CREATE POLICY "Managers and employees can view their organization" ON orgs
FOR SELECT
TO authenticated
USING (id = (SELECT org_id FROM profiles WHERE id = auth.uid()));