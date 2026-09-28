-- Manual ordering for the Pipeline views.
--
-- Null means "never hand-placed", which sorts after everything that has been,
-- so adding a deal does not silently jump the queue.
alter table public.deals
  add column if not exists sort_order integer;

create index if not exists deals_sort_order_idx
  on public.deals (sort_order) where archived_at is null;
