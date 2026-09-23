-- Reporting — weekly workload meeting reports across Jobs, Pre-Con, Pipeline
-- and Projections, plus the field-level change log that "what changed since
-- last meeting" is built on.
--
-- Two independent pieces:
--   1. record_changes + a generic trigger, so history starts accumulating now.
--   2. meeting_reports / report_sections / report_items / report_action_items,
--      the editable weekly meeting document.

-- ─── 1. Field-level change log ─────────────────────────────────────────────
create table if not exists public.record_changes (
  id uuid primary key default gen_random_uuid(),
  table_name   text not null,
  record_id    uuid not null,
  record_label text,                       -- job number / title as of the change
  op           text not null check (op in ('insert', 'update', 'delete')),
  field        text,                       -- null for insert / delete
  old_value    text,
  new_value    text,
  changed_by   uuid references public.staff_users(id) on delete set null,
  changed_at   timestamptz not null default now()
);

create index if not exists record_changes_at_idx on public.record_changes (changed_at desc);
create index if not exists record_changes_record_idx on public.record_changes (table_name, record_id, changed_at desc);
create index if not exists record_changes_field_idx on public.record_changes (table_name, field, changed_at desc);

alter table public.record_changes enable row level security;

-- Generic row auditor. Compares the old and new rows as jsonb and writes one
-- row per changed field, so it works unchanged on every table it's attached to.
--
-- Attribution is best effort: the app writes `updated_by` where the column
-- exists, and anything else (SQL console, an import, n8n) lands with a null
-- actor rather than being dropped.
create or replace function public.log_record_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  o jsonb := case when tg_op = 'INSERT' then '{}'::jsonb else to_jsonb(old) end;
  n jsonb := case when tg_op = 'DELETE' then '{}'::jsonb else to_jsonb(new) end;
  src jsonb := case when tg_op = 'DELETE' then o else n end;
  k text;
  label text;
  actor uuid;
  actor_text text;
  -- Housekeeping columns: noise in a "what changed" report.
  ignored text[] := array['updated_at', 'created_at', 'last_activity_at', 'updated_by', 'search_tsv'];
begin
  label := coalesce(
    src->>'job_number', src->>'job_name', src->>'title',
    src->>'opportunity_name', src->>'name'
  );

  actor_text := coalesce(src->>'updated_by', nullif(current_setting('app.actor_id', true), ''));
  if actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    actor := actor_text::uuid;
  end if;

  if tg_op = 'INSERT' then
    insert into public.record_changes (table_name, record_id, record_label, op, changed_by)
    values (tg_table_name, (n->>'id')::uuid, label, 'insert', actor);
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into public.record_changes (table_name, record_id, record_label, op, changed_by)
    values (tg_table_name, (o->>'id')::uuid, label, 'delete', actor);
    return old;
  end if;

  for k in select jsonb_object_keys(n) loop
    continue when k = any(ignored);
    if (o->k) is distinct from (n->k) then
      insert into public.record_changes (table_name, record_id, record_label, op, field, old_value, new_value, changed_by)
      values (
        tg_table_name, (n->>'id')::uuid, label, 'update', k,
        left(o->>k, 2000), left(n->>k, 2000), actor
      );
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists log_changes on public.deals;
create trigger log_changes after insert or update or delete on public.deals
  for each row execute function public.log_record_changes();

drop trigger if exists log_changes on public.jobs;
create trigger log_changes after insert or update or delete on public.jobs
  for each row execute function public.log_record_changes();

drop trigger if exists log_changes on public.pipeline_opportunities;
create trigger log_changes after insert or update or delete on public.pipeline_opportunities
  for each row execute function public.log_record_changes();

drop trigger if exists log_changes on public.projections;
create trigger log_changes after insert or update or delete on public.projections
  for each row execute function public.log_record_changes();

drop trigger if exists log_changes on public.deal_tasks;
create trigger log_changes after insert or update or delete on public.deal_tasks
  for each row execute function public.log_record_changes();

-- The app can attribute a change without an updated_by column on every table.
alter table public.deals add column if not exists updated_by uuid references public.staff_users(id) on delete set null;
alter table public.jobs  add column if not exists updated_by uuid references public.staff_users(id) on delete set null;

-- ─── 2. Weekly meeting reports ─────────────────────────────────────────────
create table if not exists public.meeting_reports (
  id uuid primary key default gen_random_uuid(),
  title        text not null,
  meeting_date date not null,
  status       text not null default 'draft' check (status in ('draft', 'final')),
  -- "Changes since" anchor: defaults to the previous report's meeting date.
  compare_since date,
  previous_report_id uuid references public.meeting_reports(id) on delete set null,
  notes        text,
  finalized_at timestamptz,
  created_by   uuid references public.staff_users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists meeting_reports_date_idx on public.meeting_reports (meeting_date desc);
alter table public.meeting_reports enable row level security;

-- Sections are rows, not a hard-coded list, so a meeting can add or drop one
-- (the seeded set mirrors the current Word document).
create table if not exists public.report_sections (
  id uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.meeting_reports(id) on delete cascade,
  key        text not null,
  title      text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (report_id, key)
);

create index if not exists report_sections_report_idx on public.report_sections (report_id, sort_order);
alter table public.report_sections enable row level security;

-- One line item: usually a linked job / lead / opportunity, sometimes a
-- free-text entry (Builder's Risk, networking events, office items).
create table if not exists public.report_items (
  id uuid primary key default gen_random_uuid(),
  report_id  uuid not null references public.meeting_reports(id) on delete cascade,
  section_id uuid not null references public.report_sections(id) on delete cascade,
  sort_order int not null default 0,
  record_type text check (record_type in ('job', 'deal', 'opportunity', 'projection')),
  record_id   uuid,
  job_number  text,
  title       text not null,
  status_text text,
  scope       text,
  design_partner text,
  value_note  text,
  original_completion date,
  current_completion  date,
  warranty_date date,
  financial_note text,
  latest_update  text,
  procurement_note text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists report_items_section_idx on public.report_items (section_id, sort_order);
create index if not exists report_items_record_idx on public.report_items (record_type, record_id);
alter table public.report_items enable row level security;

-- Action items are structured so they can be reported by person, due date and
-- overdue state — the outline's "Brandon's open items" requirement.
create table if not exists public.report_action_items (
  id uuid primary key default gen_random_uuid(),
  report_item_id uuid not null references public.report_items(id) on delete cascade,
  body           text not null,
  owner_staff_id uuid references public.staff_users(id) on delete set null,
  owner_label    text,                     -- raw "BF" / "YH" until it's mapped
  due_date       date,
  completed_at   timestamptz,
  -- Set when an open item is carried forward into the next week's report.
  carried_from_id uuid references public.report_action_items(id) on delete set null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists report_action_items_item_idx on public.report_action_items (report_item_id, sort_order);
create index if not exists report_action_items_owner_idx on public.report_action_items (owner_staff_id, completed_at, due_date);
alter table public.report_action_items enable row level security;

-- ─── Feature flag (off until enabled in Settings → Features) ───────────────
insert into public.feature_flags (key, enabled, description)
  values ('reporting', false, 'Reporting — weekly workload meeting reports across Jobs, Pre-Con, Pipeline and Projections')
  on conflict (key) do nothing;

-- ─── RBAC catalog (gating uses lib/reporting/access.ts) ────────────────────
insert into public.permissions (key, label, description, category) values
  ('reporting.view',   'View Reports',    'Open weekly workload meeting reports.',                 'reporting'),
  ('reporting.edit',   'Edit Reports',    'Create reports and edit items and action items.',       'reporting'),
  ('reporting.import', 'Import Reports',  'Import a past meeting document into a report.',         'reporting')
  on conflict (key) do nothing;
