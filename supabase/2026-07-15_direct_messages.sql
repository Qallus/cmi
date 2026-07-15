-- Direct Messages: internal 1:1 (group-ready) messaging between staff, with
-- per-user read state for unread badges. Adapted from the MJG DM model to CMI's
-- staff_users + service-role auth (RLS on, no policies — the app authorizes).
-- conversations carry an optional job_id so the job Messages tab can scope later.

CREATE TABLE IF NOT EXISTS public.dm_conversations (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id               uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  created_by           uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  subject              text,
  last_message_at      timestamptz,
  last_message_preview text,
  last_sender_id       uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  status               text NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.dm_participants (
  conversation_id  uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES public.staff_users(id) ON DELETE CASCADE,
  last_read_at     timestamptz,
  last_notified_at timestamptz,
  muted            boolean NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.dm_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.dm_conversations(id) ON DELETE CASCADE,
  sender_id       uuid REFERENCES public.staff_users(id) ON DELETE SET NULL,
  body            text NOT NULL DEFAULT '',
  importance      text NOT NULL DEFAULT 'normal' CHECK (importance IN ('normal','important','urgent')),
  attachments     jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  edited_at       timestamptz,
  deleted_at      timestamptz
);

CREATE INDEX IF NOT EXISTS dm_participants_user_idx ON public.dm_participants (user_id);
CREATE INDEX IF NOT EXISTS dm_conversations_last_message_idx ON public.dm_conversations (last_message_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS dm_conversations_job_idx ON public.dm_conversations (job_id);
CREATE INDEX IF NOT EXISTS dm_messages_conversation_idx ON public.dm_messages (conversation_id, created_at ASC);

CREATE OR REPLACE FUNCTION public.dm_unread_count(p_user uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int
  FROM public.dm_messages m
  JOIN public.dm_participants dp ON dp.conversation_id = m.conversation_id AND dp.user_id = p_user
  WHERE m.sender_id IS DISTINCT FROM p_user
    AND m.deleted_at IS NULL
    AND (dp.last_read_at IS NULL OR m.created_at > dp.last_read_at);
$$;

CREATE OR REPLACE FUNCTION public.dm_conversation_unread(p_user uuid)
RETURNS TABLE (conversation_id uuid, unread integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.conversation_id, count(*)::int AS unread
  FROM public.dm_messages m
  JOIN public.dm_participants dp ON dp.conversation_id = m.conversation_id AND dp.user_id = p_user
  WHERE m.sender_id IS DISTINCT FROM p_user
    AND m.deleted_at IS NULL
    AND (dp.last_read_at IS NULL OR m.created_at > dp.last_read_at)
  GROUP BY m.conversation_id;
$$;

ALTER TABLE public.dm_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_participants  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages      ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.dm_conversations, public.dm_participants, public.dm_messages FROM anon, authenticated;
