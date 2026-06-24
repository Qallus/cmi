-- Digital Business Cards for CMI staff.
-- Cards are owned by an employee (staff_users). Super Admin / Admin manage all;
-- each employee manages their own. Public cards render at /c/{slug}.

-- ── Cards ─────────────────────────────────────────────────────────────────────
create table if not exists public.business_cards (
  id                    uuid primary key default gen_random_uuid(),
  staff_user_id         uuid references public.staff_users (id) on delete set null,
  slug                  text not null unique,
  card_name             text not null default 'My Business Card',
  status                text not null default 'draft'
                          check (status in ('draft','published','unpublished','archived')),
  is_public             boolean not null default false,

  -- Profile
  display_name          text,
  first_name            text,
  last_name             text,
  job_title             text,
  company_name          text default 'Constructed Matter, Inc.',
  department            text,
  bio                   text,

  -- Images
  profile_photo_url     text,
  logo_url              text,
  background_image_url  text,

  -- Theme / colors
  background_color      text not null default '#0f1c14',
  accent_color          text not null default '#c8a35b',
  text_color            text not null default '#f5f3ee',
  card_mode             text not null default 'standard'
                          check (card_mode in ('standard','opener_slider','qr_only','nfc_landing')),
  theme_mode            text not null default 'dark'
                          check (theme_mode in ('light','dark','both')),
  layout_template       text not null default 'classic',

  -- Contact
  primary_phone         text,
  sms_phone             text,
  primary_email         text,
  website_url           text,
  maps_url              text,
  intro_video_url       text,

  -- JSON config
  qr_settings           jsonb not null default '{"foreground":"#0f1c14","background":"#ffffff","size":512}'::jsonb,
  lead_form_settings    jsonb not null default '{"enabled":true,"title":"Send me your info","description":"Share your details and I will follow up.","button_label":"Send me your info","submit_label":"Send info","fields":[{"key":"name","label":"Name","enabled":true,"required":true},{"key":"email","label":"Email","enabled":true,"required":true},{"key":"phone","label":"Phone","enabled":true,"required":false},{"key":"company","label":"Company","enabled":false,"required":false},{"key":"message","label":"Message","enabled":true,"required":false}]}'::jsonb,
  media_settings        jsonb not null default '{}'::jsonb,
  slider_pages          jsonb not null default '[]'::jsonb,

  -- NFC / physical product
  nfc_status            text not null default 'not_ordered',

  -- Analytics counters (denormalized for quick stats)
  view_count            integer not null default 0,
  click_count           integer not null default 0,

  published_at          timestamptz,
  archived_at           timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists business_cards_staff_idx on public.business_cards (staff_user_id);
create index if not exists business_cards_slug_idx on public.business_cards (slug);
create index if not exists business_cards_status_idx on public.business_cards (status);

-- ── Links / buttons ───────────────────────────────────────────────────────────
create table if not exists public.business_card_links (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references public.business_cards (id) on delete cascade,
  label             text not null,
  url               text not null default '',
  link_type         text not null default 'custom',
  icon              text,
  display_order     integer not null default 100,
  is_visible        boolean not null default true,
  open_in_new_tab   boolean not null default true,
  click_count       integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists business_card_links_card_idx on public.business_card_links (card_id, display_order);

-- ── Sections / layers (ordering + visibility + spacing) ───────────────────────
create table if not exists public.business_card_sections (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references public.business_cards (id) on delete cascade,
  section_type      text not null,
  label             text not null,
  content           jsonb not null default '{}'::jsonb,
  display_order     integer not null default 100,
  is_visible        boolean not null default true,
  margin_top        integer not null default 0,
  margin_bottom     integer not null default 16,
  padding_top       integer not null default 0,
  padding_bottom    integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists business_card_sections_card_idx on public.business_card_sections (card_id, display_order);

-- ── Analytics events ──────────────────────────────────────────────────────────
create table if not exists public.business_card_events (
  id            uuid primary key default gen_random_uuid(),
  card_id       uuid not null references public.business_cards (id) on delete cascade,
  link_id       uuid references public.business_card_links (id) on delete set null,
  event_type    text not null
                  check (event_type in ('view','share','like','qr_scan','nfc_tap','link_click','copy_link','save_contact','lead_submit')),
  source        text default 'public_card',
  device_type   text,
  referrer      text,
  user_agent    text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists business_card_events_card_type_idx on public.business_card_events (card_id, event_type, created_at desc);

-- ── Leads ("Send me your info") ───────────────────────────────────────────────
create table if not exists public.business_card_leads (
  id                uuid primary key default gen_random_uuid(),
  card_id           uuid not null references public.business_cards (id) on delete cascade,
  owner_staff_id    uuid references public.staff_users (id) on delete set null,
  name              text,
  email             text,
  phone             text,
  company           text,
  message           text,
  preferred_contact text,
  source            text default 'public_card',
  status            text not null default 'new'
                      check (status in ('new','contacted','qualified','archived')),
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists business_card_leads_card_idx on public.business_card_leads (card_id, created_at desc);
create index if not exists business_card_leads_owner_idx on public.business_card_leads (owner_staff_id, status);

-- RLS on (all access is via service-role API routes, which bypass RLS).
alter table public.business_cards enable row level security;
alter table public.business_card_links enable row level security;
alter table public.business_card_sections enable row level security;
alter table public.business_card_events enable row level security;
alter table public.business_card_leads enable row level security;
