-- Schedules Phase 2, step 1: progress tracking (status date, % complete stamps
-- actual dates, remaining duration, forecast finish, variance to baseline).
-- The columns already exist (2026-11-04_schedule_engine.sql); this only adds the
-- feature flag, off until it is switched on in Settings -> Features.
insert into public.feature_flags (key, enabled, description)
values ('schedule_progress', false, 'Schedules: progress tracking - status date, actual dates from % complete, remaining work and forecast vs baseline (Spec R2 Phase 2)')
on conflict (key) do nothing;
