-- Customizable Dashboard Overview. Plan: docs/features/dashboard/DASHBOARD-OVERVIEW-PLAN.md
--
-- Each person's Overview layout (sections of cards they can move, resize,
-- hide and add), the company default a Super Admin picks for people who
-- haven't set theirs up, and What's New entries. Read and written through the
-- server (service role) only, like schedule_grid_layouts. Behind the
-- dashboard_v2 flag, which starts off.

create table if not exists public.dashboard_layouts (
  staff_user_id uuid primary key references public.staff_users(id) on delete cascade,
  layout        jsonb not null check (pg_column_size(layout) <= 300000),
  updated_at    timestamptz not null default now()
);
alter table public.dashboard_layouts enable row level security;

-- One row (id = true): Standard or Blank, or a saved layout, for new people.
create table if not exists public.dashboard_defaults (
  id          boolean primary key default true check (id),
  preset      text not null default 'standard' check (preset in ('standard', 'blank', 'chooser')),
  layout      jsonb check (layout is null or pg_column_size(layout) <= 300000),
  updated_by  uuid references public.staff_users(id) on delete set null,
  updated_at  timestamptz not null default now()
);
alter table public.dashboard_defaults enable row level security;
insert into public.dashboard_defaults (id, preset) values (true, 'chooser') on conflict (id) do nothing;

create table if not exists public.whats_new (
  id            uuid primary key default gen_random_uuid(),
  title         text not null check (char_length(title) between 1 and 120),
  body          text not null default '' check (char_length(body) <= 600),
  href          text,
  icon          text,
  tag           text,
  published_at  timestamptz,
  created_by    uuid references public.staff_users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists whats_new_published_idx on public.whats_new (published_at desc) where published_at is not null;
alter table public.whats_new enable row level security;

insert into public.feature_flags (key, enabled, description)
values ('dashboard_v2', false, 'Customizable Overview: drag-and-drop cards, Add card, All features, Standard or Blank start')
on conflict (key) do nothing;
