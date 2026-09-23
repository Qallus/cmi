-- Duplicate-contact prevention.
--
-- The email column was already unique, but on the RAW value, so "Jane@x.com"
-- and "jane@x.com" were two different contacts. That also made
-- findOrCreateContact's .ilike(...).maybeSingle() a latent 500 once both
-- existed. Safe to apply: no case-variant collisions exist, and only one
-- address was not already lowercase.
update public.contacts set email = lower(email) where email <> lower(email);
create unique index if not exists contacts_email_lower_key on public.contacts (lower(email));

-- The duplicates that actually occur are the same person with a second email
-- (work vs personal), which only a name or phone match catches. pg_trgm covers
-- typos like "Jeremey" for "Jeremy".
create extension if not exists pg_trgm;

create index if not exists contacts_name_trgm_idx
  on public.contacts using gin ((lower(first_name || ' ' || last_name)) gin_trgm_ops);

create index if not exists contacts_phone_digits_idx
  on public.contacts ((right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)));

/**
 * Ranked possible duplicates for a contact being typed in.
 * Score: 100 same email, 90 same phone, 85 name + company, 75 name,
 * below that a trigram similarity on the full name.
 *
 * The fuzzy tier is a hint only. Trigram can't separate a typo ("Christof" for
 * "Christoph", 0.74) from a different person ("Danielle" vs "Daniel Nunez",
 * 0.75), so the app never blocks on it.
 */
create or replace function public.find_duplicate_contacts(
  p_first   text default null,
  p_last    text default null,
  p_email   text default null,
  p_phone   text default null,
  p_company text default null,
  p_exclude uuid default null,
  p_limit   int  default 5
)
returns table (
  id uuid, first_name text, last_name text, email text, phone text,
  company text, type text, created_at timestamptz, score int, reason text
)
language sql
stable
set search_path = public
as $$
  with input as (
    select
      nullif(lower(trim(coalesce(p_first, '') || ' ' || coalesce(p_last, ''))), '') as name_in,
      nullif(lower(trim(coalesce(p_email, ''))), '')                                as email_in,
      right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10)               as phone_in,
      nullif(lower(trim(coalesce(p_company, ''))), '')                              as company_in
  ),
  candidate as (
    select
      c.*,
      lower(trim(c.first_name || ' ' || c.last_name))                 as c_name,
      right(regexp_replace(coalesce(c.phone, ''), '\D', '', 'g'), 10) as c_phone,
      lower(trim(coalesce(c.company, '')))                            as c_company
    from public.contacts c
    where p_exclude is null or c.id <> p_exclude
  ),
  scored as (
    select
      c.id, c.first_name, c.last_name, c.email, c.phone, c.company, c.type, c.created_at,
      case
        when i.email_in is not null and lower(c.email) = i.email_in then 100
        when length(i.phone_in) = 10 and c.c_phone = i.phone_in then 90
        when i.name_in is not null and c.c_name = i.name_in
             and i.company_in is not null and c.c_company = i.company_in then 85
        when i.name_in is not null and c.c_name = i.name_in then 75
        when i.name_in is not null and length(i.name_in) >= 4
             then (similarity(c.c_name, i.name_in) * 70)::int
        else 0
      end as score,
      case
        when i.email_in is not null and lower(c.email) = i.email_in then 'same email'
        when length(i.phone_in) = 10 and c.c_phone = i.phone_in then 'same phone'
        when i.name_in is not null and c.c_name = i.name_in
             and i.company_in is not null and c.c_company = i.company_in then 'same name and company'
        when i.name_in is not null and c.c_name = i.name_in then 'same name'
        else 'similar name'
      end as reason
    from candidate c cross join input i
  )
  select id, first_name, last_name, email, phone, company, type, created_at, score, reason
  from scored
  where score >= 35
  order by score desc, created_at asc
  limit greatest(p_limit, 1);
$$;
