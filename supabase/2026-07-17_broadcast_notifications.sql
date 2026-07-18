-- Super-Admin broadcast notifications: a message targeted at all users, all
-- staff, all clients, or a specific staff role. Delivered to the in-app bell
-- (staff + client) and web push. Additive; RLS-locked (route-guarded access).

create table if not exists public.broadcast_notifications (
  id                  uuid primary key default gen_random_uuid(),
  title               text not null,
  body                text not null,
  link                text,
  audience            text not null default 'all',   -- all | staff | clients | role
  target_role         text,                          -- staff role_slug when audience = 'role'
  created_by_staff_id uuid references public.staff_users(id) on delete set null,
  created_by_name     text,
  created_at          timestamptz not null default now()
);
alter table public.broadcast_notifications enable row level security;
create index if not exists broadcast_notifications_created_idx on public.broadcast_notifications (created_at desc);

-- A row here means "this user has read this broadcast" (existence = read).
create table if not exists public.broadcast_reads (
  broadcast_id uuid not null references public.broadcast_notifications(id) on delete cascade,
  user_kind    text not null,                        -- staff | client
  user_id      uuid not null,
  read_at      timestamptz not null default now(),
  primary key (broadcast_id, user_kind, user_id)
);
alter table public.broadcast_reads enable row level security;

-- Per-user opt-out for broadcasts (staff + clients). Absent row = enabled.
create table if not exists public.notification_prefs (
  user_kind          text not null,                  -- staff | client
  user_id            uuid not null,
  broadcasts_enabled boolean not null default true,
  updated_at         timestamptz not null default now(),
  primary key (user_kind, user_id)
);
alter table public.notification_prefs enable row level security;
