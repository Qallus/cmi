-- Activity timeline entries can be edited after posting; track when so the
-- feed can show "(edited)" rather than silently changing history.
alter table public.activities add column if not exists edited_at timestamptz;
alter table public.activities add column if not exists edited_by uuid references public.staff_users(id) on delete set null;
