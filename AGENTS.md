# AGENTS.md — Constructed Matter, Inc. (CMI)

Instructions for every AI agent working in this repo: Claude Code, Codex, Hermes,
Paperclip-managed agents, and Bolt. Read this before you change anything.

---

## What this is

CMI is a construction company. This repo holds its public website, staff dashboard
and client portal, all in **one Next.js app**: `apps/cmi-next`.

- Live site: https://my.constructedmatter.com/ (future domain: constructedmatter.com)
- Staff dashboard: https://my.constructedmatter.com/dashboard
- Client portal: https://my.constructedmatter.com/client
- Repo: https://github.com/Qallus/cmi (default branch `master`)

**WordPress is gone.** There is no WordPress, FluentCRM, FluentBoards, FluentBooking or
WS Form integration, and no `staff-dashboard.html`. Contacts, deals, jobs, bookings,
quotes, documents and messaging all live in Supabase and run through this app's own
API routes. The only leftovers are unused schema columns (`contacts.fluent_crm_id`,
`quotes.fluent_crm_id`, `*.wp_post_id`). Do not build on them or add integrations for
those systems. If any older doc says otherwise, trust the code.

---

## Stack

| Layer | What we use | Where it lives in code |
| --- | --- | --- |
| App | Next.js 16 (App Router), React 19, TypeScript, Tailwind, Radix UI, lucide | `apps/cmi-next` |
| Database / auth data | Supabase Postgres, accessed **server-side only** with the service role | `lib/supabase/`, `apps/cmi-next/supabase/migrations/` |
| Email | Resend (transactional, notifications, briefings, broadcasts) | `lib/email/`, `lib/messaging/send.ts` |
| SMS / voice | Twilio: SMS, browser softphone (Voice SDK), call recording, webhooks | `lib/twilio.ts`, `app/api/twilio/`, `app/api/webhooks/twilio/` |
| In-app AI agent | **Bolt**, which runs on the self-hosted **Hermes** gateway (OpenAI-compatible tool calling) | `lib/agent/`, `app/api/agent/` |
| Agent management | **Paperclip**, a self-hosted control plane for Hermes agents | `lib/paperclip/`, `app/api/paperclip/`, `docs/paperclip-agent-manager/` |
| Coding agents | Claude Code (reads `CLAUDE.md`) and Codex (reads this file) | — |
| Transcription | OpenAI Whisper | `app/api/transcribe/`, `lib/meetings/` |
| Voice agent (public site) | xAI voice agent, using short-lived server-minted tokens | `app/api/voice-agent/` |
| File storage | Garage (S3-compatible) on the CMI office server, with metadata in Supabase | `lib/files/`, `lib/storage.ts` |
| Push | Web Push (VAPID) for the PWA | `lib/push/` |
| PDFs | `@react-pdf/renderer`, `unpdf` | `lib/pdf/` |
| Hosting | Coolify on a managed VPS (Docker build of `apps/cmi-next`) | `apps/cmi-next/Dockerfile`, `COOLIFY_DEPLOYMENT.md` |
| CI / deploy | GitHub, where every push to `master` triggers a Coolify deploy | `.github/workflows/deploy.yml` |
| Scheduled jobs | Coolify Scheduled Tasks that call secret-guarded API routes | `app/api/automations/`, `docs/automations/` |

Other pieces in the repo:

- `extension/`: Chrome MV3 side panel (Vite) that captures vendor products into Selections.
- `design_system/`: CMI design system reference.
- `docs/`: feature specs, plans and runbooks. Start with `docs/features/README.md`.
- `supabase/` (root): older SQL from before the Next migration. New SQL goes in `apps/cmi-next/supabase/migrations/`.

---

## Repo map (`apps/cmi-next`)

```text
app/                 Public pages (/, /portfolio, /team, /services, /blog, /book, /lp/*, consent pages…)
app/dashboard/       Staff dashboard (Jobs, Pipeline, Pre-Con, Schedules, Communications, Cloud, Agent…)
app/client/          Client portal (per-job: progress, schedule, selections, documents, financials…)
app/api/             All server routes, grouped by domain
lib/<domain>/        Data access and business logic per domain (data.ts, types.ts, …)
lib/auth/            Sessions, roles, requireAdmin / requireSuperAdmin
lib/agent/           Bolt: entity registry, tools, prompt, dashboard guide
lib/notifications/   notifyStaff() dispatcher (in-app row → push → email)
lib/flags.ts         DB-backed feature flags (table: feature_flags)
components/          Shared UI
middleware.ts        Route protection for /dashboard and /client
supabase/migrations/ SQL migrations (YYYY-MM-DD_description.sql)
```

---

## Commands

Run from `apps/cmi-next`:

```bash
npm install
npm run dev         # local dev server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # node --test lib/**/*.test.mjs
npm run build       # production build
```

Before you call a change done, run `typecheck` and `lint`, plus `test` if you touched
`lib/`. Report failures honestly.

**Local dev talks to the live Supabase database** using the real Resend, Twilio and
VAPID keys. Treat every write as a production write.

---

## Rules

### Security

- The Supabase service role key, and every Resend, Twilio, Hermes, Paperclip, OpenAI,
  xAI, S3 and automation secret, is **server-only**. Never import them into client
  components or put them in `NEXT_PUBLIC_*` variables.
- Every dashboard API route checks access on the server with `requireAdmin` or
  `requireSuperAdmin` (`lib/auth/require-admin.ts`), plus role checks from
  `lib/auth/roles.ts`. UI-only checks are not security.
- Staff roles: `super_admin`, `admin`, `project_manager`, `staff`, `designer`,
  `estimator`, `superintendent`. Non-staff roles: `subcontractor`, `vendor`, `client`,
  `viewer`. Non-staff users must never reach staff data.
- Client portal routes scope every query to the client's own jobs (`lib/client-portal/`).
- Webhooks verify their signature (Twilio `x-twilio-signature`). Cron routes require
  `Authorization: Bearer $AUTOMATION_SECRET`.
- Never commit `.env*` values, and never paste real secrets into docs.
- **Coolify:** `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are the only
  build variables. Everything else is runtime-only, because build args get baked into
  the image. See `COOLIFY_DEPLOYMENT.md`.

### Messaging

- Before every outbound email or SMS, check consent and suppression (`lib/messaging/consent.ts`, `isSuppressed`). This is A2P 10DLC and CAN-SPAM compliance, not optional.
- Send staff notifications through `notifyStaff()` in `lib/notifications/dispatch.ts`. Do not call Resend or push directly for a new notification.
- Outside `NODE_ENV=production`, outbound email, SMS and push are held. Set `NOTIFY_FORCE_SEND=true` only when you mean to send a real message.
- Logos and images in emails must be PNG, because Gmail and Outlook strip SVG.
- Never send stale or test-era queued messages. Automations stay gated by `AUTOMATION_ENABLED`.

### Data and schema

- Inspect the existing tables before you add one, and do not create duplicates.
  Do not rename or drop tables or columns blindly.
- Put schema changes in a new file in `apps/cmi-next/supabase/migrations/`. Make it
  idempotent (`if not exists`) and safe to re-run.
- Gate new or unfinished features behind a `feature_flags` row (`lib/flags.ts`), with
  the flag off until it is approved.
- Keep the data layer in `lib/<domain>/data.ts` and the routes thin.

### Bolt (in-app agent)

- Bolt's tools all go through `dispatchTool()` in `lib/agent/tools.ts`, which handles
  role gating, field allowlists and confirmation staging. Extend that path. Do not
  build a parallel tool layer.
- Deletes and sends are staged as pending actions that a person must confirm. Keep it that way.
- **When you add, rename or move a dashboard page, nav item or feature, update
  `lib/agent/dashboard-guide.ts` in the same change.** Otherwise Bolt gives users
  wrong directions.
- New entities Bolt should manage get registered in `lib/agent/entities.ts`.

### Paperclip / Hermes

- The app must stay fully usable when Paperclip or Hermes is down. Integration calls
  return result values rather than throwing (see `lib/paperclip/client.ts`).
- Read `docs/paperclip-agent-manager/01-discovery-and-architecture.md` before you do
  any agent integration work.

### Code style

- Match the surrounding code: its naming, comment density and patterns. Make small,
  targeted changes, and do not rewrite working code unasked.
- Every form or action needs loading, success and error states.
- Keep public URLs stable, including `/portfolio/*`, `/team/*`, `/c/[slug]`, consent pages and `/lp/*`.

---

## Git and deploy

- `master` deploys to production automatically through GitHub Actions and Coolify.
- Commit or push only when asked. When asked, it should land on `master` unless the
  user says a branch or PR is for review.
- The working tree usually contains unrelated untracked files (docs, take-offs,
  exports). Commit only the files you changed, by explicit path. Never use `git add -A`.
- Before pushing, check that `origin/master` hasn't diverged.

---

## Before you finish

Summarize:

1. The files you changed.
2. Any migration you added, and whether it still needs to be run.
3. Any new env vars, and where they need to be set (Coolify, `.env.local`, `.env.example`).
4. The check results (typecheck, lint, test).
5. Any blockers or open decisions.
