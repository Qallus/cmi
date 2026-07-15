-- Stores Web Push subscriptions for staff PWA notifications. One row per browser/
-- device endpoint. Server (service-role) only; RLS on with no policies.
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_user_id uuid REFERENCES public.staff_users(id) ON DELETE CASCADE,
  endpoint      text NOT NULL UNIQUE,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz
);
CREATE INDEX IF NOT EXISTS push_subscriptions_staff_idx ON public.push_subscriptions (staff_user_id);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
