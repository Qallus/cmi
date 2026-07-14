-- Powers the staff notification bell for new bookings. Mirrors the pattern used
-- by messages/business_card_leads: an unread booking has notification_read_at
-- NULL; marking the bell item read stamps it. Existing bookings are backfilled
-- as already-seen so the badge only lights for bookings created from now on.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notification_read_at timestamptz;
UPDATE public.bookings SET notification_read_at = now() WHERE notification_read_at IS NULL;
CREATE INDEX IF NOT EXISTS bookings_notification_unread_idx
  ON public.bookings (created_at DESC) WHERE notification_read_at IS NULL;
