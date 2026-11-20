-- Leads leave the Leads list once they're on a project.
--
-- The Contacts → Leads tab (and Bolt) list contacts whose type is 'Lead'.
-- Nothing used to change that type when the person joined a deal, a Pre-Con
-- record or a job, so people already under contract still showed as leads.
-- Contacts are linked from many places (deal/Pre-Con/job data layers, CSV
-- import, MCP tools, Bolt), so the rule lives here in the database:
--
--   on a Pipeline deal or in Pre-Con  → Prospect
--   on a job                          → Client
--   Designer / Architect role         → Designer
--
-- Promotion only moves forward: Lead → Prospect / Designer / Client, and
-- Prospect → Designer / Client. It never demotes (moving a project back a phase
-- leaves the type alone) and never touches Vendor, Sub Contractor, Other, etc.
-- Lost / on-hold deals count too: the person is tied to a deal, not a lead.

create or replace function public.promote_lead_contact(p_contact uuid, p_target text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_contact is null or p_target not in ('Prospect', 'Designer', 'Client') then
    return;
  end if;
  update public.contacts
     set type = p_target, updated_at = now()
   where id = p_contact
     and (
       type = 'Lead'
       or (type = 'Prospect' and p_target in ('Designer', 'Client'))
     );
end;
$$;

comment on function public.promote_lead_contact(uuid, text) is
  'Move a contact forward from Lead/Prospect when it joins a deal, Pre-Con or job. Never demotes.';

-- Role on a deal or job → target type.
create or replace function public.lead_target_for_role(p_role text, p_default text)
returns text
language sql
immutable
as $$
  select case when lower(coalesce(p_role, '')) in ('designer', 'architect') then 'Designer' else p_default end;
$$;

-- deals.contact_id and pipeline_opportunities.contact_id → Prospect
create or replace function public.trg_promote_contact_prospect()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is not null and (tg_op = 'INSERT' or new.contact_id is distinct from old.contact_id) then
    perform public.promote_lead_contact(new.contact_id, 'Prospect');
  end if;
  return new;
end;
$$;

-- deal_contacts rows → Prospect (or Designer by role)
create or replace function public.trg_promote_deal_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.promote_lead_contact(new.contact_id, public.lead_target_for_role(new.role, 'Prospect'));
  return new;
end;
$$;

-- job_contacts rows → Client (or Designer by role)
create or replace function public.trg_promote_job_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.promote_lead_contact(new.contact_id, public.lead_target_for_role(new.role, 'Client'));
  return new;
end;
$$;

-- jobs.related_lead_id → Client (may hold a non-contact id; then nothing matches)
create or replace function public.trg_promote_job_related_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.related_lead_id is not null and (tg_op = 'INSERT' or new.related_lead_id is distinct from old.related_lead_id) then
    perform public.promote_lead_contact(new.related_lead_id, 'Client');
  end if;
  return new;
end;
$$;

create or replace trigger trg_deals_promote_contact
  after insert or update of contact_id on public.deals
  for each row execute function public.trg_promote_contact_prospect();

create or replace trigger trg_pipeline_opps_promote_contact
  after insert or update of contact_id on public.pipeline_opportunities
  for each row execute function public.trg_promote_contact_prospect();

create or replace trigger trg_deal_contacts_promote
  after insert or update of contact_id, role on public.deal_contacts
  for each row execute function public.trg_promote_deal_contact();

create or replace trigger trg_job_contacts_promote
  after insert or update of contact_id, role on public.job_contacts
  for each row execute function public.trg_promote_job_contact();

create or replace trigger trg_jobs_promote_related_lead
  after insert or update of related_lead_id on public.jobs
  for each row execute function public.trg_promote_job_related_lead();

-- ─── One-time backfill (idempotent) ─────────────────────────────
-- Strongest first: jobs → Client, then Designer roles, then Prospect.
-- Archived records are skipped: an archived deal alone doesn't make someone
-- a prospect.

select public.promote_lead_contact(jc.contact_id, public.lead_target_for_role(jc.role, 'Client'))
  from public.job_contacts jc join public.jobs j on j.id = jc.job_id
 where j.archived_at is null;

select public.promote_lead_contact(j.related_lead_id, 'Client')
  from public.jobs j where j.related_lead_id is not null and j.archived_at is null;

select public.promote_lead_contact(dc.contact_id, public.lead_target_for_role(dc.role, 'Prospect'))
  from public.deal_contacts dc join public.deals d on d.id = dc.deal_id
 where d.archived_at is null
 order by (lower(coalesce(dc.role, '')) in ('designer', 'architect')) desc;

select public.promote_lead_contact(d.contact_id, 'Prospect')
  from public.deals d where d.contact_id is not null and d.archived_at is null;

select public.promote_lead_contact(p.contact_id, 'Prospect')
  from public.pipeline_opportunities p where p.contact_id is not null and p.archived_at is null;
