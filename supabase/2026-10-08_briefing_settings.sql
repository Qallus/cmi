-- Morning briefing controls, edited from Dashboard → Notifications → Morning
-- Briefing. One row. The 6 AM Scheduled Task reads it on every run, so pausing
-- the briefing or narrowing who gets it is a click, not a redeploy.
-- (BRIEFING_AUDIENCE in the environment still overrides it when set.)
create table if not exists public.briefing_settings (
  id boolean primary key default true check (id),
  -- The 6 AM automatic send. Manual sends work either way.
  auto_enabled boolean not null default true,
  -- 'all' = every active/invited staff member; 'selected' = recipient_ids only.
  audience text not null default 'all' check (audience in ('all', 'selected')),
  recipient_ids uuid[] not null default '{}',
  -- Bolt-written summary at the top; off uses the plain sentence.
  include_ai boolean not null default true,
  updated_by uuid references public.staff_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.briefing_settings (id) values (true) on conflict (id) do nothing;

-- Server-only: read and written through the service role by Super Admin routes.
alter table public.briefing_settings enable row level security;
