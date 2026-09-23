-- Archiving an application takes it out of the working queue without losing
-- what the applicant sent. Deleting is separate, and permanent.
alter table public.prequal_applications
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.staff_users(id) on delete set null;

create index if not exists prequal_applications_archived_idx
  on public.prequal_applications (archived_at)
  where archived_at is not null;
