-- Per-role scheduling (under-promise / over-deliver). Each schedule item keeps
-- its internal start/end (the tighter dates the team & trades work to) plus
-- optional client-facing dates shown in the client portal. When the client dates
-- are null, the client sees the internal dates.
ALTER TABLE public.project_schedule_items
  ADD COLUMN IF NOT EXISTS client_start_date date,
  ADD COLUMN IF NOT EXISTS client_end_date date;
