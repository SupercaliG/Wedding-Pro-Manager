-- Create table for storing HoneyBook OAuth credentials
CREATE TABLE IF NOT EXISTS honeybook_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  scope TEXT,
  UNIQUE(org_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_honeybook_oauth_tokens_org_id ON honeybook_oauth_tokens(org_id);

-- Add RLS policies
ALTER TABLE honeybook_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only Admin users can view/manage HoneyBook OAuth tokens for their organization
CREATE POLICY honeybook_oauth_tokens_org_admin_policy ON honeybook_oauth_tokens
  USING (org_id IN (
    SELECT org_id FROM profiles
    WHERE id = auth.uid() AND role = 'Admin' AND approval_status = 'approved'
  ));

-- Create function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_honeybook_oauth_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_honeybook_oauth_tokens_updated_at
BEFORE UPDATE ON honeybook_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION update_honeybook_oauth_tokens_updated_at();

-- Create audit log trigger for honeybook_oauth_tokens
CREATE OR REPLACE FUNCTION log_honeybook_oauth_tokens_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (auth.uid(), 'INSERT', 'honeybook_oauth_tokens', NEW.id, NULL, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Don't log access_token and refresh_token values for security
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'UPDATE',
      'honeybook_oauth_tokens',
      NEW.id,
      jsonb_build_object(
        'id', OLD.id,
        'org_id', OLD.org_id,
        'token_type', OLD.token_type,
        'expires_at', OLD.expires_at,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at,
        'is_active', OLD.is_active,
        'scope', OLD.scope
      ),
      jsonb_build_object(
        'id', NEW.id,
        'org_id', NEW.org_id,
        'token_type', NEW.token_type,
        'expires_at', NEW.expires_at,
        'created_at', NEW.created_at,
        'updated_at', NEW.updated_at,
        'is_active', NEW.is_active,
        'scope', NEW.scope
      )
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, table_name, record_id, old_data, new_data)
    VALUES (
      auth.uid(),
      'DELETE',
      'honeybook_oauth_tokens',
      OLD.id,
      jsonb_build_object(
        'id', OLD.id,
        'org_id', OLD.org_id,
        'token_type', OLD.token_type,
        'expires_at', OLD.expires_at,
        'created_at', OLD.created_at,
        'updated_at', OLD.updated_at,
        'is_active', OLD.is_active,
        'scope', OLD.scope
      ),
      NULL
    );
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging
CREATE TRIGGER log_honeybook_oauth_tokens_changes
AFTER INSERT OR UPDATE OR DELETE ON honeybook_oauth_tokens
FOR EACH ROW
EXECUTE FUNCTION log_honeybook_oauth_tokens_changes();