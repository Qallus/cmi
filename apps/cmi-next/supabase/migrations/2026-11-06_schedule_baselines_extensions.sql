-- Schedules Phase 2 Step 4 (Spec R2 §7.3): multiple baselines and change-order
-- schedule extensions. Behind schedule_progress (no new flag).
--   • Baselines are numbered per schedule (0 = at contract) and Baseline 0 is
--     locked. Captures after the engine migration didn't set a number; backfill.
--   • A change order can carry schedule days (working days). Approving it adds
--     a schedule extension (one per change order) and moves the job's contract
--     milestone dates by that many working days.

alter table public.change_orders
  add column if not exists schedule_days integer;
comment on column public.change_orders.schedule_days is 'Working days this change order adds to the contract dates when approved (negative shortens).';

alter table public.schedule_baselines
  add column if not exists locked boolean not null default false;
update public.schedule_baselines b set number = n.rn - 1
from (select id, row_number() over (partition by schedule_id order by created_at) as rn from public.schedule_baselines) n
where b.id = n.id and b.number is null;
update public.schedule_baselines set locked = true where number = 0 and not locked;
create unique index if not exists schedule_baselines_number_idx on public.schedule_baselines (schedule_id, number);

create table if not exists public.schedule_extensions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  change_order_id uuid references public.change_orders(id) on delete set null,
  days integer not null,
  reason text,
  -- [{ item_id, title, from, to }]: the contract dates this extension moved.
  moved jsonb not null default '[]'::jsonb,
  applied_by uuid,
  created_at timestamptz not null default now(),
  constraint schedule_extensions_one_per_co unique (change_order_id)
);
create index if not exists schedule_extensions_job on public.schedule_extensions (job_id, created_at desc);
alter table public.schedule_extensions enable row level security;   -- service role only, like the other schedule tables
