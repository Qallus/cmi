# Trade Partner Portal: Build Plan

_Approved by Jeremy 2026-10-28. Response to Brandon: `CMI_Trade_Partner_Portal_Response.md`._

## Context

- **The brief:** `docs/trade-partners/CMI_Trade_Partner_Portal_Requirements_AI_Prompt.md` (the .docx has the same
  content). The website becomes the front door for subs: they apply, upload documents and sign the MSA in one place.
  The system then files to the V drive (Google Shared Drive) with the right names, AI reads COIs, reminders go out, and
  any PO to a sub who isn't compliant is flagged. Today Yovana does this by hand in Adaptive and in our folders.
- **The response to Brandon:** `docs/trade-partners/CMI_Trade_Partner_Portal_Response.md` (already written). It holds
  the answers to Section 13 and the agreed phasing.

**Existing feature** (behind flag `prequalification`, which is on):
- **Form:** `lib/prequal/form.ts` holds the form as data, a `Section[]` with `mapsTo` → `companies` columns. The
  public client is `app/prequalification/application-client.tsx`.
- **API:**
  - `api/prequal/start`, `[token]` (autosave PATCH), `[token]/upload` (Supabase bucket `prequal-documents`) and
    `[token]/submit`
  - submit runs `lib/prequal/data.ts#submitApplication`, which creates the company, contact and `company_documents`
- **Dashboard:** `app/dashboard/trade-partners/*` has the Applications, Directory, Interviews and Compliance tabs.
  `application-drawer.tsx` holds the status, Approve/Decline and document Verify/Reject.
  `lib/prequal/review.ts` handles gaps, decisions, verification and the signed URL.
- **Reminders:** `lib/automations/runner.ts#scanDocumentExpiries` runs at 30/7/0 days with dedupe through
  `automation_events`. It is gated by `AUTOMATION_ENABLED`, which is false.
- **Interviews** reuse the same form engine (`isVisible`, `progressOf`, `missingRequired`, `answersToCompany`,
  `relevantDocuments` all take `sections`). **Keep that contract.**

**Live data:**
- 349 companies. 340 are backfilled `prospect`s from `contacts.company`, 330 of those from Lead contacts.
- 9 applicants, 10 submitted and 62 draft applications, 37 documents.
- About 32 fuzzy duplicate pairs.
- The table DDL isn't in the repo; it's in Supabase's migration history. Read the live schema before altering.

**Not built:** the contact path selector, spam filtering, the confirmation email, the MSA and e-signature, "Other"
free-text fields, cost codes, export, AI parsing, V drive filing, drafts, requalification and POs.

## Phase 1: Front door (build now; stop for approval at the end)

### 1.1 Contact page paths, spam and classification
- **`app/contact/page.tsx`:**
  - a **path selector** before the fields: *Trade partner* → link or route to `/become-a-trade-partner`; *Client
    (new home / remodel)* → the existing lead form; *Product or service to present* → a short pitch form
  - an **"Interested in working with us"** button at the top that goes straight to the trade partner path
  - the address, phone and email stay as they are
- **`app/api/contact/route.ts`** takes a `path`:
  - client → today's behavior (contact `type: "Lead"`)
  - vendor pitch → contact `type: "Vendor"`, tag `vendor-pitch`, `contact_submissions.kind = 'vendor_pitch'`, not a lead
  - trade partner → the prequalification path
- **Spam:**
  - **Cloudflare Turnstile** on the contact and prequal start/submit (`TURNSTILE_SITE_KEY` as a build var since it's
    public; `TURNSTILE_SECRET_KEY` runtime), verified server-side in `lib/spam/turnstile.ts`
  - a **honeypot** field and a minimum time-to-submit
  - rejected submissions are logged with `kind='spam'`, not dropped silently, so they can be reviewed
- **New public page** `app/become-a-trade-partner/page.tsx`: a 1–2 page overview (content from the Onboarding Guide, a
  PDF link), then **Apply** → `/prequalification`. It's styled like `/contact`.

### 1.2 Form changes (`lib/prequal/form.ts`, data only)
Follow spec Section 5 field by field:
- **Company:**
  - `partner_type`, `business_structure` and `years_in_business` become selects (`years_in_business_range`)
  - each "Other" gets a `showIf` free-text follow-up: `partner_type_other`, `business_structure_other`, `trades_other`
- **Contacts:**
  - five groups: Primary (required), Accounting, Estimating/Bid (renamed from Estimator), Field, After-hours emergency
  - each secondary group has a **Same as primary** yes/no that hides the group and copies the primary on submit
- **Trades:** an expanded `TRADES` list, each with a cost code from a new table (below). The cost code is hidden from
  the sub.
- **Spelling and Mobilization:** switch to American spelling throughout ("Specialized", "Mobilization", "license",
  "authorized"). Fix the labels; keep the existing keys to stay compatible, e.g. `mobilisation_notice` keeps its key.
- **Capacity:**
  - `currently_available` (yes/no) → `available_from` (date) and `capacity_notes`
  - crew size and capacity become range selects
  - **remove** `accelerated_schedules`
- **Estimating:**
  - **remove** `pricing_methods`
  - add `estimates_without_plans`
  - keep `estimates_from_plans`, `requires_site_walk` and the optional `payment_terms`
- **Equipment:** **remove** the section.
- **Licensing & Insurance:**
  - `bonding_capacity` moves here
  - a yes/no per coverage line, "Do you carry at least [minimum]?", with minimums from `lib/prequal/minimums.ts`
    (values supplied by Brandon)
  - a W-9 and COI notice
  - uploads: W-9, COI(s) and ROC license
  - **The COI isn't required to submit.** It becomes a red flag after approval.
- **Experience & References:** **removed**. Portfolio becomes a link *or* optional uploads.
- **Confirm & submit:** the MSA step (1.3) replaces the attestation.
- **Compatibility:**
  - Removed keys stay readable for old drafts and submitted applications. Mark them `retired: true` so review still
    shows the old answers, but they aren't rendered or required.
  - Interview templates that reference retired keys keep working.

### 1.3 MSA view and e-signature (new)
- **Tables** (migration `2026-10-xx_trade_partner_phase1.sql`):
  - `msa_versions`: id, label (e.g. "Rev 2026"), storage_path, sha256, effective_at, is_current, uploaded_by
  - `msa_signatures`:
    - which MSA: id, company_id, application_id, msa_version_id
    - who signed: signer_name, signer_title, signer_email, email_verified_at, consent_text, signature_png (path)
    - evidence: ip, user_agent, signed_at, doc_sha256
    - output: signed_pdf_path
    - countersign: countersigned_by, countersigned_at
- **Admin:** Trade Partners gets an **MSA** tab to upload a new version and set it current (super_admin/admin).
- **Applicant step:**
  1. They view or download the current MSA (signed URL).
  2. They tick the e-sign consent.
  3. They type a name and title and draw a signature. The drawing is a small canvas component,
     `components/ui/signature-pad.tsx`.
  4. They get an **emailed 6-digit code** (Resend) and enter it.
  5. On submit, the server records the IP, user agent and timestamp, then builds the **signed PDF**: the original MSA
     plus a signature certificate page, assembled with `pdf-lib` (a new dependency).
- **Storage:**
  - The signed PDF goes to the `prequal-documents` bucket and becomes a `company_documents` row with `doc_type 'msa'`.
  - It's emailed to the signer and info@.
  - V drive filing comes in Phase 2.
- **Countersign:** a button on the application drawer adds the countersignature block and regenerates the PDF.

### 1.4 Confirmation email
- On submit, a branded email goes from info@ (`fromAddress()`, through the shell in `lib/email/notification-email.ts`
  or `brand.ts`) with a summary, the missing-document list and a link to continue or upload.
- A staff notification goes out through `notifyStaff()`.
- No consent gate is needed, because it's transactional and the person asked for it.

### 1.5 Cost codes and directory cleanup
- **`trade_cost_codes`** (trade text PK, cost_code, label, active), seeded from the list Yovana/Brandon provide.
  `lib/prequal/trades.ts` resolves a cost code for reports.
- **Directory filter** (`lib/companies/directory.ts`): show only companies with `partner_type` set, or
  `qualification_status` ≠ prospect, or an application. A **"Show hidden"** toggle reveals the backfilled companies.
- **Duplicate finder and merge** (super_admin/admin):
  - `pg_trgm` similarity ≥ 0.6, plus a normalized-slug match, produces candidate pairs on a **Duplicates** view
  - **Merge** moves the contacts, documents, applications and interviews to the survivor, fills the survivor's empty
    fields from the duplicate, and archives the duplicate with a log in `record_changes`
  - Yovana reviews the list first

### 1.6 Bolt and docs
- `lib/agent/dashboard-guide.ts` gets entries for the contact paths, Become a Trade Partner, the MSA tab and Duplicates.
- Add the `docs/trade-partners/` build plan.

### Phase 1 files
- **New:**
  - `app/become-a-trade-partner/page.tsx`
  - `components/ui/signature-pad.tsx`
  - `lib/prequal/{msa,minimums,trades}.ts` and `lib/spam/turnstile.ts`
  - `app/api/prequal/[token]/msa/{code,sign}/route.ts` and `app/api/trade-partners/msa/route.ts`
  - `app/api/companies/duplicates/route.ts` and `.../merge/route.ts`
  - the MSA tab and Duplicates view components
  - the migration
- **Modified:**
  - `lib/prequal/form.ts`, `app/prequalification/application-client.tsx` (the contact groups UI and the MSA step) and
    `lib/prequal/data.ts` (submit: contacts by role, MSA, email)
  - `app/contact/*` and `app/api/contact/route.ts`
  - `app/dashboard/trade-partners/*` and `lib/companies/directory.ts`
  - `.env.example` and `dashboard-guide.ts`
- **Migration:**
  - `contacts.company_roles text[]`
  - `contact_submissions.kind`
  - new `companies` columns: `partner_type_other`, `business_structure_other`, `years_in_business_range`,
    `available_from`, `capacity_notes`, `estimates_without_plans` and the `meets_*_minimum` booleans
  - `msa_versions`, `msa_signatures` and `trade_cost_codes`
  - the `pg_trgm` extension
  - RLS is server-only on every new table

### Phase 1 verification
- **Unit tests:** form visibility for the new `showIf` and Same-as-primary rules, `missingRequired` with the COI
  optional, the trade → cost code lookup, duplicate-pair scoring, and the merge plan (a pure function).
- **Locally:**
  - each of the three contact paths lands in the right place, with no Lead created for vendor pitches
  - Turnstile and the honeypot block a scripted post
  - a full application with the MSA: emailed code, drawn signature, signed PDF with a certificate page holding the
    hash, IP and time
  - the confirmation email is held outside production; check the queued payload
  - countersign regenerates the PDF
  - an old draft still opens and its retired answers show in review
  - the directory shows only real partners; a merge on two test companies is correct
- Typecheck, lint and test. Then commit and push to `master` when Jeremy approves.

## Phase 2: Review and filing (outline)

- **Review buttons:** the drawer gets **Approve as Trade Partner** (emails the Onboarding Guide; the W-9 and COI become
  mandatory red flags), **Decline** (reason required → Archive), **Schedule Follow-Up Meeting** and **Follow Up (missing
  documents)**.
- **Drafts:** the last two open an editable draft built from the gaps list. It sends from info@ with reply-to set to the
  reviewer. It's never auto-sent.
- **Statuses:** an "Under Review" status. A runner scan auto-archives drafts and incomplete applications after 90 days
  without activity; they can be reactivated.
- **Manual upload:** office staff upload a document for a sub on their company record. It goes through the same
  pipeline.
- **Excel export:** an `.xlsx` with company, cost codes, business structure (1099), contacts by role, and document
  status with expirations.
- **V drive filing** (when the Google key exists, using `drive` scope domain-wide delegation): `lib/vdrive/file.ts`
  copies each document to the Shared Drive with the naming and folders from spec 7.1, keyed by `company_documents`
  (`drive_file_id`). Folder paths are configurable in Settings.

## Phase 3: AI and reminders (outline)

- **Claude parsing** of each COI and W-9 (`ANTHROPIC_API_KEY`, `lib/prequal/parse-coi.ts`, PDF and image input with a
  structured JSON output):
  - coverage lines with limits, carrier, policy number and effective/expiration dates
  - fills `company_documents` (one row per coverage line, or a `coverages` jsonb)
  - compares against `minimums.ts` and flags any shortfall
  - re-runs the filename for the V drive
- **Master tracking sheet:** a live Google Sheet, written with the `spreadsheets` scope, updated on each upload.
- **Reminders:** the runner moves to 45 days, then weekly, then 7 days (urgent wording, CC Yovana), then stops after
  expiry with an internal flag. Each notice includes the requalification link.
- **Red flags** on the directory and the company record.
- **Requalification:** a pre-filled short form with expired documents highlighted. Office staff select all or pick
  specific subs, exclude some, and send with an optional mass message or updated MSA for signature.

## Phase 4: POs and Adaptive (outline)

- **`lib/compliance/check.ts#isCompliant(companyId)`** checks approved status, W-9 and COI on file and not expired, and
  the MSA signed. It's called by Brandon's PO generation, and runs as a nightly read of Adaptive POs and bills (Adaptive
  plan, Part 2 below) that flags violations through `notifyStaff`.
- **Adaptive linking:** each company gets an `adaptive_vendor_id`, with name matching and a review step.
- Anything else the Adaptive rep confirms can sync.

## Blockers and inputs

- **From Brandon:** the MSA PDF and countersigner, the insurance minimums, and the Onboarding Guide.
- **From Yovana/Brandon:** the trade list with cost codes, the V drive folder paths, and a review of the duplicate merge
  list.
- **From the attorney:** e-sign consent wording.
- **Keys:** Turnstile keys (Jeremy creates a free Cloudflare widget), the Google key and scopes (Phase 2), and
  `ANTHROPIC_API_KEY` (Phase 3).
- **Adaptive:** answers from the call (Phase 4).
