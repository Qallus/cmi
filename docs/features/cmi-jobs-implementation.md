# CMI Jobs Feature — Implementation Notes

Implements [`job-features.md`](./job-features.md). A **Job** is the central project
record, created when an **Opportunity** (sales pipeline) becomes a real project.
It sits downstream of the sales flow and does not replace Leads/Opportunities.

```
Lead (contacts / quotes)
  → Opportunity (pipeline_opportunities, CM-YYYY-####)   ← Sales
     → Job (jobs, YY_###_JobName)                        ← Project Management
```

## Data model (migration `supabase/2026-07-08_jobs_feature.sql`, applied live)

- **`jobs`** — central record: `related_opportunity_id` (FK → `pipeline_opportunities`), `related_lead_id`, `job_number` (unique), `job_name` (unique), `job_type_id`, `job_group_id`, `status` (draft/opportunity/active_budget/pre_construction_design/active_project/warranty/closed/long_lead/not_moving_forward/on_hold/cancelled), color, contract type/price, full address + lat/long, schedule dates, square feet/permit/lot, notes, `is_template`, `source_template_id`, `accounting_customer_id`, audit fields.
- **`job_types`** (seeded with the doc's list), **`job_groups`**.
- **`job_contacts`** (clients + portal permissions jsonb), **`job_internal_users`** (staff), **`job_vendors`** (subs/vendors).
- **`job_settings`** (advanced settings, 1:1), **`job_insurance`** (1:1), **`job_activity_logs`** (audit).
- **`job_number_counters`** + `assign_job_number()` trigger → **`YY_###_JobName`**, sequence resets each year; templates skip numbering; explicit number honored (staff override). Verified: `26_001_Smith Residence`, `26_002_Arcadia ADU`.
- RLS: permissive-anon (app uses the service-role client server-side); indexes on status/type/group/opportunity/etc.

## Code

- **`lib/jobs/`** — `types.ts`, `status.ts` (status meta + Buildertrend Presale/Open/Warranty/Closed mapping + `opportunityStageToJobStatus`), `data.ts` (CRUD, joined `getJob`, denormalized `loadJobList`, sub-entity ops, `upsertJobSettings/Insurance`, **`convertOpportunityToJob`**, **`createJobFromTemplate`** (safe fields only), `buildPriceSummary`), `geocode.ts` (best-effort Nominatim/OSM), `reporting.ts`.
- **`app/api/jobs/`** — `route`, `[id]`, `[id]/{contacts,internal-users,vendors}(/[subId])`, `[id]/{settings,insurance,price-summary}`, `convert`, `from-template`, `job-types`, `job-groups`. All `requireAdmin` + role-gated (`WRITE_ROLES = super_admin/admin/project_manager`; types/groups admin-only; archive admin-only).
- **`app/dashboard/jobs/`** — Jobs List (`page` + `jobs-list-client`: searchable/sortable/filtered table, stat tiles, List⇄Map, Saved-View placeholder, New Job menu), Map (`map/`: Leaflet + OSM/Esri tiles, colored div-icon pins, left list, Map-All, fallback for un-geocoded), New from Scratch (`new/`: 6-tab create + save-as-draft), New from Template (`new-from-template/`), and per-job `[jobId]/summary`, `/info` (6 editable tabs), `/price-summary` (printable), `[module]` catch-all (link-out or "Coming soon"), plus shared `job-ui.tsx` + `job-detail-nav.tsx`.
- **Nav** — new **Jobs** collapsible parent (→ list) with Jobs Map + Templates children.
- **Sales link** — pipeline opportunity detail gained **Promote to Job** (`/api/jobs/convert`).
- **Agent** — `job` entity registered in `lib/agent/entities.ts` (guardrails: never set job number, follow status list).
- **Print** — dashboard `<aside>`/`<header>` get `print:hidden`; root grid `print:!block` so the Price Summary prints clean.

## Job modules (built) — Change Orders, Invoices, Daily Logs, Files

Migration `supabase/2026-07-08_job_modules.sql`: `change_orders`, `invoices` + `invoice_line_items`, `daily_logs`, `job_files` (all job-scoped, cascade-delete, RLS + indexes). Per-job numbering `CO-####` / `INV-####` via `lib/jobs/numbering.ts`.

- **lib**: `lib/change-orders`, `lib/invoices` (+ line items, `invoiceBalance`), `lib/daily-logs`, `lib/job-files`; `lib/storage.ts` (shared `cmi-media` upload). `buildPriceSummary()` now loads **approved change orders + invoices** (no longer placeholder).
- **Branded PDFs** — `@react-pdf/renderer` + `components/pdf/` (`cmi-theme`, `invoice-pdf`, `change-order-pdf`, `price-summary-pdf`), `lib/pdf/render.ts` + `lib/pdf/assets.ts` (logo→data URI). Server routes `…/pdf` (Node runtime) stream `application/pdf`.
- **Invoice email** — `…/invoices/[invId]/send` renders the PDF and emails it as an attachment via **Resend**, respecting `isSuppressed`, logging to `messages`, and marking the invoice sent.
- **API** — `app/api/jobs/[id]/{change-orders,invoices,daily-logs,files}` (+ `[subId]`, `pdf`, `send`), role-gated (PM; daily-logs/files also `superintendent`). Files upload is multipart → `cmi-media`.
- **UI** — concrete job tabs `change-orders/`, `invoices/` (line-item editor + Download PDF + Send), `daily-logs/`, `files/` (drag-drop upload); shared `job-module-shell.tsx`. Price Summary page gained **Download PDF**. Those four slugs removed from the `[module]` "Coming soon" map.
- **Agent** — `change_order`, `invoice`, `daily_log`, `job_file` entities registered.

## Remaining placeholders / follow-ups

- Still linked/scaffolded: schedule→Project Manager, selections→Selections, warranty→Sales, messages→Communications; `[module]` scaffolds for tasks, photos, purchase-orders, activity.
- Not yet built: payment processing (invoices track `amount_paid` manually), time-clock "clocked-in", QuickBooks/accounting sync, saved custom views, map clustering, insurance certificate upload / "request quote", change-order line items, daily-log photo upload UI (URLs stored), geofencing enforcement.
- Geocoding is best-effort (Nominatim, ~1 req/s) — un-geocoded jobs show in the list, not the map.

## Verification
- `tsc --noEmit`, `eslint`, `next build` all pass; DB smoke-tested job-number generation + template skip.
- Drive: New Job (scratch + template), Promote an Opportunity, open Summary/Info/Price-Summary, load the Map with a geocoded address, print the Price Summary.
