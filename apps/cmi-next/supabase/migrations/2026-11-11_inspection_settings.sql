-- Inspection settings people edit (Brandon, Nov 11, 2026). Run after
-- 2026-11-11_inspection_milestones.sql and its seed.
--   • The jurisdiction list is edited in Settings → Scheduling → Inspections
--     (and by Claude through the CMI MCP): add jurisdictions, set each one's
--     next-day cutoff once confirmed, retire one with `active` (jobs keep it).
--   • Who may update an inspection's status: Super Admin and Admin always, plus
--     the roles a Super Admin picks here; Project Managers and Superintendents
--     by default.

alter table public.inspection_jurisdictions
  add column if not exists active boolean not null default true,
  add column if not exists updated_by uuid;
comment on column public.inspection_jurisdictions.active is 'Offered on jobs when true. Retiring one keeps it on the jobs that already use it.';

create table if not exists public.inspection_settings (
  id smallint primary key default 1 check (id = 1),   -- one row
  status_editor_roles text[] not null default '{project_manager,superintendent}',
  updated_by uuid,
  updated_at timestamptz not null default now()
);
comment on table public.inspection_settings is 'Company-wide inspection settings (one row).';
comment on column public.inspection_settings.status_editor_roles is 'Staff roles that may update inspection status, besides super_admin and admin (always).';
alter table public.inspection_settings enable row level security;   -- service role only

insert into public.inspection_settings (id) values (1) on conflict (id) do nothing;
