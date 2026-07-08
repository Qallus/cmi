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

## Placeholders / follow-ups (per doc)

- Deep modules — schedule, tasks, files, messages, photos, daily logs, change orders, invoices, purchase orders — are **linked** (schedule→Project Manager, selections→Selections, warranty→Sales, messages→Communications) or **"Coming soon"** scaffolds under `[jobId]/[module]`.
- Price summary change-orders/invoices tables are empty until those tables exist (contract price drives totals).
- Not yet built: time-clock "clocked-in", client payment settings, QuickBooks/accounting sync, saved custom views, map clustering, insurance certificate upload / "request quote", per-job deep-linking of shared tools, geofencing enforcement.
- Geocoding is best-effort (Nominatim, ~1 req/s) — un-geocoded jobs show in the list, not the map.

## Verification
- `tsc --noEmit`, `eslint`, `next build` all pass; DB smoke-tested job-number generation + template skip.
- Drive: New Job (scratch + template), Promote an Opportunity, open Summary/Info/Price-Summary, load the Map with a geocoded address, print the Price Summary.
