-- Recording Studio: support multiple audio recordings per meeting.
-- Each entry: { id, path, filename, mime, created_at, transcript? }
alter table public.meetings add column if not exists recordings jsonb not null default '[]'::jsonb;
