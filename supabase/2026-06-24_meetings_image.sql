-- Recording Studio: optional image attached to a meeting (whiteboard photo,
-- site photo, sketch, etc.).
alter table public.meetings add column if not exists image_url text;
