-- Gantt colours, set per task and per link (double-click a bar on the Gantt).
-- Empty means "use the default": the schedule's colour for bars, and for lines
-- brown dotted (charcoal solid on the critical path).

alter table public.schedule_items
  add column if not exists bar_color text;

alter table public.schedule_dependencies
  add column if not exists line_color text,
  add column if not exists line_style text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'schedule_items_bar_color_hex') then
    alter table public.schedule_items
      add constraint schedule_items_bar_color_hex check (bar_color is null or bar_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_dependencies_line_color_hex') then
    alter table public.schedule_dependencies
      add constraint schedule_dependencies_line_color_hex check (line_color is null or line_color ~ '^#[0-9a-fA-F]{6}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'schedule_dependencies_line_style_check') then
    alter table public.schedule_dependencies
      add constraint schedule_dependencies_line_style_check check (line_style is null or line_style in ('solid', 'dotted', 'dashed'));
  end if;
end $$;
