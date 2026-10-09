-- Sidebar items a Super Admin has hidden for everyone (Settings → Sidebar
-- navigation). One row. Hiding only removes the link from the sidebar: the
-- page itself is still governed by its own role and flag checks.
create table if not exists public.nav_settings (
  id boolean primary key default true check (id),
  hidden_hrefs text[] not null default '{}',
  updated_by uuid references public.staff_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.nav_settings (id) values (true) on conflict (id) do nothing;

alter table public.nav_settings enable row level security;
