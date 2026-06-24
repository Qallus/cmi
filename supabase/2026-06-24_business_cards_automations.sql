-- Automations for business cards: rules that fire on card events (e.g. lead_submit).
-- Stored inline as JSONB on the card.
alter table public.business_cards
  add column if not exists automations jsonb not null default '[]'::jsonb;
