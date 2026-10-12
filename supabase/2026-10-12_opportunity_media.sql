-- Photos and videos on a Pre-Con opportunity (site visits, existing
-- conditions), captured from the mobile Camera button or the Pre-Con page.
-- Files live in the cmi-media bucket; this is the record of them.
create table if not exists public.opportunity_media (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.pipeline_opportunities(id) on delete cascade,
  url text not null,
  media_type text not null default 'image' check (media_type in ('image', 'video')),
  name text,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists opportunity_media_opp_idx on public.opportunity_media (opportunity_id, created_at desc);

alter table public.opportunity_media enable row level security;
