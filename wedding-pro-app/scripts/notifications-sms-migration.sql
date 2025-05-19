-- Add SMS-specific columns to the notifications table if they don't exist
DO $$
BEGIN
    -- Add channel column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'channel'
    ) THEN
        ALTER TABLE public.notifications
        ADD COLUMN channel TEXT;
    END IF;

    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'metadata'
    ) THEN
        ALTER TABLE public.notifications
        ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;

    -- Add status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'notifications'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.notifications
        ADD COLUMN status TEXT;
    END IF;

    -- Add phone_number to users table if not exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'phone_number'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN phone_number TEXT;
    END IF;

    -- Add notification_preferences to users table if not exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'profiles'
        AND column_name = 'notification_preferences'
    ) THEN
        ALTER TABLE public.profiles
        ADD COLUMN notification_preferences JSONB NOT NULL DEFAULT '{
            "sms": true,
            "email": true,
            "in-app": true
        }'::jsonb;
    END IF;
END $$;

-- Create function to update updated_at timestamp if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $func$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp if it doesn't exist
DROP TRIGGER IF EXISTS set_notifications_updated_at ON public.notifications;
CREATE TRIGGER set_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();