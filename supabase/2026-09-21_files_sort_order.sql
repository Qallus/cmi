-- Cloud: manual ordering. Null = unordered (falls back to name/date sorting);
-- drag-and-drop writes a position per item within its folder.
alter table public.files   add column if not exists sort_order integer;
alter table public.folders add column if not exists sort_order integer;

create index if not exists files_sort_order_idx   on public.files (folder_id, sort_order);
create index if not exists folders_sort_order_idx on public.folders (parent_id, sort_order);
