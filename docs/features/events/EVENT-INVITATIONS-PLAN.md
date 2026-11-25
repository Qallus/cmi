# Event Invitations: build event invites in the dashboard or in Claude, host or send them, collect RSVPs

## Status (2026-11-25)
- **Migration** `2026-11-25_event_invitations.sql` applied. Flag `event_invitations` is **off**; turn it on in Settings → Features.
- **Phase 1** shipped: themes, public page, RSVP API, Events builder, guest list, responses.
- **Phase 2** shipped: Draft with Bolt (typed or dictated), Claude connector tools (`cmi_event*`), Bolt tools.
- **Phase 3** shipped: invitation email (Hero block + theme GIF) and SMS, send with review step, "Send me a test", .ics calendar link, Hero block in the email builder, `scripts/render-theme-gifs.mjs`.
  - Not built: automatic reminders (needs a `reminded_at` column). "Everyone still waiting" works as a manual reminder.
- **Phase 4** shipped: Custom HTML design in a sandboxed frame, HTML export whose RSVPs post back to CMI.

## Context
Brandon used Claude to make an invitation page for the 2026 Christmas dinner:
- an animated dark hero with snowflakes and drifting dots
- a personal message and an RSVP card (attending yes/no, +1, +1 name, dietary notes; editable later)
- a "Good to know" list and a "Who's coming" list with a live count

Jeremy wants this built into CMI. Staff should be able to make invitations like this from a typed or spoken description, or entirely through Claude via the CMI connector. They then host the page on CMI, send it by email or SMS, or download it to host elsewhere. Animated heroes should also be usable in emails.

**What already exists (from the codebase review):**
- Bookings has **event pages** already:
  - tables `booking_event_pages` and `booking_event_registrations` (root `supabase/2026-05-28_booking_events_calendar_sync.sql`)
  - a public `/events/[slug]` page (`app/events/[slug]/page.tsx` and `event-registration-client.tsx`)
  - `lib/booking/data.ts`: `loadPublicEventPage`, `registerForEventPage`, `createBookingEventPage`, calendar sync
  - one live event, "AZ ADU 101", with 2 registrations. This is a public sign-up, not an invitation.
- Missing today: per-guest invitations, an RSVP with yes/no, a +1 and later edits, themes or animation, AI drafting, connector tools, and sending.

**Decisions (from Jeremy):**
- **Design:** branded animated themes are the default; a "Custom design" mode also accepts HTML that Claude wrote.
- **Guests:** staff, contacts/clients, and anyone with the link are all supported.
- **Where it goes:** hosted on CMI, sent by email/SMS from CMI, and downloadable as HTML to host anywhere.
- **Email animation:** an animated GIF hero with a still fallback, plus a reusable **Hero** block in the email builder.

## Approach: extend Bookings events, don't build a second system
Add an **"Invitation"** kind to the event pages that already exist. The current registration events (AZ ADU 101) keep working unchanged. Everything ships behind the feature flag **`event_invitations`**, which stays off until approved. The spec goes in `docs/features/events/EVENT-INVITATIONS-PLAN.md` before any code.

### Phase 1: data, themes, public page, RSVP, builder (manual)

**Migration** `apps/cmi-next/supabase/migrations/2026-11-25_event_invitations.sql` (applied only after approval):
- Add these columns to `booking_event_pages`:

  | Column | Meaning |
  | --- | --- |
  | `kind` | `registration` (default, today's behaviour) or `invitation` |
  | `access` | `invite_only` or `link`, meaning anyone with the link can RSVP |
  | `design_mode` | `theme` or `custom` |
  | `design` | jsonb: theme id, palette and accent word, eyebrow, the welcome message and sign-off, "Good to know" rows, the +1 policy, a dietary-notes toggle, and the guest list display (`full`, `first`, `count` or `off`) |
  | `custom_html` | the Claude-written design, used in Phase 4 |
  | `rsvp_deadline` | when RSVPs close |
  | `allow_plus_one` | whether guests may bring a +1 |

- New table **`event_rsvps`**, one row per guest:
  - Columns: `event_page_id`; `token` (32 hex characters from `randomBytes`, the same pattern as prequal); `staff_user_id` / `contact_id` / name / email / phone; `source` (`invite` or `link`); `invited_by`; `sent_at`, `sent_channel` and `opened_at`; `status` (`invited`, `attending` or `declined`); `plus_one`, `plus_one_name` and `notes`; `responded_at`.
  - Constraints: unique on (`event_page_id`, `token`). RLS is on and access goes through the service role only, like the rest of Bookings.
- Seed the flag: `insert into feature_flags … on conflict do nothing`.

**Themes:** `lib/events/themes.ts` plus `components/events/hero/*`.
- Presets: **Snowfall** (Christmas, matching Brandon's), **Confetti**, **Sparkle/Fireworks** (New Year), **Blueprint** (a drifting CMI grid), **Golden bokeh** and **None**.
- Each preset defines its palette, a canvas/CSS hero animation, and email assets (`public/events/themes/<id>.gif` and `.png`).
- Animations honour `prefers-reduced-motion`.

**Public page:**
- `/events/[slug]` branches on `kind`. An invitation renders a new `components/events/invitation-page.tsx`: hero, message card, RSVP card, Good to know, Who's coming, footer. It is laid out like Brandon's page.
- Personal links use `/events/[slug]?i=<token>`. The guest's RSVP is pre-filled and the button changes to "Update RSVP".
- RSVPs through the open link are matched by email. A cookie remembers the token so the guest can come back and change their answer.

**RSVP API:** `app/api/events/[slug]/rsvp/route.ts`
- `GET` returns the guest's own RSVP by token.
- `POST` creates or updates an RSVP.
- Guards:
  - the flag is checked; an unknown or closed event returns 404
  - for link access, the existing `botReason` honeypot and `verifyTurnstile` from `lib/spam/turnstile.ts`
  - length caps
  - a small per-IP limiter
  - CORS is open on this one route only, so an exported page can post RSVPs back
- Staff get a bell notification through `notifyStaff` (in-app only, no email).

**Builder:**
- Nav: a new child **Bookings → Events** at `/dashboard/events`, behind the flag, for `BOOKING_ROLES` (super_admin, admin, project_manager, estimator). The nav item is defined in `components/dashboard/nav.tsx`.
- An event list, then an editor with a live preview that switches between desktop and phone.
- Editor tabs:
  - **Design:** theme, colours, text
  - **Details:** when and where with a map link, RSVP deadline, +1 setting
  - **Guests:**
    - add all staff, a single staff member or contacts (the contacts picker), or turn on the open link
    - manually record an RSVP for someone, like "texted Brandon"
  - **Responses:** attending, declined and waiting counts; headcount including +1s; a dietary list for the restaurant; CSV export
- Data lives in `lib/events/data.ts` and the routes in `app/api/events/*`. Event CRUD goes through the existing `lib/booking/data.ts` helpers where they fit.
- Image upload reuses `uploadToMedia` from `lib/storage.ts`.
- First real use: rebuild the Christmas 2026 invite here and check it against Brandon's screenshots.

### Phase 2: AI drafting (typed or spoken) and the Claude connector

**"Describe your event" box** at the top of the builder:
- Typed text, or the mic: `components/audio/audio-recorder.tsx`, then `/api/transcribe`.
- The text goes to `/api/events/draft`. That route uses `callHermes` and `extractJson` from `lib/canvas/bolt.ts` and returns **structured design JSON**: title, date and time, venue, message, Good to know rows, a suggested theme, and +1 and dietary defaults. The draft is validated against the schema, then fills the form for staff to edit.

**Connector tools** in a new `lib/mcp/tools-events.ts`, registered in `MCP_TOOLS` in `lib/mcp/tools.ts` and gated by booking roles:

| Tool | Risk | What it does |
| --- | --- | --- |
| `cmi_events_list`, `cmi_event_get` | read | Get returns the design, links and counts |
| `cmi_event_themes` | read | Lists the available themes |
| `cmi_event_create`, `cmi_event_update` | write | Creates or updates the structured fields, theme and `custom_html`; always saved as a draft |
| `cmi_event_guests_add` | write | Adds staff ids, contact ids or emails, or "all staff" |
| `cmi_event_rsvps` | read | Responses, headcount, +1s and dietary notes |
| `cmi_event_rsvp_set` | write | Records an RSVP for someone |
| `cmi_event_publish` | high | Makes the page live; preview, then `cmi_confirm` |
| `cmi_event_export_html` | read | Returns the single-file HTML (Phase 4) |

`cmi_event_send_invites` (high, open world, counts toward the email/SMS cap) arrives in Phase 3. All tools go through the existing audit log and risk tiers (`lib/mcp/server.ts`, `cmi_confirm`).

**Bolt:**
- Tools mirrored in `lib/agent/tools.ts`: list, get, RSVPs, create draft, record RSVP.
- Sends use the existing `send` confirm card.
- Add an Events entry and glossary terms to `lib/agent/dashboard-guide.ts`. CLAUDE.md requires this.

### Phase 3: sending, an animated email hero, reminders
- **Email builder Hero block:** add `hero` to `BlockType` in `components/email-builder/types.ts`, `renderer.ts` and `visual-editor.tsx`.
  - It has a background image or GIF with a solid-colour fallback (`bgcolor`), plus eyebrow, title with an accent word, and a facts list.
  - It is table-based, works in Outlook, and is usable in any template or Print.
- **Theme GIFs:** `scripts/render-theme-gifs.mjs` records each hero animation with Playwright and encodes a looping GIF of about 1 MB or less, plus a still PNG. Run once; the output is committed under `public/events/themes/`.
- **Invitation email:** Hero block, the message, and an **RSVP** button with the guest's personal link. SMS sends a short text with the link.
- **Sending** goes through `lib/messaging/send.ts`, so the outbound hold (`canSendOutbound` / `NOTIFY_FORCE_SEND`) applies.
  - Contacts are checked with `isMarketingSuppressed`; staff are exempt.
  - Each send is recorded with `logMessage`, and `sent_at` is stamped on the RSVP row.
  - The send preview shows the recipient count and anyone skipped, with the reason.
- **Calendar file:** an `.ics` attachment or "Add to calendar" link after a guest says yes. This reuses the event times.
- **Reminders (optional):** before the RSVP deadline, a reminder to guests still marked `invited`, via the existing `/api/automations/run`. It is off by default.
- **Connector tool:** `cmi_event_send_invites` (high: preview, then confirm).

### Phase 4: Custom HTML mode and HTML export
- **Custom design:** stores Claude-written HTML (`custom_html`, 500 KB max). It renders in a sandboxed iframe (`sandbox="allow-scripts"`, no same-origin access, so it can't touch CMI cookies or the dashboard). CMI's own RSVP card, Good to know and Who's coming render beneath it. Only booking roles can set it, from the builder or `cmi_event_update`.
- **Export:** `GET /api/events/[id]/export` returns one self-contained HTML file, with the theme CSS, JS and copy inlined. Its RSVP form posts to the CMI RSVP API (CORS is open on that route), so RSVPs still land in CMI wherever the file is hosted. Guests are matched by email.

## Files (representative)
- **New:**
  - the migration above
  - `lib/events/{themes,data,types,draft,export}.ts`
  - `components/events/*` (hero animations, invitation page, builder)
  - `app/dashboard/events/*`
  - `app/api/events/**`
  - `lib/mcp/tools-events.ts`
  - `scripts/render-theme-gifs.mjs`
  - `docs/features/events/EVENT-INVITATIONS-PLAN.md`
- **Edit:**
  - `app/events/[slug]/page.tsx` (branch on kind)
  - `components/dashboard/nav.tsx`
  - `lib/mcp/tools.ts` (register)
  - `lib/agent/tools.ts`
  - `lib/agent/dashboard-guide.ts`
  - `components/email-builder/{types,renderer,visual-editor}.ts(x)`

## Verification
- **After each phase:** `npm run typecheck`, `npm run lint` (on app, lib and components) and `npm run test` in `apps/cmi-next`. Add `node:test` tests for:
  - token and RSVP validation
  - theme lookup
  - the export builder
  - the email Hero renderer output
- **Migration:** apply only after approval, then run read-only checks: the new columns exist, and AZ ADU 101 still loads as `registration`.
- **Phase 1:** rebuild the Christmas invite with the flag on.
  - Open `/events/christmas-2026` on desktop and phone.
  - RSVP yes with a +1 and confirm Who's coming updates.
  - Change the RSVP using the same link.
  - Confirm the open link requires the honeypot and Turnstile.
- **Phase 2:**
  - Dictate a description and confirm the form fills in.
  - In Claude, run "create an invite for…", then `cmi_event_rsvps`.
  - Confirm `cmi_event_publish` asks for confirmation.
- **Phase 3:** outside production, sends are **held**. Confirm they're logged as held and nothing goes out. Render the Hero block in the email preview and check the GIF fallback.
- **Phase 4:**
  - The custom HTML iframe can't read `document.cookie` from the parent.
  - The exported file, opened from disk, posts an RSVP that shows up in Responses.
- **Commit and push:** only when asked, staging only changed files by explicit path.
