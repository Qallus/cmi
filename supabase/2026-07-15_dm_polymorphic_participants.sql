-- Make DM participants/senders polymorphic (staff OR client) so client↔PM
-- conversations share the same system. Additive: existing rows default to
-- 'staff'; FKs on the party columns are dropped so they can hold contact ids too.
-- The party id stays unique across staff_users/contacts (uuid), so the unread
-- RPCs (keyed on user_id) keep working unchanged.
ALTER TABLE public.dm_participants ADD COLUMN IF NOT EXISTS user_kind text NOT NULL DEFAULT 'staff' CHECK (user_kind IN ('staff','client'));
ALTER TABLE public.dm_messages     ADD COLUMN IF NOT EXISTS sender_kind text NOT NULL DEFAULT 'staff' CHECK (sender_kind IN ('staff','client'));
ALTER TABLE public.dm_conversations ADD COLUMN IF NOT EXISTS last_sender_kind text;

ALTER TABLE public.dm_participants  DROP CONSTRAINT IF EXISTS dm_participants_user_id_fkey;
ALTER TABLE public.dm_messages      DROP CONSTRAINT IF EXISTS dm_messages_sender_id_fkey;
ALTER TABLE public.dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_created_by_fkey;
ALTER TABLE public.dm_conversations DROP CONSTRAINT IF EXISTS dm_conversations_last_sender_id_fkey;
