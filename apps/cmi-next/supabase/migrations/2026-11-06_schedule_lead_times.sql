-- Schedules Phase 2 Step 8: order-by dates. A task's lead time (working days
-- to get the material); the order-by date is worked out from it in the app
-- (earliest successor start − lead). Behind schedule_progress.
alter table public.schedule_items
  add column if not exists lead_time_days integer;
alter table public.schedule_items drop constraint if exists schedule_items_lead_time_days_check;
alter table public.schedule_items add constraint schedule_items_lead_time_days_check check (lead_time_days is null or lead_time_days between 0 and 400);
comment on column public.schedule_items.lead_time_days is 'Working days of lead time (order to delivery). Order-by = earliest successor start − this.';
