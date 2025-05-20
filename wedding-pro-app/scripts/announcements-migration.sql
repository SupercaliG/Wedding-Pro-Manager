-- Note: The org_announcements table already exists in the database
-- This migration only adds the engagement tracking table and related policies

-- Create announcement engagements table
CREATE TABLE IF NOT EXISTS public.announcement_engagements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    announcement_id UUID NOT NULL REFERENCES public.org_announcements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    engagement_type TEXT NOT NULL CHECK (engagement_type IN ('view', 'dismiss', 'click')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Add indexes
CREATE INDEX IF NOT EXISTS announcement_engagements_announcement_id_idx ON public.announcement_engagements(announcement_id);
CREATE INDEX IF NOT EXISTS announcement_engagements_user_id_idx ON public.announcement_engagements(user_id);
CREATE INDEX IF NOT EXISTS announcement_engagements_engagement_type_idx ON public.announcement_engagements(engagement_type);
CREATE INDEX IF NOT EXISTS announcement_engagements_created_at_idx ON public.announcement_engagements(created_at);

-- Enable Row Level Security
ALTER TABLE public.announcement_engagements ENABLE ROW LEVEL SECURITY;

-- Users can view their own engagement records
CREATE POLICY "Users can view their own engagement records"
    ON public.announcement_engagements
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own engagement records
CREATE POLICY "Users can insert their own engagement records"
    ON public.announcement_engagements
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Admins can view all engagement records for their organization
CREATE POLICY "Admins can view all engagement records for their organization"
    ON public.announcement_engagements
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.org_announcements a ON a.id = announcement_engagements.announcement_id
            WHERE p.id = auth.uid()
            AND p.org_id = a.org_id
            AND p.role = 'Admin'
        )
    );

-- Create view for announcement analytics
CREATE OR REPLACE VIEW public.announcement_analytics AS
SELECT 
    a.id AS announcement_id,
    a.title,
    a.org_id,
    a.is_active,
    a.pinned_until,
    a.created_at,
    a.updated_at,
    COUNT(DISTINCT CASE WHEN ae.engagement_type = 'view' THEN ae.user_id END) AS view_count,
    COUNT(DISTINCT CASE WHEN ae.engagement_type = 'dismiss' THEN ae.user_id END) AS dismiss_count,
    COUNT(DISTINCT CASE WHEN ae.engagement_type = 'click' THEN ae.user_id END) AS click_count,
    CASE 
        WHEN COUNT(DISTINCT CASE WHEN ae.engagement_type = 'view' THEN ae.user_id END) > 0 THEN
            ROUND(
                (COUNT(DISTINCT CASE WHEN ae.engagement_type = 'click' THEN ae.user_id END)::NUMERIC / 
                COUNT(DISTINCT CASE WHEN ae.engagement_type = 'view' THEN ae.user_id END)::NUMERIC) * 100, 
                2
            )
        ELSE 0
    END AS click_through_rate
FROM 
    public.org_announcements a
LEFT JOIN 
    public.announcement_engagements ae ON a.id = ae.announcement_id
GROUP BY 
    a.id, a.title, a.org_id, a.is_active, a.pinned_until, a.created_at, a.updated_at;

-- Grant permissions on the view
GRANT SELECT ON public.announcement_analytics TO authenticated;

-- Add RLS policies for org_announcements if they don't already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'org_announcements' AND policyname = 'Users can view announcements for their organization'
    ) THEN
        -- Users can view announcements for their organization
        EXECUTE $POLICY$
        CREATE POLICY "Users can view announcements for their organization"
            ON public.org_announcements
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.org_id = org_announcements.org_id
                )
            );
        $POLICY$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'org_announcements' AND policyname = 'Admins and managers can insert announcements'
    ) THEN
        -- Admins and managers can insert announcements for their organization
        EXECUTE $POLICY$
        CREATE POLICY "Admins and managers can insert announcements"
            ON public.org_announcements
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.org_id = org_announcements.org_id
                    AND profiles.role IN ('Admin', 'Manager')
                )
            );
        $POLICY$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'org_announcements' AND policyname = 'Admins and managers can update announcements'
    ) THEN
        -- Admins and managers can update announcements for their organization
        EXECUTE $POLICY$
        CREATE POLICY "Admins and managers can update announcements"
            ON public.org_announcements
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.org_id = org_announcements.org_id
                    AND profiles.role IN ('Admin', 'Manager')
                )
            );
        $POLICY$;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'org_announcements' AND policyname = 'Admins and managers can delete announcements'
    ) THEN
        -- Admins and managers can delete announcements for their organization
        EXECUTE $POLICY$
        CREATE POLICY "Admins and managers can delete announcements"
            ON public.org_announcements
            FOR DELETE
            USING (
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE profiles.id = auth.uid()
                    AND profiles.org_id = org_announcements.org_id
                    AND profiles.role IN ('Admin', 'Manager')
                )
            );
        $POLICY$;
    END IF;
END $$;