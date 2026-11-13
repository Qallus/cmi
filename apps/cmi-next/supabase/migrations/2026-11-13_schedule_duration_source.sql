-- Where a task's duration came from (Grid Behavior Addendum §3.2, the "Source" column):
--   template  a schedule template, package or the inspection library set it
--   history   suggested from past jobs (reserved for when that suggestion exists)
--   ai        Claude / Bolt set it
--   user      someone typed it (grid, task drawer, Excel import)
-- Null for tasks made before this column existed (unknown).
-- Run this BEFORE the app update that writes it is deployed.

alter table public.schedule_items
  add column if not exists duration_source text;

alter table public.schedule_items
  drop constraint if exists schedule_items_duration_source_check;
alter table public.schedule_items
  add constraint schedule_items_duration_source_check
  check (duration_source is null or duration_source in ('template', 'history', 'ai', 'user'));

comment on column public.schedule_items.duration_source is 'Where the duration came from: template | history | ai | user (null = before this was tracked).';
