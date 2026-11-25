-- Event invitations (Phase 1). Plan: docs/features/events/EVENT-INVITATIONS-PLAN.md
--
-- Extends the existing Bookings event pages with an "invitation" kind: a
-- themed page (animated hero), personal RSVP links, +1s and a guest list.
-- Existing registration events (e.g. AZ ADU 101) keep kind = 'registration'
-- and behave exactly as before. Everything is behind the event_invitations
-- flag, which starts off.

alter table public.booking_event_pages
  add column if not exists kind text not null default 'registration',
  add column if not exists access text not null default 'invite_only',
  add column if not exists design_mode text not null default 'theme',
  add column if not exists design jsonb not null default '{}'::jsonb,
  add column if not exists custom_html text,
  add column if not exists rsvp_deadline timestamptz,
  add column if not exists allow_plus_one boolean not null default true;

do $$ begin
  alter table public.booking_event_pages
    add constraint booking_event_pages_kind_check check (kind in ('registration', 'invitation'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.booking_event_pages
    add constraint booking_event_pages_access_check check (access in ('invite_only', 'link'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.booking_event_pages
    add constraint booking_event_pages_design_mode_check check (design_mode in ('theme', 'custom'));
exception when duplicate_object then null; end $$;

-- One row per guest. A personal link carries the token; open-link RSVPs get a
-- row (and token) when they first respond, so they can come back and change it.
create table if not exists public.event_rsvps (
  id              uuid primary key default gen_random_uuid(),
  event_page_id   uuid not null references public.booking_event_pages(id) on delete cascade,
  token           text not null,
  staff_user_id   uuid references public.staff_users(id) on delete set null,
  contact_id      uuid references public.contacts(id) on delete set null,
  name            text not null,
  email           text,
  phone           text,
  source          text not null default 'invite' check (source in ('invite', 'link', 'manual')),
  invited_by      uuid references public.staff_users(id) on delete set null,
  sent_at         timestamptz,
  sent_channel    text,
  opened_at       timestamptz,
  status          text not null default 'invited' check (status in ('invited', 'attending', 'declined')),
  plus_one        boolean not null default false,
  plus_one_name   text,
  notes           text,
  responded_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint event_rsvps_token_unique unique (token)
);

create index if not exists event_rsvps_event_idx on public.event_rsvps (event_page_id, status);
create unique index if not exists event_rsvps_event_email_idx
  on public.event_rsvps (event_page_id, lower(email)) where email is not null;
create unique index if not exists event_rsvps_event_staff_idx
  on public.event_rsvps (event_page_id, staff_user_id) where staff_user_id is not null;
create unique index if not exists event_rsvps_event_contact_idx
  on public.event_rsvps (event_page_id, contact_id) where contact_id is not null;

-- Service role only (the app reads and writes through it), like Bookings.
alter table public.event_rsvps enable row level security;

insert into public.feature_flags (key, enabled, description)
values ('event_invitations', false, 'Event invitations: themed invite pages, RSVPs and guest lists (Bookings → Events)')
on conflict (key) do nothing;
