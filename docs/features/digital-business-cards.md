# Digital Business Cards — Feature & Replication Guide

Employee-owned digital business cards with a visual builder, a public QR/NFC
profile page at `/c/{slug}`, lead capture, automations, and analytics. Built on
**Next.js (App Router) + Supabase**.

---

## 1. Feature Overview

- **Card builder** with a live mobile/tablet/desktop preview and a left-rail of
  panels: Sections, Content, Links, Color modes, Splash, QR, Forms, NFC,
  Slideshow, Media, Steps, Automations, Settings, Setup wizard.
- **Public card** at `/c/{slug}`: profile header, quick actions (Call/SMS/Email),
  links, "Send me your info" lead form, QR code, optional splash/opener,
  slideshow, steps, and a floating Copy / Share / Save-contact (vCard) / Like bar.
- **Splash / opener** with 3 modes — **Standard** (logo + text + buttons),
  **Video** (YouTube/Vimeo/direct file with start/end trim + mute), **Slideshow**
  (multi-image) — plus auto-dismiss timer and a transition effect
  (none/fade/slide/zoom).
- **Lead capture** ("Send me your info") with configurable fields → stored as
  leads + a **Leads inbox** (status workflow, contact links) + a numeric badge.
- **Convert a lead** into a Contact (type), Staff User (role), Quote, Project, or
  Document (contract/SOW) in one click.
- **Automations** on lead submit: email the owner, SMS the owner, and/or
  auto-reply to the lead (Resend + Twilio).
- **Per-card analytics**: views, clicks, shares, saves, leads, likes, QR scans,
  NFC taps, a 14-day activity chart, and top-links breakdown.
- **Access model**: cards are **employee-owned**. Every staff member manages
  their own card; Super Admin/Admin get a "manage all" view (edit, publish,
  archive, delete, reassign).
- Notifications: new leads increment the dashboard bell + the Leads tab badge.

---

## 2. Data Model (Supabase)

RLS enabled; all access via service-role API routes.

### `business_cards`
Owner = `staff_user_id` (→ staff_users). Key fields:
`slug (unique), card_name, status (draft|published|unpublished|archived),
is_public, display_name/first_name/last_name/job_title/company_name/department/
bio, profile_photo_url/logo_url/background_image_url, background_color/
accent_color/text_color, card_mode, theme_mode (light|dark|both),
layout_template, primary_phone/sms_phone/primary_email/website_url/maps_url/
intro_video_url, qr_settings jsonb, lead_form_settings jsonb, media_settings
jsonb, slider_pages jsonb, automations jsonb, nfc_status, view_count,
click_count, published_at, archived_at, created_at, updated_at`.

### `business_card_links`
`card_id, label, url, link_type (website|social|phone|email|sms|map|booking|
payment|download|video|review|custom), icon, display_order, is_visible,
open_in_new_tab, click_count`.

### `business_card_sections`
Ordering/visibility/spacing per section. `card_id, section_type (opener|
profile_header|quick_actions|links|lead_capture|video|qr_code|nfc|slideshow|
steps), label, content jsonb, display_order, is_visible, margin_top/bottom,
padding_top/bottom`. The `content` jsonb holds per-section config (opener mode +
fields, slideshow slides, steps items, etc.).

### `business_card_events` (analytics)
`card_id, link_id, event_type (view|share|like|qr_scan|nfc_tap|link_click|
copy_link|save_contact|lead_submit), source, device_type, referrer, user_agent,
metadata, created_at`.

### `business_card_leads`
`card_id, owner_staff_id, name, email, phone, company, message,
preferred_contact, source, status (new|contacted|qualified|archived), payload`.

> Schema migrations: `business_cards.sql` (cards + links + sections + events +
> leads), `business_cards_automations.sql` (automations column),
> `expand_contact_document_types.sql` (lets lead→contact/document conversion use
> the new types).

---

## 3. API Routes

### Authenticated (`requireAdmin` cookie/session; role-gated)
| Route | Methods | Purpose |
|---|---|---|
| `/api/business-cards` | GET, POST | List (own, or `?scope=all` for admins) + stats + staff options; create/update card with links + sections. |
| `/api/business-cards/[id]` | PATCH, DELETE | Status (publish/unpublish/archive), reassign (admin), delete. |
| `/api/business-cards/detail` | GET | Full card (links + sections) for editing, ownership-checked. |
| `/api/business-cards/[id]/analytics` | GET | `?range=7\|30\|90` → tiles, daily chart, top links. |
| `/api/business-cards/leads` | GET | Leads list (own, or `?scope=all`). |
| `/api/business-cards/leads/[id]` | PATCH, DELETE | Lead status / delete. |
| `/api/business-cards/leads/[id]/convert` | POST | Convert lead → contact/user/quote/project/document. |

### Public (no auth)
| Route | Methods | Purpose |
|---|---|---|
| `/api/cards/events` | POST | Record analytics events (view/share/etc.). |
| `/api/cards/leads` | POST | Lead submission → also fires automations. |
| `/api/cards/qr` | GET | PNG QR for a URL (via `qrcode` npm) — recolorable. |
| `/api/cards/vcf` | GET | vCard 3.0 download for a published card. |

---

## 4. Data Layer (`lib/business-cards/`)
- **types.ts** — all card/link/section/lead/automation/slideshow/media types.
- **data.ts** (server) — `loadCardsForViewer`, `loadCardForEdit`,
  `loadPublicCardBySlug`, `saveCard`, `setCardStatus`, `reassignCard`,
  `deleteCard`, `computeStats` (incl. `newLeads`), `recordEvent`, `createLead`,
  `loadLeads`, `updateLeadStatus`, `deleteLead`, `loadStaffOptions`, slug helper.
- **defaults.ts** (client-safe) — `makeNewCard`, `makeDefaultSections`,
  `DEFAULT_LEAD_FORM`, color presets.
- **notify.ts** (server) — `runLeadAutomations` (Resend email / Twilio SMS).

---

## 5. UI
- **Dashboard** `app/dashboard/business-cards/`: `business-cards-client.tsx`
  (Cards/Leads tabs, stat tiles, filters, role-based manage-all),
  `card-builder.tsx` (the builder + live preview), `card-analytics.tsx`,
  `leads-inbox.tsx` (+ convert modal).
- **Shared visual** `components/business-card/card-preview.tsx` — renders the
  card body; used by both the builder preview and the public page.
- **Public** `app/c/[slug]/page.tsx` + `public-card.tsx` — interactive card with
  splash modes, theme toggle, lead modal, action bar, analytics tracking.

---

## 6. Integrations & env
- **QR**: `qrcode` npm (self-hosted PNG endpoint).
- **vCard**: generated server-side (no dep).
- **Automations**: Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`) for email,
  Twilio (`TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER`) for SMS.
- **Image uploads**: reuse a generic uploads route (Supabase Storage bucket).
- **Public URL** from `NEXT_PUBLIC_APP_URL` (QR target, vCard URL).
- Public routes `/c/*` and `/api/cards/*` must be **excluded from auth
  middleware** (only `/dashboard/*` is gated).

---

## 7. Replication checklist
1. Apply the business-cards migrations (cards + 4 child tables, automations
   column). Owner FK → your staff/users table.
2. Port `lib/business-cards/{types,data,defaults,notify}.ts`.
3. Add the authenticated + public API routes above.
4. Build `card-preview.tsx` (shared), the builder, leads inbox + convert,
   analytics, and the public `/c/[slug]` page.
5. Wire `qrcode`, Resend, Twilio; set `NEXT_PUBLIC_APP_URL`.
6. Add the nav item (gate to internal staff roles) and exclude `/c/*` +
   `/api/cards/*` from auth middleware.
