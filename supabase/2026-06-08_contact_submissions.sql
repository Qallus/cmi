-- Contact form submissions from the public website
create table if not exists contact_submissions (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  email        text not null,
  phone        text,
  how_heard    text,
  subject      text not null,
  message      text not null,
  status       text not null default 'new' check (status in ('new', 'read', 'archived')),
  contact_id   uuid references contacts(id) on delete set null,
  submitted_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists contact_submissions_status_idx on contact_submissions(status);
create index if not exists contact_submissions_submitted_at_idx on contact_submissions(submitted_at desc);
create index if not exists contact_submissions_contact_id_idx on contact_submissions(contact_id);

-- RLS: staff only
alter table contact_submissions enable row level security;

create policy "staff_read_contact_submissions"
  on contact_submissions for select
  using (
    exists (
      select 1 from staff_users su
      where su.user_id = auth.uid()
        and su.is_active = true
    )
  );

create policy "service_role_all_contact_submissions"
  on contact_submissions for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
