-- Create table for storing HoneyBook webhook registrations
CREATE TABLE IF NOT EXISTS honeybook_webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  webhook_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  target_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(org_id, event_type)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_honeybook_webhooks_org_id ON honeybook_webhooks(org_id);

-- Add RLS policies
ALTER TABLE honeybook_webhooks ENABLE ROW LEVEL SECURITY;

-- Only Admin users can view/manage HoneyBook webhooks for their organization
CREATE POLICY honeybook_webhooks_org_admin_policy ON honeybook_webhooks
  USING (org_id IN (
    SELECT org_id FROM profiles
    WHERE id = auth.uid() AND role = 'Admin' AND approval_status = 'approved'
  ));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_honeybook_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_honeybook_webhooks_updated_at
BEFORE UPDATE ON honeybook_webhooks
FOR EACH ROW
EXECUTE FUNCTION update_honeybook_webhooks_updated_at();

-- Create audit log trigger for honeybook_webhooks
CREATE OR REPLACE FUNCTION log_honeybook_webhooks_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'INSERT', 'honeybook_webhooks', NEW.id, NULL, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE',
      'honeybook_webhooks',
      NEW.id,
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'DELETE',
      'honeybook_webhooks',
      OLD.id,
      row_to_json(OLD),
      NULL
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER log_honeybook_webhooks_changes
AFTER INSERT OR UPDATE OR DELETE ON honeybook_webhooks
FOR EACH ROW
EXECUTE FUNCTION log_honeybook_webhooks_changes();