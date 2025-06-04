-- Migration to update RLS policies for messaging related tables using active_org_id.
-- Timestamp: 20250601235504 (placeholder)

-- Ensure the helper function internal_get_text_org_id_from_uuid exists.
-- It should be created by a preceding migration (20250601235501_rls_helper_function.sql).

-- ============================
-- Table: chats
-- Column: org_id (UUID)
-- ============================
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat members can access chats in their active org" ON public.chats;
DROP POLICY IF EXISTS "Org members can create chats in their active org" ON public.chats;
DROP POLICY IF EXISTS "Chat creators or Org Admins/Managers can update/delete chats in active org" ON public.chats;
DROP POLICY IF EXISTS "Service role full access on chats" ON public.chats;


CREATE POLICY "Chat members can access chats in their active org"
ON public.chats
FOR SELECT
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(chats.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  EXISTS (
    SELECT 1 FROM public.chat_members cm
    WHERE cm.chat_id = chats.id AND cm.user_id = auth.uid()
  )
);

CREATE POLICY "Org members can create chats in their active org"
ON public.chats
FOR INSERT
TO authenticated
WITH CHECK (
  internal_get_text_org_id_from_uuid(chats.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  created_by_user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Chat creators or Org Admins/Managers can update chats in active org"
ON public.chats
FOR UPDATE
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(chats.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  (
    created_by_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Chat creators or Org Admins/Managers can delete chats in active org"
ON public.chats
FOR DELETE
TO authenticated
USING (
  internal_get_text_org_id_from_uuid(chats.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT AND
  (
    created_by_user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Service role full access on chats"
ON public.chats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: chat_members
-- Links to chats.org_id (UUID)
-- ============================
ALTER TABLE public.chat_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat members can view memberships of chats they are part of in active org" ON public.chat_members;
DROP POLICY IF EXISTS "Chat creators or Org Admins/Managers can manage chat_members in active org" ON public.chat_members;
DROP POLICY IF EXISTS "Service role full access on chat_members" ON public.chat_members;


CREATE POLICY "Chat members can view memberships of chats they are part of in active org"
ON public.chat_members
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_members.chat_id
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS (
        SELECT 1 FROM public.chat_members cm_check
        WHERE cm_check.chat_id = c.id AND cm_check.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Chat creators or Org Admins/Managers can insert chat_members in active org"
ON public.chat_members
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_members.chat_id
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND (
      c.created_by_user_id = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
          AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom.role IN ('admin', 'manager')
      )
    )
  )
);

CREATE POLICY "Chat creators, Org Admins/Managers, or self can delete chat_members in active org"
ON public.chat_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats c
    WHERE c.id = chat_members.chat_id
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND (
      c.created_by_user_id = auth.uid() OR
      chat_members.user_id = auth.uid() OR -- Allow self-removal
      EXISTS (
        SELECT 1 FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
          AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom.role IN ('admin', 'manager')
      )
    )
  )
);


CREATE POLICY "Service role full access on chat_members"
ON public.chat_members
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: messages
-- Links to chats.org_id (UUID)
-- ============================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Chat members can view messages in chats they are part of in active org" ON public.messages;
DROP POLICY IF EXISTS "Chat members can send messages in chats they are part of in active org" ON public.messages;
DROP POLICY IF EXISTS "Message senders or Org Admins/Managers can update/delete messages in active org chats" ON public.messages;
DROP POLICY IF EXISTS "Service role full access on messages" ON public.messages;


CREATE POLICY "Chat members can view messages in chats they are part of in active org"
ON public.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.chat_members cm ON c.id = cm.chat_id
    WHERE c.id = messages.chat_id
    AND cm.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Chat members can send messages in chats they are part of in active org"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.chats c
    JOIN public.chat_members cm ON c.id = cm.chat_id
    WHERE c.id = messages.chat_id
    AND cm.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Message senders or Org Admins/Managers can update messages in active org chats"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  EXISTS ( -- User must be a member of the chat and the chat must be in the active org
    SELECT 1 FROM public.chats c
    JOIN public.chat_members cm ON c.id = cm.chat_id
    WHERE c.id = messages.chat_id
    AND cm.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  ( -- AND user is either the sender OR an admin/manager of the active org
    messages.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Message senders or Org Admins/Managers can delete messages in active org chats"
ON public.messages
FOR DELETE
TO authenticated
USING (
  EXISTS ( -- User must be a member of the chat and the chat must be in the active org
    SELECT 1 FROM public.chats c
    JOIN public.chat_members cm ON c.id = cm.chat_id
    WHERE c.id = messages.chat_id
    AND cm.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  ( -- AND user is either the sender OR an admin/manager of the active org
    messages.user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Service role full access on messages"
ON public.messages
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: message_read_receipts
-- Links to messages -> chats.org_id (UUID)
-- ============================
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own message_read_receipts in active org chats" ON public.message_read_receipts;
DROP POLICY IF EXISTS "Service role full access on message_read_receipts" ON public.message_read_receipts;


CREATE POLICY "Users can manage their own message_read_receipts in active org chats"
ON public.message_read_receipts
FOR ALL
TO authenticated
USING (
  message_read_receipts.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chats c ON m.chat_id = c.id
    WHERE m.id = message_read_receipts.message_id
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS ( -- Ensure the user is a member of the chat this message belongs to
        SELECT 1 FROM public.chat_members cm_check
        WHERE cm_check.chat_id = c.id AND cm_check.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  message_read_receipts.user_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.messages m
    JOIN public.chats c ON m.chat_id = c.id
    WHERE m.id = message_read_receipts.message_id
    AND internal_get_text_org_id_from_uuid(c.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
     AND EXISTS (
        SELECT 1 FROM public.chat_members cm_check
        WHERE cm_check.chat_id = c.id AND cm_check.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Service role full access on message_read_receipts"
ON public.message_read_receipts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


-- ============================
-- Table: group_chats (from encrypted-messaging-migration, links to jobs.org_id)
-- Column: job_id (UUID) -> jobs.org_id (UUID)
-- Note: This table name is distinct from 'chats' table.
-- The Supabase list_tables output showed 'group_chats' with 'group_chat_id' as PK.
-- ============================
ALTER TABLE public.group_chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group participants can view group_chats" ON public.group_chats;
DROP POLICY IF EXISTS "Group participants can manage group_chats" ON public.group_chats;
DROP POLICY IF EXISTS "Users can access group_chats for jobs in their active org if they are a participant" ON public.group_chats;
DROP POLICY IF EXISTS "Org Admins/Managers can create group_chats for jobs in active org" ON public.group_chats;
DROP POLICY IF EXISTS "Org Admins/Managers or creator can update/delete group_chats for jobs in active org" ON public.group_chats;
DROP POLICY IF EXISTS "Service role full access on group_chats" ON public.group_chats;


CREATE POLICY "Users can access group_chats for jobs in their active org if they are a participant"
ON public.group_chats
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = group_chats.job_id -- Assuming group_chats.job_id exists and links to jobs.id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.group_chat_participants gcp
    WHERE gcp.group_chat_id = group_chats.group_chat_id AND gcp.user_id = auth.uid()
  )
);

CREATE POLICY "Org Admins/Managers can create group_chats for jobs in active org"
ON public.group_chats
FOR INSERT
TO authenticated
WITH CHECK (
  group_chats.created_by = auth.uid() AND -- Supabase list_tables showed 'created_by'
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = group_chats.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  EXISTS (
    SELECT 1 FROM public.user_organization_memberships uom
    WHERE uom.user_id = auth.uid()
      AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
      AND uom.role IN ('admin', 'manager')
  )
);

CREATE POLICY "Org Admins/Managers or creator can update group_chats for jobs in active org"
ON public.group_chats
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = group_chats.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  (
    group_chats.created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Org Admins/Managers or creator can delete group_chats for jobs in active org"
ON public.group_chats
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = group_chats.job_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  ) AND
  (
    group_chats.created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.user_organization_memberships uom
      WHERE uom.user_id = auth.uid()
        AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
        AND uom.role IN ('admin', 'manager')
    )
  )
);

CREATE POLICY "Service role full access on group_chats"
ON public.group_chats
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: group_chat_participants
-- Links to group_chats -> jobs.org_id (UUID)
-- ============================
ALTER TABLE public.group_chat_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group participants can view their memberships" ON public.group_chat_participants;
DROP POLICY IF EXISTS "Group participants can manage their memberships" ON public.group_chat_participants;
DROP POLICY IF EXISTS "Participants can view memberships of group_chats in active org" ON public.group_chat_participants;
DROP POLICY IF EXISTS "Org Admins/Managers or group_chat creator can manage group_chat_participants in active org" ON public.group_chat_participants;
DROP POLICY IF EXISTS "Service role full access on group_chat_participants" ON public.group_chat_participants;


CREATE POLICY "Participants can view memberships of group_chats in active org"
ON public.group_chat_participants
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    JOIN public.jobs j ON gc.job_id = j.id -- Assuming gc.job_id
    WHERE gc.group_chat_id = group_chat_participants.group_chat_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND EXISTS ( -- Current user is a participant of this specific group_chat
        SELECT 1 FROM public.group_chat_participants gcp_check
        WHERE gcp_check.group_chat_id = gc.group_chat_id AND gcp_check.user_id = auth.uid()
    )
  )
);

CREATE POLICY "Org Admins/Managers or group_chat creator can insert group_chat_participants in active org"
ON public.group_chat_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    JOIN public.jobs j ON gc.job_id = j.id
    WHERE gc.group_chat_id = group_chat_participants.group_chat_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND (
      gc.created_by = auth.uid() OR
      EXISTS (
        SELECT 1 FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
          AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom.role IN ('admin', 'manager')
      )
    )
  )
);

CREATE POLICY "Org Admins/Managers, creator, or self can delete group_chat_participants in active org"
ON public.group_chat_participants
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    JOIN public.jobs j ON gc.job_id = j.id
    WHERE gc.group_chat_id = group_chat_participants.group_chat_id
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
    AND (
      gc.created_by = auth.uid() OR
      group_chat_participants.user_id = auth.uid() OR -- Self-removal
      EXISTS (
        SELECT 1 FROM public.user_organization_memberships uom
        WHERE uom.user_id = auth.uid()
          AND uom.organization_id = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
          AND uom.role IN ('admin', 'manager')
      )
    )
  )
);

CREATE POLICY "Service role full access on group_chat_participants"
ON public.group_chat_participants
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- ============================
-- Table: group_chat_tickets
-- Links to group_chats -> jobs.org_id (UUID)
-- ============================
ALTER TABLE public.group_chat_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Group participants can view tickets" ON public.group_chat_tickets;
DROP POLICY IF EXISTS "Group participants can insert tickets" ON public.group_chat_tickets;
DROP POLICY IF EXISTS "Group participants can update tickets" ON public.group_chat_tickets;
DROP POLICY IF EXISTS "Group participants can delete tickets" ON public.group_chat_tickets;
DROP POLICY IF EXISTS "Participants can manage group_chat_tickets for group_chats in active org" ON public.group_chat_tickets;
DROP POLICY IF EXISTS "Service role full access on group_chat_tickets" ON public.group_chat_tickets;


CREATE POLICY "Participants can manage group_chat_tickets for group_chats in active org"
ON public.group_chat_tickets
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    JOIN public.jobs j ON gc.job_id = j.id -- Assuming gc.job_id
    JOIN public.group_chat_participants gcp ON gc.group_chat_id = gcp.group_chat_id
    WHERE gc.group_chat_id = group_chat_tickets.group_id -- group_chat_tickets.group_id links to group_chats.group_chat_id
    AND gcp.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.group_chats gc
    JOIN public.jobs j ON gc.job_id = j.id
    JOIN public.group_chat_participants gcp ON gc.group_chat_id = gcp.group_chat_id
    WHERE gc.group_chat_id = group_chat_tickets.group_id
    AND gcp.user_id = auth.uid()
    AND internal_get_text_org_id_from_uuid(j.org_id) = (auth.jwt()->'app_metadata'->>'active_org_id')::TEXT
  )
);

CREATE POLICY "Service role full access on group_chat_tickets"
ON public.group_chat_tickets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);


RAISE NOTICE 'RLS policies for messaging related tables updated for active_org_id.';