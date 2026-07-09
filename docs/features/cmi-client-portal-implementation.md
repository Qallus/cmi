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

## Phase 2 (built) — Selections+Approvals, Action Items, Notifications, Engagement Reporting

Migration `supabase/2026-07-08_client_portal_phase2.sql`: `project_selections.job_id` (reuse the rich selection/approval model job-scoped), `job_action_items`, `client_notifications`, `client_notification_prefs`.

- **Selections + approvals** — staff tab `[jobId]/selections` (reuses `project_selections` via `lib/job-selections`), toggles for client-visible + needs-approval; client tab `/client/jobs/[jobId]/selections` with **Approve / Request change**; decision API sets `approval_status` + timestamps + comment. Marking a selection pending → clients notified.
- **Action items** — `lib/action-items` + APIs; staff panel on the Client Portal page (assign to a client) + client `/client/jobs/[jobId]/action-items` tab and an Overview "Action Needed" card; client **mark complete**. New items notify the client.
- **Notifications** — `lib/client-portal/notifications.ts`: in-app (`client_notifications`) always, plus **Resend email** and **Twilio SMS** per `client_notification_prefs` (SMS opt-in + `isSuppressed` consent check, logged via `logMessage`). Triggers wired into client-visible updates, staff messages, selection-approval, action-item create, warranty status change. Client **bell + unread badge** (`client-shell`), `/client/notifications` center, `/client/settings` channel prefs.
- **Engagement reporting** — `lib/client-portal/reporting.ts` + `/dashboard/client-engagement` (nav child under **Jobs**): per-job last client login, pending approvals, open action items, unread client messages, open warranty, and stale-update flags.
- Agent: `action_item` (+ `job_update`) entities registered.

## Deferred (later)
Message attachments/read-receipts, client inspiration-image uploads on selections, push notifications, quiet-hours/granular SMS scheduling, public-portfolio photo promotion.

## Verification
- `tsc`, `eslint`, `next build` pass; DB smoke on portal enable + job_update + job-scoped warranty.
- Manual end-to-end (needs a real invite email): staff enable portal + invite → client set-account → `/client/login` → see only their job → browse tabs → submit warranty → staff sees it; second client gets 403 on another's job.
