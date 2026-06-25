# Shared Foundations — Scaffolding the Features Assume

Common building blocks every CMI dashboard feature (Project Management, Digital
Business Cards, Recording Studio, Booking) depends on. Port these first so the
per-feature guides are drop-in. Stack: **Next.js App Router + React + TypeScript
(strict) + Tailwind + Supabase**.

---

## 1. Supabase server client

`lib/supabase/server.ts`
```ts
import { createClient } from "@supabase/supabase-js";
export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server credentials are not configured.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
```
- **Service-role** client used in all API routes and `lib/*/data.ts` — it
  **bypasses RLS**, so RLS can stay enabled-with-no-policies (locked to everyone
  except the service role). All reads/writes go through server routes.
- Server-only (never import into a client component).

---

## 2. Auth + roles

`lib/auth/require-admin.ts` — the gate used by every authenticated route.
```ts
export class AuthError extends Error { status: number; /* ... */ }

export async function requireAdmin(request: Request) {
  // 1. read the `cmi-session` cookie (a Supabase access token)
  // 2. supabase.auth.getUser(token)  → throws AuthError(401) if invalid
  // 3. look up staff_users by email, status in ('active','invited')
  //    → throws AuthError(403) if not a staff member
  return { user, staff }; // staff: { id, role_slug, status, ... }
}
```
Usage in a route:
```ts
let staff;
try { ({ staff } = await requireAdmin(request)); }
catch (err) { const e = err as AuthError; return NextResponse.json({ error: e.message }, { status: e.status ?? 401 }); }
const isAdmin = ["super_admin", "admin"].includes(staff.role_slug);
```

**Roles** (`role_slug`): `super_admin | admin | project_manager | staff |
designer | estimator | superintendent | subcontractor | vendor | client |
viewer`. Features gate writes per-role (e.g. PM-type roles edit projects; admins
manage everything; `client/vendor/...` are external).

`/api/auth/me` returns the current session user (id, email, display_name,
initials, **role**, title, avatar) for the client (the dashboard layout fetches
it to drive nav visibility).

---

## 3. Middleware / public-route convention

`middleware.ts` gates **only** `/dashboard/:path*`:
```ts
export const config = { matcher: ["/dashboard/:path*"] };
// no `cmi-session` cookie on a /dashboard route → redirect to /login
```
**Implication:** every public surface lives **outside** `/dashboard` and is
automatically open — e.g. `/c/[slug]` (business cards), `/book`, `/events/[slug]`
(booking), `/sms-opt-in` (consent), and their public APIs under `/api/cards/*`,
`/api/booking/*`, `/api/consent`. Keep that separation when porting.

---

## 4. Dynamic rendering (important gotcha)

Server-rendered dashboard pages that load live data **must** opt out of static
prerendering, or they bake in build-time data:
```ts
export const dynamic = "force-dynamic";
```
Add it to every `app/dashboard/<section>/page.tsx` that fetches from Supabase.
(Client-fetched pages — those that render a `"use client"` component which calls
the API on mount — don't need it.)

Also: relative "time ago" should be **anchored to the server clock** (pass a
`serverNow={Date.now()}` from the dynamic page) so a viewer's skewed local clock
doesn't distort timestamps.

---

## 5. Styling + theme

- **Tailwind** with semantic tokens used everywhere: `bg-background`, `bg-card`,
  `bg-muted`, `text-foreground`, `text-muted-foreground`, `text-accent`,
  `accent-foreground`, `border-border`, `border-input`, `ring`, plus
  `destructive`, `success`, `warning`. These map to CSS variables that flip in
  **dark mode** via a `.dark` class on a wrapper (a theme toggle persists the
  choice). Build components with tokens (not hard-coded colors) so they adapt.
- **`cn` helper** — `lib/utils.ts`: `cn(...) => twMerge(clsx(inputs))`.
- Tooltips that invert with theme use `bg-foreground text-background`.

---

## 6. Branded UI components (`components/ui/`)

These are **hand-rolled** (no shadcn/Radix dependency) and theme-aware. Reuse
them instead of native elements so everything matches light/dark.

| Component | File | Notes |
|---|---|---|
| `Button` | `button.tsx` | variants: `default, accent, secondary, outline, ghost, destructive`; sizes: `default, sm, lg, icon` (via `class-variance-authority`). |
| `Badge` | `badge.tsx` | tones: default/accent/success/warning/danger/info. |
| `Card` | `card.tsx` | `Card, CardHeader, CardTitle, CardDescription, CardContent`. |
| `Input` / `Select` / `Textarea` | `input.tsx` | **Custom** branded controls. `Input type="date"` and `type="datetime-local"` render bespoke pickers (no native browser calendar). `Select` is a custom dropdown that accepts `<option>` children (drop-in for native). |
| `Drawer` | `drawer.tsx` | Bottom-sheet that slides up; portal-free, fixed overlay; ESC to close. |
| `MultiCombobox` | `multi-combobox.tsx` | Searchable select; multi (chips) by default, `single` prop for single-select. |
| `Tooltip` | `tooltip.tsx` | Themed tooltip rendered via **portal + fixed positioning** (so it isn't clipped by `overflow` containers like a collapsed sidebar). Props: `label`, `side`. |

Audio (used by Recording Studio, reusable elsewhere):
| Component | File | Notes |
|---|---|---|
| `AudioRecorder` | `components/audio/audio-recorder.tsx` | Modal recorder with a live Web Audio waveform + timer; returns a `Blob`. |
| `AudioPlayer` | `components/audio/audio-player.tsx` | Play/pause, scrub, volume, speed, download. |

---

## 7. File uploads (Supabase Storage)

`/api/admin/uploads` (POST, `requireAdmin`) — multipart `file` + `folder`.
- Uploads to the **`cmi-media`** bucket, returns `{ url, path, name, type, size }`.
- MIME allowlist (image/*, video/*, application/pdf) + size cap (~50 MB).
- Good for avatars, card images, meeting images, etc.
- For **large media** (meeting audio/video), prefer **direct-to-storage signed
  uploads** instead (see Recording Studio): `createSignedUploadUrl(path)` →
  browser `PUT`s the file → store the path; playback via `createSignedUrl`.
  Private bucket; bytes never pass through the app server.

---

## 8. Notifications bell

`/api/notifications/unread-count` (GET, `requireAdmin`) returns
`{ count }` aggregated from "needs attention" sources (new contact submissions,
inbound messages, new card leads…). The dashboard layout polls it (~60s) and
badges the bell. Add new sources here (role-scoped where appropriate). Feature
tabs can also show their own scoped badge (e.g. Business Cards → Leads).

---

## 9. Outbound messaging (email / SMS) + consent

- **Email**: Resend — `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
- **SMS / voice**: Twilio — `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_PHONE_NUMBER` (+ Voice SDK vars for the dialer).
- **Consent suppression** (A2P 10DLC / CAN-SPAM): before any send, check
  `lib/messaging/consent.ts → isSuppressed(channel, address)`. Opt-outs live in
  an address-keyed `messaging_suppressions` table ("opted-in" = no row). Honor
  STOP/START in the inbound SMS webhook. Wire this into every send path
  (composer, agent, automations).

---

## 10. AI agent ("Bolt") integration point

Features can register an **entity** in the agent's tool registry
(`lib/agent/entities.ts`) so Bolt can read/search/update that data with full
field knowledge (e.g. a `meeting` entity, the business-card/contacts entities).
The agent calls an OpenAI-compatible gateway (`HERMES_AGENT_URL`) with tools;
destructive/outbound tools are staged for confirmation. Summarization features
reuse the same gateway via `/v1/chat/completions` with a strict-JSON prompt.

---

## 11. Environment variables (superset)

```bash
# App
NEXT_PUBLIC_APP_URL=https://my.constructedmatter.com

# Supabase (server-only)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Email (Resend)
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@constructedmatter.com

# Twilio (SMS + browser softphone)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
TWILIO_API_KEY_SID=
TWILIO_API_KEY_SECRET=
TWILIO_TWIML_APP_SID=

# OpenAI (Whisper transcription)
OPENAI_API_KEY=

# Bolt / Hermes agent gateway (OpenAI-compatible)
HERMES_AGENT_URL=
HERMES_AGENT_API_KEY=
HERMES_AGENT_MODEL=hermes-agent
```

### next.config.ts — Permissions-Policy
Browser mic recording (dialer + Recording Studio) requires:
```ts
{ key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }
```
The default `microphone=()` blocks `getUserMedia` and silently breaks recording.

---

## 12. npm dependencies (common)
`next`, `react`, `react-dom`, `@supabase/supabase-js`, `lucide-react`,
`tailwindcss`, `class-variance-authority`, `clsx`, `tailwind-merge`.
Feature-specific: `twilio` + `@twilio/voice-sdk` (dialer), `qrcode` (business
card QR). No shadcn/Radix, no Gantt library, no audio library — all hand-rolled.

---

## 13. Conventions cheat-sheet
- **Data flow:** `page.tsx` (server, `force-dynamic`) → loads via `lib/<x>/data.ts`
  (service role) → passes to a `"use client"` component; OR a thin server page →
  client component that fetches its own API on mount.
- **Routes:** `app/api/<domain>/route.ts` with `requireAdmin` for staff actions;
  public actions live under public paths and skip auth.
- **Migrations:** plain `.sql` under `supabase/` using `create table if not
  exists` / `add column if not exists` / `on conflict do nothing` so they're
  safe to re-run.
- **Role gating:** reads open to all staff; writes gated by `role_slug`;
  destructive/outbound actions confirmed or suppression-checked.
