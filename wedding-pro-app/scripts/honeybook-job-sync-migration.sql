-- Add HoneyBook-specific fields to the jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS honeybook_project_id TEXT,
ADD COLUMN IF NOT EXISTS honeybook_last_synced_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS honeybook_data JSONB;

-- Create index for faster lookups by HoneyBook project ID
CREATE INDEX IF NOT EXISTS idx_jobs_honeybook_project_id ON jobs(honeybook_project_id);

-- Add unique constraint to prevent duplicate HoneyBook projects for the same org
CREATE UNIQUE INDEX IF NOT EXISTS unique_org_honeybook_project
ON jobs (org_id, honeybook_project_id)
WHERE honeybook_project_id IS NOT NULL;

-- Create function to update the honeybook_last_synced_at timestamp
CREATE OR REPLACE FUNCTION update_honeybook_last_synced_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.honeybook_data IS DISTINCT FROM OLD.honeybook_data THEN
    NEW.honeybook_last_synced_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update honeybook_last_synced_at
CREATE TRIGGER update_honeybook_last_synced_at
BEFORE UPDATE ON jobs
FOR EACH ROW
WHEN (NEW.honeybook_data IS NOT NULL)
EXECUTE FUNCTION update_honeybook_last_synced_at();

-- Add audit log entries for honeybook sync operations
CREATE OR REPLACE FUNCTION log_honeybook_sync_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND NEW.honeybook_data IS DISTINCT FROM OLD.honeybook_data) THEN
    INSERT INTO audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      metadata
    ) VALUES (
      auth.uid(),
      'HONEYBOOK_SYNC',
      'jobs',
      NEW.id,
      jsonb_build_object('honeybook_data', OLD.honeybook_data),
      jsonb_build_object('honeybook_data', NEW.honeybook_data),
      jsonb_build_object(
        'honeybook_project_id', NEW.honeybook_project_id,
        'sync_time', NEW.honeybook_last_synced_at
      )
    );
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for honeybook sync audit logging
CREATE TRIGGER log_honeybook_sync_changes
AFTER UPDATE ON jobs
FOR EACH ROW
WHEN (NEW.honeybook_data IS DISTINCT FROM OLD.honeybook_data)
EXECUTE FUNCTION log_honeybook_sync_changes();