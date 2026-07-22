-- Messaging consent / A2P 10DLC + CAN-SPAM compliance
-- ----------------------------------------------------
-- Additive only. Extends the existing messaging_suppressions and
-- messaging_consent_events tables so the public opt-in / opt-out pages can
-- record an auditable consent record and so marketing can be suppressed
-- independently of transactional (service/project) messaging.
--
-- Safe to re-run.

-- 1. Suppressions ------------------------------------------------------------
-- `opted_out` keeps its existing meaning: opted out of EVERYTHING on this
-- channel. `marketing_opted_out` is the narrower "stop marketing only" state,
-- which is what the SMS/email opt-out pages offer as a separate choice.
alter table public.messaging_suppressions
  add column if not exists marketing_opted_out    boolean not null default false,
  add column if not exists opted_out_at           timestamptz,
  add column if not exists marketing_opted_out_at timestamptz,
  add column if not exists opt_out_method         text;

comment on column public.messaging_suppressions.opted_out is
  'Opted out of ALL messages on this channel (STOP / "stop everything").';
comment on column public.messaging_suppressions.marketing_opted_out is
  'Opted out of marketing/promotional messages only. Transactional messages still allowed.';
comment on column public.messaging_suppressions.opt_out_method is
  'How the opt-out arrived: sms_keyword, public_page, staff, webhook, etc.';

-- 2. Consent events ----------------------------------------------------------
-- One immutable row per consent action. These columns are the evidence a
-- carrier or regulator asks for: what was agreed to, the exact disclosure
-- shown, when, from where, and by whom.
alter table public.messaging_consent_events
  add column if not exists categories         text[] not null default '{}',
  add column if not exists disclosure_version text,
  add column if not exists disclosure_text    text,
  add column if not exists source_url         text,
  add column if not exists ip                 text,
  add column if not exists user_agent         text,
  add column if not exists first_name         text,
  add column if not exists last_name          text,
  add column if not exists email              text,
  add column if not exists phone              text,
  add column if not exists company            text,
  add column if not exists relationship       text,
  add column if not exists contact_id         uuid references public.contacts(id) on delete set null;

comment on column public.messaging_consent_events.categories is
  'Which message categories this action covered: service and/or marketing.';
comment on column public.messaging_consent_events.disclosure_text is
  'Verbatim disclosure text displayed to the user at the moment of consent.';
comment on column public.messaging_consent_events.disclosure_version is
  'Version stamp of the consent copy, so the exact wording can be reproduced.';

create index if not exists messaging_consent_events_address_idx
  on public.messaging_consent_events (channel, address, created_at desc);
create index if not exists messaging_consent_events_contact_idx
  on public.messaging_consent_events (contact_id);

-- 3. RLS ---------------------------------------------------------------------
-- Both tables are written only through the service role (server-side API
-- routes). Enable RLS with no public policy so the anon/authenticated keys
-- cannot read or write consent records directly.
alter table public.messaging_suppressions    enable row level security;
alter table public.messaging_consent_events  enable row level security;
