# CMI Client Portal — Implementation Notes (Phase 1)

Implements [`client-portal-jobs-feature.md`](./client-portal-jobs-feature.md). A client-facing `/client` portal tied to Jobs: each client logs in and sees only the jobs they're associated with, with client-safe content only.

## Auth (invite-only, separate from staff)

- Clients authenticate with **Supabase Auth** and carry a **separate `cmi-client-session` cookie** — a client token never satisfies the `/dashboard` gate.
- `lib/client-portal/auth.ts`: `requireClient` (route handlers), `getClientSession` (server components), `verifyClientJob(jobId)` (per-page access re-check), `assertJobAccess`, `getJobPerms`. Authorized only if the auth email → a `contacts` row with `job_contacts.portal_access_enabled` on a `client_portal_enabled` job.
- `app/api/client/auth/`: `signin`, `signout`, `me`, `exchange-token`, `set-password`.
- `middleware.ts` gates `/client/**` on `cmi-client-session` (allows `/client/login`, `/client/set-account`, `/api/client/auth`).
- **Invites** reuse `supabase.auth.admin.generateLink` + Resend (`lib/client-portal/notify.ts`), redirecting to `/client/set-account`.

**Security model:** RLS stays permissive-anon (service-role app); **every `/api/client/**` handler + every client page runs `requireClient`/`verifyClientJob` and filters to `client_visible` + permission-gated rows.** A client cannot reach another client's job (403 → redirect).

## Database — migration `supabase/2026-07-08_client_portal.sql`

- `jobs` +`client_portal_enabled`, `progress_percentage`, `current_phase`, `next_milestone`, `client_description`, `cover_image_url`, `last_client_update_at`.
- `contacts` +`portal_last_login_at`.
- `warranty_requests` +`job_id`, `category`, `resolution_notes`, `scheduled_service_date`, `completed_at` (reuse for job-scoped warranty).
- New `job_updates` (client feed) and `job_messages` (client↔staff thread). RLS + indexes.

## Reuse (no duplication)

Clients = `job_contacts` (`portal_access_enabled` + `permissions` jsonb). Photos/documents = `job_files` split by mime (`client_visible`). Financials/change orders = existing `invoices`/`change_orders` (`client_visible`, permission-gated). Warranty = existing `warranty_requests`.

## Client UI — `app/client/`

`login`, `set-account`, `jobs` (project cards), `jobs/[jobId]` shell (permission-filtered tabs) + tabs: **Overview, Updates, Progress** (phase ladder), **Photos** (albums), **Documents**, **Financials** (perm-gated), **Change Orders**, **Messages** (thread + composer), **Warranty** (submit + track). Own lightweight shell (`client-shell.tsx`), not the staff sidebar.

## Staff controls — `app/dashboard/jobs/[jobId]/client-portal/`

New **Client Portal** job tab: enable/disable portal, edit progress/phase/next-milestone/description/cover, **publish updates** (job_updates), **invite clients**, **triage warranty**, **reply to client messages**, client-link preview. Per-client visibility (financials/schedule/submit) remains on the existing **Job Info → Clients** tab (`job_contacts.permissions`). Staff API: `/api/jobs/[id]/updates(+[updateId])`, `/api/jobs/[id]/clients/[subId]/invite`, `/api/jobs/[id]/messages`, `/api/jobs/[id]/warranty`. Agent: `job_update` entity registered.

## Deferred (later phases)
Selections + approval workflow, client action items, in-app/SMS notifications & preferences, message attachments/read-receipts, engagement reporting, public-portfolio photo promotion.

## Verification
- `tsc`, `eslint`, `next build` pass; DB smoke on portal enable + job_update + job-scoped warranty.
- Manual end-to-end (needs a real invite email): staff enable portal + invite → client set-account → `/client/login` → see only their job → browse tabs → submit warranty → staff sees it; second client gets 403 on another's job.
