-- Voice notes can go to a Pre-Con project or a daily log, not only a Job.
--
-- opportunity_media now accepts audio alongside photos and video, and daily
-- logs gain an attachments list ([{url, type, name}]) for recordings and other
-- files that aren't photos.
alter table public.opportunity_media drop constraint if exists opportunity_media_media_type_check;
alter table public.opportunity_media
  add constraint opportunity_media_media_type_check check (media_type in ('image', 'video', 'audio'));

alter table public.daily_logs add column if not exists attachments jsonb not null default '[]'::jsonb;
