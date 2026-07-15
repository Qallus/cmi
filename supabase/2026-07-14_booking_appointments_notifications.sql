-- Corrects 2026-07-14_bookings_notification_read_at.sql: the staff notification
-- bell must track the table the dashboard actually uses. loadBookingData reads
-- and createBookingAppointment writes `booking_appointments`; the earlier flag
-- was added to the legacy Fluent-sync `bookings` table, so new dashboard/public
-- bookings never lit the badge. This moves notification_read_at to the right
-- table and removes the misplaced column.
ALTER TABLE public.booking_appointments ADD COLUMN IF NOT EXISTS notification_read_at timestamptz;

-- Backfill existing appointments as already-seen, but leave the single most
-- recent one unread so the bell immediately reflects the latest booking and,
-- going forward, only newly created bookings light the badge.
UPDATE public.booking_appointments SET notification_read_at = now()
WHERE notification_read_at IS NULL
  AND id <> (SELECT id FROM public.booking_appointments ORDER BY created_at DESC LIMIT 1);

CREATE INDEX IF NOT EXISTS booking_appointments_notification_unread_idx
  ON public.booking_appointments (created_at DESC) WHERE notification_read_at IS NULL;

-- Remove the column mistakenly added to the wrong table; nothing reads it.
DROP INDEX IF EXISTS public.bookings_notification_unread_idx;
ALTER TABLE public.bookings DROP COLUMN IF EXISTS notification_read_at;
