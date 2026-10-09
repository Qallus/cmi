-- Several contacts per deal, each with their role on it.
--
-- A deal could link exactly one contact (deals.contact_id). Real deals have a
-- homeowner, a designer or architect, sometimes a referring contractor, and
-- the people are often only partly known: a designer bringing CMI a deal may
-- hold back their client's phone and email until contracts are signed. So:
--
-- * deal_contacts links any number of Contacts to a deal, with a role and one
--   primary. deals.contact_id stays and always mirrors the primary, so every
--   existing feature (calls, texts, booking, Closed Won → Pre-Con) keeps working.
-- * contacts.email becomes optional. The unique index on lower(email) still
--   stops duplicates when an email is given; Postgres treats NULLs as distinct.

create table if not exists public.deal_contacts (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  -- Relationship to the deal: Homeowner, Designer, Architect, General
  -- Contractor, Referral Partner, Property Manager, Realtor, Other.
  role text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (deal_id, contact_id)
);

create index if not exists deal_contacts_deal_idx on public.deal_contacts (deal_id, sort_order);
create index if not exists deal_contacts_contact_idx on public.deal_contacts (contact_id);
-- At most one primary per deal.
create unique index if not exists deal_contacts_one_primary
  on public.deal_contacts (deal_id) where is_primary;

alter table public.deal_contacts enable row level security;

-- Every deal that already has a contact keeps it, as the primary.
insert into public.deal_contacts (deal_id, contact_id, is_primary, sort_order)
select id, contact_id, true, 0 from public.deals where contact_id is not null
on conflict (deal_id, contact_id) do nothing;

alter table public.contacts alter column email drop not null;
