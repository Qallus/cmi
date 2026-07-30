-- Flexible enrichment store for contacts/leads (e.g. the ~70-column ZoomInfo
-- lead export). Extra fields that don't warrant dedicated columns live here and
-- render in the expanded contact profile as key/value "Imported Details".
alter table public.contacts add column if not exists metadata jsonb not null default '{}'::jsonb;
comment on column public.contacts.metadata is 'Extra imported/enrichment fields shown in the expanded profile (key/value).';
