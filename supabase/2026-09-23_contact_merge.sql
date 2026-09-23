-- Merge one contact into another.
--
-- 30 columns across 29 tables reference public.contacts, and more arrive with
-- every feature. Rather than hand-listing them (which silently rots), this
-- discovers the references from the FK catalogue at run time and repoints each
-- one. Some carry unique constraints -- job_contacts(job_id, contact_id),
-- job_vendors(job_id, vendor_contact_id), client_notification_prefs(contact_id)
-- -- so a loser row that would collide with one the survivor already has is
-- dropped rather than updated.
--
-- Field-level merge is deliberately NOT done here: the caller patches the
-- survivor afterwards, so a person decides which email and phone win.

create table if not exists public.contact_merges (
  id uuid primary key default gen_random_uuid(),
  survivor_id uuid not null references public.contacts(id) on delete cascade,
  merged_name  text not null,
  merged_email text not null,
  merged_id    uuid not null,
  moved        jsonb not null default '{}'::jsonb,
  merged_by    uuid references public.staff_users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists contact_merges_survivor_idx on public.contact_merges (survivor_id, created_at desc);
alter table public.contact_merges enable row level security;

create or replace function public.merge_contacts(
  p_survivor uuid,
  p_loser    uuid,
  p_actor    uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ref record;
  uq  record;
  moved jsonb := '{}'::jsonb;
  n int;
  loser public.contacts%rowtype;
  others text[];
  predicate text;
begin
  if p_survivor = p_loser then
    raise exception 'A contact cannot be merged into itself.';
  end if;

  select * into loser from public.contacts where id = p_loser;
  if not found then raise exception 'The contact being merged no longer exists.'; end if;
  if not exists (select 1 from public.contacts where id = p_survivor) then
    raise exception 'The contact being kept no longer exists.';
  end if;

  -- Every column in any table that points at contacts.id.
  for ref in
    select c.conrelid::regclass::text as tbl, a.attname as col
    from pg_constraint c
    join unnest(c.conkey) k(attnum) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
    where c.contype = 'f'
      and c.confrelid = 'public.contacts'::regclass
      and c.conrelid <> 'public.contact_merges'::regclass
    order by 1, 2
  loop
    -- Unique constraints that cover this column decide what counts as a clash.
    for uq in
      select u.conname,
             array_remove(array_agg(ua.attname order by ua.attnum), ref.col) as other_cols
      from pg_constraint u
      join unnest(u.conkey) uk(attnum) on true
      join pg_attribute ua on ua.attrelid = u.conrelid and ua.attnum = uk.attnum
      where u.conrelid = ref.tbl::regclass
        and u.contype in ('u', 'p')
      group by u.conname
      having ref.col = any (array_agg(ua.attname))
    loop
      others := uq.other_cols;
      if others is null or cardinality(others) = 0 then
        predicate := 'true';
      else
        select string_agg(format('s.%I is not distinct from t.%I', c, c), ' and ')
        into predicate
        from unnest(others) as c;
      end if;

      execute format(
        'delete from %s t where t.%I = $1 and exists (
           select 1 from %s s where s.%I = $2 and %s
         )', ref.tbl, ref.col, ref.tbl, ref.col, predicate)
        using p_loser, p_survivor;
    end loop;

    execute format('update %s set %I = $1 where %I = $2', ref.tbl, ref.col, ref.col)
      using p_survivor, p_loser;
    get diagnostics n = row_count;

    if n > 0 then
      moved := moved || jsonb_build_object(ref.tbl || '.' || ref.col, n);
    end if;
  end loop;

  insert into public.contact_merges (survivor_id, merged_name, merged_email, merged_id, moved, merged_by)
  values (
    p_survivor,
    trim(coalesce(loser.first_name, '') || ' ' || coalesce(loser.last_name, '')),
    loser.email,
    p_loser,
    moved,
    p_actor
  );

  delete from public.contacts where id = p_loser;

  return jsonb_build_object('ok', true, 'moved', moved);
end;
$$;
