# Daily Logs → Field Reports: game plan

## Context

`docs/daily-logs/CMI Field Reports Prototype.md` proposes three linked upgrades:
- a structured daily log
- a per-job Photos library
- an Executive Summary drafted from those logs

Today the Daily Logs feature has several problems:
- Every photo or voice note writes its own `daily_logs` row, titled "Site photo" or with the transcript's first words.
- Transcripts go into `notes` word for word.
- Logs can target Jobs, Pre-Con and Pipeline.
- Photos are scattered across about six places.
- The Executive Summary already exists (`lib/exec-summary/*`), but it has no period and no draft, and it only picks from photos it gathers itself.

**Decisions (from Jeremy):**
- **Jobs only going forward.** Existing Pre-Con and Pipeline logs stay readable.
- **Action items spoken into a log become internal Commitments.** The client Executive Summary may still draw on that material, but only as polished, client-ready wording. It never shows raw internal text.
- **Photos library backfill:** existing daily-log photos, job Files images and Client Update photos are indexed (no file moves).

Everything sits behind a new flag, `field_reports`, which stays off until approved. With it off, today's behaviour is unchanged. The plan doc lives at `docs/features/field-reports/field-reports-plan.md`, with this content.

## Step 0: Fix these first (no flag; safety)

- **Outbound guard.** `lib/messaging/send.ts` `sendEmail`/`sendSms` call Resend and Twilio with no `canSendOutbound()` check.
  - That means Executive Summary emails and texts, and client-portal notices, go out from local dev.
  - Add the check inside `send.ts`, using `lib/notifications/dispatch.ts:48`. It returns false and logs "held" outside production unless `NOTIFY_FORCE_SEND`.
  - This covers every caller at once.
- **Daily-log API gaps:**
  - `POST /api/jobs/[id]/daily-logs` passes the raw body to `createDailyLog`, so any column can be set and `created_by_id` is never set.
  - `PATCH` and `DELETE /api/jobs/[id]/daily-logs/[logId]` don't check that the log belongs to `[id]`, or that a private log is the caller's.
  - Whitelist the fields, set `created_by_id`, and check ownership.

## Step 1: One log per job per day, with sections and Submit

**Migration** (`apps/cmi-next/supabase/migrations/2026-11-xx_field_reports.sql`, applied only with approval):
- On `daily_logs`, add:
  - `report_version int default 1` (2 = a field report)
  - `sections jsonb`
  - `status text default 'draft'` (draft | submitted)
  - `log_number int` (per job)
  - `submitted_by uuid`, `submitted_at timestamptz`
- A partial unique index `(job_id, log_date) where report_version = 2`. Old logs keep their many-per-day rows.
- `commitments.source` gains `'daily_log'`.
- Insert the `field_reports` flag row, off.

**Sections** are a typed shape in `lib/daily-logs/sections.ts`. It's pure, with tests.
- The sections:
  - work completed
  - on site: company and trade, with crew size and hours optional and never required
  - deliveries
  - inspections: type, result
  - delays/issues: impact
  - safety
  - equipment
  - visitors
  - look-ahead
  - action items: owner, due
  - internal notes
- Each item carries `star` (☆, for the Executive Summary) and `source` (dictated, typed or photo).
- Keep `notes`, `weather` and `temperature`. Weather fills in from `lib/weather.ts` as it does today.

**Data layer** (`lib/daily-logs/data.ts`):
- `getOrCreateDayLog(jobId, date)` returns that day's v2 log, creating it as a draft with the next `log_number`.
- `appendToDayLog(jobId, date, { photos, attachments, transcript, items })` merges a capture into the day's log.
- `submitDayLog(id)` locks the log. Later edits are recorded in Activity, using the history pattern from `lib/schedules/data.ts` `fieldChanges` and `logActivity`.
- `loadLogTargets()` returns active Jobs only when the flag is on.

**Capture paths** all append, never insert:
- `components/dashboard/add-daily-log.tsx`: Step 1 becomes Jobs only, and the Client visibility option is removed. Logs stay internal; `client_visible` defaults to off.
- the phone's Camera and Record flows: `components/dashboard/mobile-bottom-nav.tsx`, `job-voice-recorder.tsx`, `media-destination.tsx`. The Daily Log destination lists Jobs only.
- Bolt/MCP: `lib/mcp/tools-crm.ts` `cmi_daily_log_create` / `_update`.

**Report view.** The job's Daily Logs page shows one card per day:
- Draft or Submitted, the log #, weather, and each section
- a "Needs a look" list
- Submit
- a printable finished report, a react-pdf `DailyReportPdf` built on `components/pdf/cmi-theme.tsx`

## Step 2: Voice → organized log

The chain is: Record (existing MediaRecorder) → Transcribe (existing `app/api/transcribe`, Whisper) → **structure pass** → Review → Submit.

- **Structure pass:** a new `lib/daily-logs/structure.ts`, using the same model path as `lib/exec-summary/generate.ts` (`callHermes`).
  - Inputs: the transcript, the section schema, the job's trade partners, and that week's schedule items from `listItems({ jobId })`.
  - Output: JSON matching the sections.
  - Rules:
    - Clean up filler, keep the facts, and never invent quantities, names or results.
    - One sentence may feed two sections.
- **"Needs a look" checks** are pure, in `sections.ts`:
  - no safety note
  - an inspection with no result
  - a delay with no impact
  - an on-site company with no trade
  - an action item with no owner
- **Raw material is kept.** The original audio stays in `attachments` and the raw transcript is stored in `sections.raw`.
- **Action items become internal Commitments** (`lib/commitments/data.ts`), with `source: 'daily_log'`, `source_ref` = the log id, a staff owner, a due date and the job.
  - They're created on Submit, not on every capture, so edits don't make duplicates.
  - The client is never notified.

## Step 3: Photos library

**Table:** `job_photos`
- `id, job_id, url, storage` (cmi-media | garage), `taken_at`, `uploaded_by`
- `source_type` (daily_log | job_file | job_update | phone | exec_summary), `source_id`
- `area, trade, tags text[], caption, client_ok bool default false, starred`
- uniqueness on `(job_id, url)`

**Taking photos in:**
- `taken_at` reads EXIF `DateTimeOriginal` in the browser before upload (add `exifr`), and falls back to the upload time.
- Every upload path writes a row through `lib/photos/data.ts` `recordPhoto()`:
  - daily-log captures
  - `app/api/jobs/[id]/files` for images
  - Client Update media
  - the phone camera
  - Executive Summary uploads
- Daily logs and summaries store **photo ids**, not copies.
- **Backfill** runs in the migration: it indexes `daily_logs.photos`, `job_files` images and `job_updates.media`/`photo_url` for each job, without duplicates.

**UI:** a job **Photos** tab.
- Filters: date range, source, area, trade, client-OK.
- Groups photos by date, with multi-select.
- Bulk-edit area, trade, tags and client-OK.
- "Add to Executive Summary".

**Client portal:** `lib/client-portal/data.ts` `loadClientFiles` also reads `job_photos` where `client_ok`. Existing `job_files` albums keep working.

**Later** (noted, not built): AI suggests area and trade.

## Step 4: Executive Summary upgrade (extend the existing feature)

Keep `executive_summaries` and `lib/exec-summary/*`. The migration adds:
- `period_start, period_end`
- `sections jsonb`
- `photo_ids uuid[]`
- real `draft` saving: today the code only ever writes `sent`

**Sources (`snapshot.ts`), all for the chosen period:**
- **Schedule:**
  - `% complete`, the current phase and the next milestone from `jobScheduleHeader` (`lib/schedules/data.ts`)
  - a new `lookahead(jobId, days)` helper in `lib/schedules`
  - forecast vs contract completion, from the engine's contract variance
- **Change orders:** approved and `pending_approval`.
- **Invoices:** latest status and billed to date. There's no pay-app model; note that in the summary.
- **Selections:** decisions due, from `target_decision_date`.
- **The period's v2 daily logs**, with ☆ items first.

**Client guardrail:**
- Delays/Issues, On site, Action items and Internal notes never go to the client as written.
- The client prompt (`CLIENT_RULES` in `generate.ts`) may turn them into polished, client-appropriate wording. For example, "Plumbing inspection is scheduled this week; we're coordinating the follow-up items."
- The review panel lists **"Kept internal (N)"**, with an Add back option on each item.
- This replaces today's `NEGATIVE` regex and the `client_visible` log filter.

**Photos:** picked from the library (`job_photos`, with client-OK ones first) or uploaded, which records them into the library.

**Send:**
- **Email** to the job's client contacts, through the guarded `send.ts`.
- **A portal post:** add `executive_summary` to `job_updates.update_type` in `lib/job-updates/types.ts`.
- **The PDF saved to the job's Files.** Render it on the server with react-pdf, the same as the schedule and invoice PDFs, and add an `ExecSummaryPdf`. Today's browser print stays for quick printing.

## Order and size

| Step | Scope |
|---|---|
| 0 | send guard and API fixes |
| 1 | one log per day, sections, Submit |
| 2 | voice structure pass |
| 3 | Photos library |
| 4 | Executive Summary upgrade |

- Each step ships on its own behind `field_reports`.
- Steps 1 and 2 are the field-facing core.
- Step 4 benefits from Step 3, but can start once Step 1 is done.

**Also update:**
- `lib/agent/dashboard-guide.ts` (Daily Logs, Photos and Executive Summary entries; Pre-Con logging removed)
- Bolt context: `lib/agent/job-context.ts`, `lib/mcp/tools-crm.ts`
- memory

## Verification

**Tests:**
- `npm run typecheck`, `npm run lint` and `npm run test` in `apps/cmi-next`.
- Pure tests:
  - the `sections.ts` merge (appending two captures)
  - the "Needs a look" checks
  - the client guardrail filter (internal sections are removed unless added back)
  - photo dedupe
  - EXIF date fallback

**On a ZZ test job (local, then live with Playwright after the flag is on):**
1. Capture two voice notes and a photo in one day. They should form one log, with items sorted into sections and a "Needs a look" list.
2. Submit. The log locks, an edit shows up in Activity, and the action items appear in Commitments.
3. The Photos tab shows backfilled and new photos. Filter them, mark one client-OK, and it appears in the portal.
4. Build an Executive Summary for a date range. Check:
   - the ☆ items lead
   - internal items are listed as kept internal
   - the email preview reads cleanly
   - **sending from local dev is held** (Step 0)

Real sends happen only on production, to a test contact.

**Migrations** are written first and applied only after Jeremy approves.
