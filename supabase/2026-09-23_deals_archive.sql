-- Archive for Pipeline deals: leaves the active board and reporting but keeps
-- the record, its activities, tasks and history so it can be restored.
-- Permanent deletion stays a separate, Super-Admin-only action.
alter table public.deals add column if not exists archived_at timestamptz;
alter table public.deals add column if not exists archived_by uuid references public.staff_users(id) on delete set null;

create index if not exists deals_archived_idx on public.deals (archived_at) where archived_at is null;
