-- A2P 10DLC / CAN-SPAM messaging consent.
-- Address-based suppression is the source of truth for opt-outs: a row with
-- opted_out=true means that phone/email must not be messaged on that channel.
-- "Opted-in" = no opt-out on file (matches the current all-opted-in state).
create table if not exists public.messaging_suppressions (
  channel     text not null check (channel in ('sms','email')),
  address     text not null,
  opted_out   boolean not null default true,
  source      text,
  updated_at  timestamptz not null default now(),
  primary key (channel, address)
);

-- Audit trail of every consent change (proof of consent for Twilio).
create table if not exists public.messaging_consent_events (
  id              uuid primary key default gen_random_uuid(),
  channel         text not null check (channel in ('sms','email')),
  action          text not null check (action in ('opt_in','opt_out')),
  address         text not null,
  record_type     text,
  record_id       text,
  source          text,
  actor_staff_id  uuid references public.staff_users (id) on delete set null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);
create index if not exists messaging_consent_events_addr_idx on public.messaging_consent_events (channel, address, created_at desc);

alter table public.messaging_suppressions enable row level security;
alter table public.messaging_consent_events enable row level security;
