-- Projections company settings (key/value). Admin-only, service-role access.
--   default_actuals_source: "cmi_invoices" | "external" — used for new projections
--   workload_threshold:     number — highlight months with ≥ N concurrent projects
create table if not exists public.projection_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.staff_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.projection_settings enable row level security;

insert into public.projection_settings (key, value) values
  ('default_actuals_source', '"cmi_invoices"'::jsonb),
  ('workload_threshold', '3'::jsonb)
  on conflict (key) do nothing;
