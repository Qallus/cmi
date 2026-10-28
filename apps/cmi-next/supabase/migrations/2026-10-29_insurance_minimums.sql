-- Insurance minimums editable in the dashboard (Trade Partners → Setup →
-- Insurance minimums): a default set plus overrides per partner type and per
-- trade. Stored in a small key/value settings table that other dashboard
-- settings can reuse. Idempotent; server-only (RLS on, no policies).
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references public.staff_users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;

-- Starting point (Jeremy, 2026-10-29): $2,000,000 general liability required;
-- auto, workers' comp and umbrella off until set.
insert into public.app_settings (key, value) values ('insurance_minimums', '{
  "default": {
    "gl": {"required": true, "perOccurrence": 2000000, "aggregate": 2000000},
    "auto": {"required": false},
    "wc": {"required": false},
    "umbrella": {"required": false}
  },
  "byPartnerType": {},
  "byTrade": {}
}'::jsonb)
on conflict (key) do nothing;
