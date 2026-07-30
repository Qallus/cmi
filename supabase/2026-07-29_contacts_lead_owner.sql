-- Lead/contact owner (staff display name), shown as a column and set on import.
alter table public.contacts add column if not exists lead_owner text;
comment on column public.contacts.lead_owner is 'Staff member who owns this lead/contact (display name).';
create index if not exists contacts_lead_owner_idx on public.contacts (lead_owner);
