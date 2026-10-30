-- Pipeline numbers from the moment a deal enters the Pipeline.
--
-- CMI runs two sequences:
--   • the pipeline (estimate) number, YY_###, which staff have been typing at
--     the front of each deal title by hand ("26_054_DC Ranch …"), and
--   • the job number, YY_### from job_number_counters, which a job puts in
--     front of its name ("26_013" + "25_062_Olson Casita").
-- Deals only got a number at Closed Won (Pre-Con minted CM-YYYY-####), so
-- 40+ open deals had their number in the title alone.
--
-- Now every deal gets a pipeline number on insert (and when an archived deal
-- comes back): a number typed at the start of the title is kept if no other
-- deal has it; otherwise the next number is issued and put at the front of
-- the title, the way staff write it. Pre-Con keeps the deal's number (the app
-- passes it); a Pre-Con record created on its own gets the next one. Jobs are
-- unchanged: their own YY_### in front of the name, which now always starts
-- with the pipeline number.
--
-- Existing CM-YYYY-#### numbers on Pre-Con records are left alone.
-- Idempotent; safe to re-run.

create table if not exists public.pipeline_number_counters (
  year     integer primary key,
  last_seq integer not null default 0
);
alter table public.pipeline_number_counters enable row level security;

-- The next pipeline number for this year (Phoenix time), e.g. 26_059.
create or replace function public.next_pipeline_number()
returns text
language plpgsql
as $$
declare
  yr  integer := extract(year from (now() at time zone 'America/Phoenix'))::integer;
  seq integer;
begin
  insert into public.pipeline_number_counters (year, last_seq) values (yr, 1)
    on conflict (year) do update set last_seq = public.pipeline_number_counters.last_seq + 1
    returning last_seq into seq;
  return lpad((yr % 100)::text, 2, '0') || '_' || lpad(seq::text, 3, '0');
end;
$$;

-- Record a hand-typed number so the counter never issues it again.
create or replace function public.note_pipeline_number(num text)
returns void
language plpgsql
as $$
begin
  if num ~ '^\d{2}_\d{3}$' then
    insert into public.pipeline_number_counters (year, last_seq)
      values (2000 + left(num, 2)::integer, right(num, 3)::integer)
      on conflict (year) do update
        set last_seq = greatest(public.pipeline_number_counters.last_seq, excluded.last_seq);
  end if;
end;
$$;

create or replace function public.assign_deal_job_number()
returns trigger
language plpgsql
as $$
declare
  typed text;
begin
  if coalesce(new.job_number, '') <> '' or new.archived_at is not null then
    return new;
  end if;
  typed := substring(new.title from '^\s*(\d{2}_\d{3})');
  if typed is not null and not exists (
    select 1 from public.deals d
    where d.id <> new.id
      and (d.job_number = typed or substring(d.title from '^\s*(\d{2}_\d{3})') = typed)
  ) then
    new.job_number := typed;
    perform public.note_pipeline_number(typed);
  else
    -- No number typed, or it belongs to another deal (e.g. a duplicated deal).
    new.job_number := public.next_pipeline_number();
    new.title := new.job_number || '_' ||
      regexp_replace(coalesce(new.title, ''), '^\s*\d{2}_\d{3}[\s_\-–—]*', '');
  end if;
  return new;
end;
$$;

drop trigger if exists trg_deals_job_number on public.deals;
create trigger trg_deals_job_number
  before insert or update of job_number, archived_at on public.deals
  for each row execute function public.assign_deal_job_number();

-- Pre-Con records created on their own (not from a deal) take the next
-- pipeline number too, at the front of their name.
create or replace function public.assign_pipeline_job_number()
returns trigger
language plpgsql
as $$
begin
  if coalesce(new.job_number, '') = '' then
    new.job_number := public.next_pipeline_number();
    if coalesce(new.opportunity_name, '') !~ '^\s*\d{2}_\d{3}' then
      new.opportunity_name := new.job_number || '_' || coalesce(new.opportunity_name, '');
    end if;
  end if;
  return new;
end;
$$;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- 1. Every number already typed in a title (or held by a Pre-Con record) moves
--    the counter past it.
select public.note_pipeline_number(n)
from (
  select substring(title from '^\s*(\d{2}_\d{3})') as n from public.deals
  union
  select job_number from public.pipeline_opportunities
) t
where n is not null;

-- 2. Deals with a number in the title get it, when no other deal claims it.
with typed as (
  select id, substring(title from '^\s*(\d{2}_\d{3})') as n,
         count(*) over (partition by substring(title from '^\s*(\d{2}_\d{3})')) as uses
  from public.deals
  where coalesce(job_number, '') = '' and title ~ '^\s*\d{2}_\d{3}'
)
update public.deals d
set job_number = t.n
from typed t
where d.id = t.id and t.uses = 1
  and not exists (select 1 from public.deals o where o.job_number = t.n);

-- 3. Any open deal still without one gets the next number (the trigger adds
--    it to the front of the title).
update public.deals set job_number = null
where coalesce(job_number, '') = '' and archived_at is null;
