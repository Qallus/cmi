-- Extend push_subscriptions to also hold client-portal subscriptions. staff_user_id
-- is already nullable; a row is owned by exactly one of staff_user_id / contact_id.
alter table public.push_subscriptions
  add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
create index if not exists push_subscriptions_contact_idx on public.push_subscriptions (contact_id);
