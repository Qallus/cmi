-- Document-level settings for an email: width, colours, type, page padding.
--
-- Empty means "the defaults the renderer has always used", so every existing
-- template renders byte-identically until someone changes something.
alter table public.email_templates
  add column if not exists settings jsonb not null default '{}'::jsonb;
