-- Communications: archive messages to keep the list organized.
-- An archived message is hidden from the default (Inbox) view but kept,
-- including for consent/compliance history. Idempotent.

alter table public.messages add column if not exists archived_at timestamptz;
alter table public.messages add column if not exists archived_by uuid references public.staff_users(id) on delete set null;

create index if not exists messages_active_sent_idx on public.messages (sent_at desc) where archived_at is null;
