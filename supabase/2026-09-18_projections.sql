-- Projections (12-month revenue / workload forecast)
-- ------------------------------------------------------------------
-- A planning layer over jobs / invoices / pipeline. These tables hold only
-- forecast overrides and history; source jobs, invoices and opportunities are
-- never written by Projections. Rule for every override column: null = use the
-- source value.
--
-- Admin / Super Admin only. All access is through server routes using the
-- service-role key, so RLS is enabled with no public policy (matches the rest
-- of the app). Spec: docs/features/projections/.

-- ─── projections — one row per forecasted project ─────────────────────────
create table if not exists public.projections (
  id               uuid primary key default gen_random_uuid(),
  -- Source links (all nullable: anticipated work has no job yet).
  job_id           uuid unique references public.jobs(id) on delete set null,
  opportunity_id   uuid references public.pipeline_opportunities(id) on delete set null,
  deal_id          uuid references public.deals(id) on delete set null,
  contact_id       uuid references public.contacts(id) on delete set null,
  -- Manual (anticipated) record fields; ignored when a job is linked.
  name             text,
  client_name      text,
  -- Overrides (null = derive from source).
  revenue_override numeric(14,2),
  status           text check (status in ('contracted','preconstruction','likely','proposal','on_hold')),
  forecast_start   date,
  forecast_finish  date,
  pm_staff_id      uuid references public.staff_users(id) on delete set null,
  super_staff_id   uuid references public.staff_users(id) on delete set null,
  -- Planning state.
  include          boolean not null default true,
  -- Where actual billing comes from; one source per project so nothing is
  -- counted twice. external = projection_actuals (manual / CSV / QB / Adaptive).
  actuals_source   text not null default 'cmi_invoices' check (actuals_source in ('cmi_invoices','external')),
  -- Actuals up to this month have been reviewed against the forecast
  -- (drives the "new actuals — review forecast" prompt).
  actuals_reviewed_through date,
  notes            text,
  archived_at      timestamptz,
  created_by       uuid references public.staff_users(id) on delete set null,
  updated_by       uuid references public.staff_users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists projections_opportunity_idx on public.projections (opportunity_id);
create index if not exists projections_deal_idx        on public.projections (deal_id);
create index if not exists projections_archived_idx    on public.projections (archived_at);

alter table public.projections enable row level security;

-- ─── projection_months — forecast amount per project per month ────────────
create table if not exists public.projection_months (
  id               uuid primary key default gen_random_uuid(),
  projection_id    uuid not null references public.projections(id) on delete cascade,
  month            date not null check (extract(day from month) = 1),
  projected_amount numeric(14,2) not null default 0,
  -- First forecast for this month; written once, never overwritten, so
  -- original vs current vs actual can always be compared.
  original_amount  numeric(14,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (projection_id, month)
);

alter table public.projection_months enable row level security;

-- ─── projection_actuals — billing recorded outside CMI ────────────────────
-- CMI invoice actuals are NOT stored here; they're read live from invoices.
create table if not exists public.projection_actuals (
  id            uuid primary key default gen_random_uuid(),
  projection_id uuid not null references public.projections(id) on delete cascade,
  month         date not null check (extract(day from month) = 1),
  amount        numeric(14,2) not null,
  source        text not null check (source in ('manual','csv_import','quickbooks','adaptive')),
  external_ref  text,           -- de-dupes re-imports
  note          text,
  created_by    uuid references public.staff_users(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index if not exists projection_actuals_projection_idx on public.projection_actuals (projection_id, month);
create unique index if not exists projection_actuals_external_ref_idx
  on public.projection_actuals (projection_id, source, external_ref)
  where external_ref is not null;

alter table public.projection_actuals enable row level security;

-- ─── projection_activity — audit log ─────────────────────────────────────
create table if not exists public.projection_activity (
  id            uuid primary key default gen_random_uuid(),
  projection_id uuid references public.projections(id) on delete set null,
  action        text not null,
  detail        jsonb not null default '{}'::jsonb,   -- before/after
  actor_id      uuid references public.staff_users(id) on delete set null,
  actor_name    text,
  created_at    timestamptz not null default now()
);

create index if not exists projection_activity_projection_idx on public.projection_activity (projection_id, created_at desc);

alter table public.projection_activity enable row level security;

-- ─── Feature flag (staged rollout; off until enabled in Settings → Features)
insert into public.feature_flags (key, enabled, description)
  values ('projections', false, 'Projections — 12-month revenue / workload forecast (Admin + Super Admin)')
  on conflict (key) do nothing;

-- ─── RBAC catalog (kept consistent; gating uses lib/projections/access.ts) ─
insert into public.permissions (key, label, description, category) values
  ('projections.view',   'View Projections',   'View the 12-month revenue and workload forecast.',     'projections'),
  ('projections.edit',   'Edit Projections',   'Add projects and edit forecast months, dates and status.', 'projections'),
  ('projections.import', 'Import Actuals',     'Enter or import external (Adaptive / QuickBooks) billing.', 'projections')
  on conflict (key) do nothing;
