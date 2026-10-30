-- Additional job titles for staff.
--
-- A staff member has one permission role (role_slug) and one job title, but
-- often does more than one job: Brandon is Principal / President and also
-- runs jobs as a Project Manager. job_roles lists the job-team roles a person
-- can be assigned as ("Project Manager", "Superintendent"), so the job's PM /
-- Superintendent pickers offer them whatever their main title or role is.
-- Idempotent; safe to re-run.

alter table public.staff_users
  add column if not exists job_roles text[] not null default '{}';

-- Seed from what's already there: the PM / Superintendent permission roles and
-- job titles that say so.
update public.staff_users
set job_roles = array(select distinct unnest(job_roles || array['Project Manager']))
where (role_slug = 'project_manager' or coalesce(job_title, title, '') ~* 'project\s*manager')
  and not ('Project Manager' = any(job_roles));

update public.staff_users
set job_roles = array(select distinct unnest(job_roles || array['Superintendent']))
where (role_slug = 'superintendent' or coalesce(job_title, title, '') ~* 'superintendent')
  and not ('Superintendent' = any(job_roles));
