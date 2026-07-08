# CMI Sales Pipeline — Implementation Notes

Implements the workflow defined in
[`cmi-sales-process-leads-opportunities.md`](./cmi-sales-process-leads-opportunities.md).
This document describes *what was actually built* in the `apps/cmi-next` app and
how the pieces fit together.

## Terminology → data model

| Business concept | Where it lives |
| --- | --- |
| **Lead** (marketing / referral / prospect) | Existing `contacts` (`type='Lead'`) + `quotes`. **No job number.** |
| **Opportunity → Closed lifecycle** | New `pipeline_opportunities` table (one row per real project). |
| **Stage history** (reporting) | New `pipeline_stage_history` table. |
| **Warranty requests** (portal tie-back) | New `warranty_requests` table. |

We deliberately did **not** build a parallel "leads" table — leads already exist
in the CRM. The pipeline begins at the **Opportunity** stage, which is the moment
a **job number** is created.

## Job numbers

A job number is assigned by a Postgres `BEFORE INSERT` trigger
(`assign_pipeline_job_number`) on `pipeline_opportunities`, backed by the
`pipeline_job_number_seq` sequence. Format: **`CM-YYYY-####`** (e.g.
`CM-2026-0007`). Because rows only exist for Opportunities and beyond, a job
number is created exactly when a Lead becomes an Opportunity — never before. A
caller may pass an explicit `job_number` to override; the trigger only fills a
blank one.

## Stages & transitions

Normalized stage values (column `stage`):

```
opportunity → active_budget → pre_construction_design → active_project → warranty → closed
                └──────────── long_lead / not_moving_forward (alternate paths) ───────────┘
```

The stage machine lives in [`lib/pipeline/stages.ts`](../../apps/cmi-next/lib/pipeline/stages.ts):

- `ALLOWED_TRANSITIONS` — the legal next-stage map (doc §12).
- `validateTransition()` — checks the path is legal **and** that required fields
  are present on the record *after* the proposed patch.
- `requiredFieldsForStage()` — the required fields the UI prompts for:
  - **Active Project**: `construction_agreement_status`, `start_date`, `project_manager`
  - **Warranty**: `actual_completion_date`, `warranty_start_date`, `warranty_expiration_date`
  - **Closed**: `warranty_expiration_date`, `closed_date`
  - **Long Lead**: `long_lead_reason`, `follow_up_date`
  - **Not Moving Forward**: `lost_reason`
- `derivedTransitionPatch()` — auto-fills warranty expiration (start + period),
  and stamps `closed_date` / `lost_date`.
- `transitionRequiresAdmin()` — reopening a **Closed** record back to Warranty is
  admin/super-admin only (enforced in the transition API route).

Every transition writes a `pipeline_stage_history` row (from → to, actor, note),
which powers conversion-rate and time-in-stage reporting.

## API routes (`app/api/pipeline`)

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/pipeline` | GET / POST | List / create (create mints the job number). |
| `/api/pipeline/[id]` | PATCH / DELETE | Edit fields (not stage) / delete. |
| `/api/pipeline/[id]/transition` | POST | Guarded stage move (`{ to, patch, note }`). |
| `/api/pipeline/convert` | POST | Convert a Lead → Opportunity (`{ source:'quote'\|'contact', id, overrides }`). |
| `/api/pipeline/reporting` | GET | Conversion rates + pipeline summary + loss analysis. |
| `/api/warranty-requests` | GET (staff) / POST (public) | Warranty tracking + portal/website submission. |
| `/api/warranty-requests/[id]` | PATCH | Staff triage. |

All writes are gated to sales/ops roles (`super_admin`, `admin`,
`project_manager`, `estimator`) via `requireAdmin`, matching the rest of the app.
Reads go through the service-role client server-side.

## Dashboard UI

New section **Sales Pipeline** at `/dashboard/pipeline` (nav entry gated to
sales/ops roles). [`pipeline-client.tsx`](../../apps/cmi-next/app/dashboard/pipeline/pipeline-client.tsx)
provides:

- A **reporting strip** (est. pipeline value, forecast, active contracts, counts,
  and the four conversion rates).
- **Stage tabs** with live counts, acting as the Lead list / Opportunity
  pipeline / Active Budget board / Pre-Con board / Active Projects / Warranty /
  Closed archive / Long-Lead / Not-Moving-Forward views (filter by stage).
- **Table** and **Kanban** views.
- Search + owner + project-type filters.
- A **detail modal** with guarded stage-transition controls: only the allowed
  next stages are offered, and the required fields for the target stage are
  prompted inline before the move is submitted.
- Add / edit opportunity forms (with the "job number is auto-created" callout).

The **Quotes & Leads** view gained a **Convert to Opportunity** button (the
Lead → Opportunity entry point) which calls `/api/pipeline/convert`.

## AI agent (Bolt)

Two entities were registered in
[`lib/agent/entities.ts`](../../apps/cmi-next/lib/agent/entities.ts): `opportunity`
and `warranty_request`, with descriptions encoding the guardrails (don't set the
job number, follow allowed transition paths, don't mark Active Project without
the commitment fields).

## Follow-ups / TODOs

- **Client portal warranty form UI**: the API + table are ready; a public/portal
  form still needs to be wired (the app's client portal is minimal today).
- **Long-lead reminders**: `follow_up_date` is captured and surfaced in the
  report; wiring an automated reminder (email/notification cron) is a follow-up.
- **Agent transition safety**: Bolt's generic CRUD can set `stage` directly,
  bypassing `validateTransition`. Consider routing agent stage changes through a
  dedicated transition tool.
- **Backfill**: existing `projects` rows are not migrated into
  `pipeline_opportunities`; decide whether historical projects should be
  represented as Closed/Warranty opportunities.
```
