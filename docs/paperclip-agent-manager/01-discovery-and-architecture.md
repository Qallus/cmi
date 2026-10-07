# Discovery and Architecture

Written 2026-10-07, against the CMI app as deployed. This is the Phase 1 deliverable
called for by §33 and §46 of `CMI-Paperclip-Hermes-Agent-Implementation-Plan.md`, and
it corrects several assumptions in that document that the code does not support.

Read this before writing any integration code.

---

## 1. The headline: most of the tool layer already exists

`CMI-Paperclip-Hermes-Agent-Implementation-Plan.md` §14 proposes a new
`/api/agent/{projects,tasks,pipeline,contacts,trade-partners,…}` route family, and §15
proposes ~20 narrow tools. **Almost all of that is already built**, generically, in
`lib/agent/`:

| File | What it is |
| --- | --- |
| `lib/agent/entities.ts` | Registry of **28 entities**. Each carries `table`, `idColumn`, `searchColumns`, `orderBy`, a per-field type/enum/required schema, `writeRoles`, `deleteRoles`, and optional `slugFrom` / `customIdPrefix`. |
| `lib/agent/registry.ts` | Executors — `listRecords`, `getRecord`, `createRecord`, `updateRecord`, `deleteRecord`, `sendMessage`, plus `canWrite` / `canDelete`. |
| `lib/agent/tools.ts` | `TOOL_DEFS` (OpenAI function format), `toolDefsFor(ctx)`, **`dispatchTool(name, args, ctx)`**, `executePending(action, ctx)`. |
| `lib/agent/job-context.ts` | `getJobOverview(identifier)` — resolves a job by uuid, job number or fuzzy name, then fans out 14 child queries. |
| `lib/agent/prompt.ts` | `buildSystemPrompt(ctx, currentJob?)`. |
| `lib/agent/training.ts` | `loadTrainingContext()` — injects `bolt_training_docs`. |

Existing tools: `list_entities`, `describe_entity`, `get_job_overview`, `list_records`,
`get_record`, `create_record`, `update_record`, `delete_record`, `send_message`, plus
the role- and flag-gated `get_projections_summary`.

**`dispatchTool(name, args, ctx)` is the single chokepoint.** Anything that wraps it —
including an MCP server — inherits role gating, field whitelisting and confirmation
staging for free. Writing a second, parallel tool layer would be the most expensive
mistake available here.

### Mapping the plan's proposed tools onto reality

| Proposed (§15) | Reality |
| --- | --- |
| `get_project` | Already built and better: `get_job_overview`. |
| `search_projects`, `search_contacts`, `search_pipeline` | Already built: `list_records(entity, { search })`. Tokenised — AND across words, OR across the entity's `searchColumns`. |
| `get_project_documents` | Covered by `get_job_overview`'s fan-out. |
| `get_trade_partner`, `get_trade_partner_compliance` | Data layer exists (`lib/companies/directory.ts` → `loadDirectory`, `loadComplianceWorklist`) but is **not** a registered entity. Needs a bespoke tool, not a plain entity — see §4 below. |
| `get_projection`, `generate_projection_analysis` | Partly built: `get_projections_summary`. |
| `create_internal_task` | **Ambiguous — needs a decision.** Four candidates: `deal_tasks`, `job_action_items` (client-facing), `report_action_items`, `dashboard_notes`. |
| `generate_project_health_report` | **No implementation.** Ingredients exist (`getJobStats`, `loadJobForecast`, `buildPriceSummary`, `jobScheduleHeader`) but nothing composes them. `lib/reporting/` is *meeting* reports, not project health. Net-new. |
| `get_takeoff`, `create_takeoff_draft`, `create_estimate_draft` | **Nothing to wrap.** See §2. |

---

## 2. Corrections to the implementation plan

### Take-Off is a scaffold, not a feature

`lib/take-off/access.ts` is four lines of flag and role exports. There is no `data.ts`,
no API route, no Supabase table. `components/take-off/take-off-module.tsx` mounts a
dependency-free vanilla-JS engine inside a ShadowRoot with demo data, and its own doc
comment reads: *"This delivery is session-only. Do not bind sample state to production
records."*

**Consequence:** the Forge agent, Workflows 2 and 3 (§40), and the three takeoff/estimate
tools have no foundation. Take-Off must become its own project before any of that is
buildable. Do not write skills that assume it exists.

### Paperclip already provides much of what §19–§23 proposes to build

Verified against the deployed instance and the fork's docs:

| Plan section | Already in Paperclip |
| --- | --- |
| §19 Approval model, §20 Approvals queue | Full lifecycle: `POST /api/companies/{id}/approvals`, `/approve`, `/reject`, `/request-revision`, `/resubmit`, plus comments and linked issues. |
| §21 AI activity / audit | `GET /api/companies/{id}/activity`. MCP gateway additionally writes a per-call event log. |
| §22 Paperclip tasks in CMI | Issues API — Paperclip's task primitive is an **issue**, with `checkout` / `release` claim semantics. |
| §5 Overview cards | `GET /api/companies/{id}/dashboard` returns agent counts by status, task counts by status, stale tasks, cost vs budget, and recent activity — the Overview screen in one call. |
| §18 Tool permissions | MCP access governance: catalog entries risk-classified `read` / `write` / `destructive`, per-agent **profiles** (what an agent can see) and **policies** (`allow`, `block`, `require_approval`, `rate_limit`, `trust_rule`). Deny beats allow. |
| §41 Budgets | Per-agent and per-company cost tracking and budget enforcement. |

The CMI dashboard should **render** these, not reimplement them.

### One constraint that dictates the integration shape

From `doc/MCP-ACCESS-GOVERNANCE.md`, *Known limitations*:

> **Endpoint mode (Paperclip as MCP server) is not policy-governed.** Tool access
> governance applies only to *gateway mode* — Paperclip's own MCP endpoint surface
> (`/mcp`) uses standard Paperclip auth and is not subject to the profile/policy stack.

**Therefore CMI must host the MCP server and Paperclip must connect to it as a
`remote_http` connection.** The reverse arrangement forfeits the entire approval,
risk-classification and audit stack. This is not a preference; it is the only
arrangement that satisfies the plan's own §18–§21.

### Hermes is one runtime with two consumers

`.env.local` already carries `HERMES_AGENT_URL` and `HERMES_AGENT_API_KEY` pointing at a
Nous Research `hermes-agent` gateway. Paperclip independently ships `hermes_local` and
`hermes_gateway` adapters for the same runtime. So Hermes is not "the CMI agent runtime"
as §1 of the plan implies — it is a shared runtime that both CMI and Paperclip can call.

CMI currently calls it from **three places with no shared client**:
`app/api/agent/chat/route.ts` (the only one using tools),
`lib/canvas/bolt.ts` (`callHermes`), and `app/api/meetings/[id]/summarize/route.ts`.

---

## 3. Security findings

### 3.0 Privilege escalation — FIXED 2026-10-07

This was live in production, not theoretical, and it was **not** an agent problem.

`app/api/auth/signin/route.ts` checked `status IN ('active','invited')` and never
checked `role_slug`. `requireAdmin` — present in **160 route files** — did the same.
But `staff_users` also holds clients, vendors and subcontractors, so an external party
with a row there and a usable credential satisfied both checks and would be treated as
staff by every route behind that guard. One such row existed and was retired.

Fixed in three parts:

| Change | File |
| --- | --- |
| The affected row retired (`status` → `disabled`) — closed it immediately, no deploy | `staff_users` |
| `STAFF_ROLES` / `isStaffRole()` — one allowlist, credential-free, edge-safe | `lib/auth/roles.ts` *(new)* |
| Role check at the door | `app/api/auth/signin/route.ts` |
| Role check in the shared guard; also now selects `display_name` | `lib/auth/require-admin.ts` |
| Role check for the ~20 pages that authenticate directly | `lib/auth/server-session.ts` |
| Regression tests pinning the allowlist | `lib/auth/roles.test.mjs` *(new)* |

Nobody real was affected: every `active` account is `super_admin` or `admin`.
`viewer` is deliberately **non**-staff — `DashboardNav` falls back to it for an
unresolved session, so it must not be a way in.

### 3.1 Still open

1. **Reads have no role gating whatsoever.** `listRecords` and `getRecord` take no
   context and run through the service-role client. Any caller past the route guard
   reads all 28 entities. Only Projections is read-restricted, via a bespoke tool.
2. **`get_job_overview` is a second, separate ungated read path** — and the more
   important one. It takes no `ctx`, never consults the entity registry, and returns
   `contract_price`, `internal_notes`, invoice amounts, `project_selections.client_price`
   and joined `staff_users` rows. `prompt.ts` instructs the model to call it **first**
   for any job question. Adding `readRoles` to the registry does not touch it.
3. **`/api/agent/execute` is replayable.** It accepts a client-supplied `PendingAction`
   and runs it. No server-side store, signature, nonce or expiry.
4. **`/dashboard/agent/page.tsx` has no server-side guard at all** — the whole file is
   a `metadata` export and a render. The nav role list is cosmetic; `middleware.ts` only
   checks that a session cookie exists.
5. A staged action in `bolt-modal.tsx` is **lost** — pending state is in-memory per
   component and the modal renders no confirm buttons. The pending-store work fixes this
   as a side effect.

### 3.2 Two traps when implementing the above

- **`getEntity()` resolves by key *or* plural *or* table** (`entities.ts:579`), so
  `"user"`, `"staff users"` and `"staff_users"` all reach the same entity. Any gating
  that compares the raw argument string against an allowlist is bypassable. Gate on the
  **resolved entity object**, inside the registry.
- **Feature flags fail closed, which makes a flagged security check fail *open*.**
  `loadFlags` returns `{}` on any error and `isFeatureEnabled` requires `=== true`. So
  `if (await isFeatureEnabled("x")) enforce()` silently stops enforcing during a DB
  blip. If an enforcement check must be flagged, invert it — name the flag
  `..._disabled` and write `if (!(await isFeatureEnabled("..._disabled"))) enforce()`.
  The `reporting` / `prequal` guards use the fail-closed direction correctly, because
  there "off" means "hidden", not "unenforced". Do not copy that shape for enforcement.

### 3.3 A wording correction

Milestone 1 should not be described as keeping the agent "read-only". `create_record`
and `update_record` already **execute inline**, gated only by `canWrite`; only `delete`
and `send` are staged for confirmation. Bolt has live write paths today. Milestone 1
adds none.

---

## 4. Traps to avoid when extending the registry

- **Registering a flagged domain as a plain entity bypasses its guard.** Because
  `listRecords` / `getRecord` skip role checks, adding `prequal_applications`,
  `interviews` or `meeting_reports` as ordinary entities would route around
  `requirePrequal` / `requireInterviews` / `requireReporting` entirely. Projections
  avoided this with a bespoke flag-and-role-gated tool; that is the pattern to copy.
- **Trade partner compliance is computed, not stored.** `loadDirectory` joins
  `company_documents` and `prequal_applications` and derives compliance state. A plain
  table entity over `companies` would silently lose it.
- **There are two unrelated schedule systems.** The registry's `project_item` points at
  `project_schedule_items` (the Project Manager board). The Schedules feature is
  `job_schedules` / `schedule_items`. An agent asked about "the schedule" today reads
  the wrong one.
- **`record_changes` attribution depends on `updated_by`.** The trigger reads the row's
  own `updated_by`, falling back to an `app.actor_id` GUC that nothing in the app ever
  sets. Any agent write must stamp `updated_by` or land with a null actor.

### Domains with mature data layers that are *not* registered

Deals (the whole Pipeline feature), Schedules, prequal applications, interviews,
companies / trade partners, cloud files and folders, meeting reports, `deal_tasks`.

---

## 5. Verified database state

Present: `record_changes`, `extension_access`, `integration_logs`.

**Absent** — defined in `supabase/production_extensions.sql`, which was never applied:
`hermes_agent_runs`, `hermes_agent_messages`, `hermes_agent_approvals`,
`webhook_events`, `email_logs`.

So the audit trail requires a real migration; there is no dormant table to simply wire up.

Feature flags, all currently **on** except where noted: `interviews`, `prequalification`,
`projections`, `reporting`, `take_off`, `project_canvas`; `project_canvas_public` is off.

Paperclip API, confirmed live: `/api/companies` → `403 "Board access required"`,
`/api/agents/me` → `401`. Board endpoints are cookie-session gated, so server-to-server
reads from CMI must authenticate as an **agent API key**, not a board session. Which
company-scoped endpoints an agent key may read is the first thing to establish empirically.

---

## 6. Decisions taken (2026-10-07)

| Question | Decision | Consequence |
| --- | --- | --- |
| Bolt vs Paperclip | **Two lanes, shared tools.** Bolt stays synchronous chat straight to Hermes. Paperclip agents run async. Both reach CMI through one MCP server wrapping `dispatchTool`. | No regression to a working feature; tools written once. |
| Approvals | **Paperclip owns agent approvals.** Tool calls policy-marked `require_approval` open Paperclip Action Requests. CMI renders the queue read-only and deep-links. | CMI keeps its in-chat confirm for interactive Bolt — a different case, where a human is already present. |
| Milestone 1 | **Harden first, then read-only visibility.** | No new write paths until §3 is closed. |
| Agent identity | **Per-agent grant row.** Bearer token → an agent row with an `enabled` flag and a mapped role, modelled on `lib/extension/require-extension-access.ts` + `extension_access`. | Per-agent revocation and role scoping. No shared secret. |

---

## 7. Target architecture

```text
CMI Dashboard  ──────────────┐
  AI Workforce (read-only)   │  server-side Paperclip client (agent API key)
                             ▼
                        Paperclip  ── orchestration, issues, approvals,
                             │        activity, skills, budgets
                             │
            gateway-mode MCP │ (remote_http, policy-governed)
                             ▼
              CMI MCP server  ──►  dispatchTool(name, args, ctx)
                                        │
                                   lib/agent/registry.ts
                                        │
                                   Supabase (service role)

Bolt chat ──► Hermes ──► dispatchTool(...)      [unchanged, synchronous]
Paperclip agents ──► Hermes                      [adapter: hermes_gateway]
```

Two consumers of one tool layer. One runtime (Hermes) called from two directions. CMI
remains fully operable with Paperclip offline — nothing in the business path depends on it.

---

## 8. Proposed file-change map

### Milestone 1 — hardening (no new capability)

Ordered by risk-closed-per-unit-of-change. Steps 1a–1c are **done**.

| # | Path | Change | Status |
| --- | --- | --- | --- |
| 1a | `staff_users` row | Retire the live `client` row | **done** |
| 1b | `lib/auth/roles.ts` *(new)*, `roles.test.mjs` *(new)* | `STAFF_ROLES` / `isStaffRole()` + tests | **done** |
| 1c | `app/api/auth/signin/route.ts`, `lib/auth/require-admin.ts`, `lib/auth/server-session.ts` | Enforce the allowlist app-wide | **done** |
| 2 | `lib/agent/access.ts`, `lib/agent/guard.ts` *(new)* | `BOLT_ROLES`, `canUseBolt`, `requireBolt(request)`. Mirrors `lib/reporting/guard.ts`. | |
| 3 | `app/api/agent/{chat,execute}/route.ts`, `app/dashboard/agent/page.tsx` | Use `requireBolt`; add the missing page guard (`notFound()`). Delete the dead `ADMIN_ROLES` and the unread `ctx.isAdmin`. | |
| 4 | `supabase/migrations/<date>_agent_pending_actions.sql` *(new)* | Pending store. `record_id` is **text**, not uuid — the `document` entity uses `DOC-` prefixed ids. 15-minute TTL. RLS on, no policies (service-role only), matching the house pattern. | |
| 5 | `lib/agent/tools.ts`, `app/api/agent/execute/route.ts`, `agent-client.tsx`, `bolt-modal.tsx` | Stage into the table; `executePending(pendingId, ctx)` claims atomically via a conditional `UPDATE … RETURNING` filtered on owner, `consumed_at IS NULL` and `expires_at`. Mark **then** execute. Hard cutover — reject the old `{ action }` shape. | |
| 6 | `supabase/migrations/<date>_agent_actions.sql` *(new)*, `lib/agent/audit.ts` *(new)* | **One** table, not the three in `production_extensions.sql`. `actor_kind` + nullable `actor_staff_id` + `actor_label`, because an external agent has no staff row and a bare null actor is ambiguous. Log from `dispatchTool` so the future MCP server inherits it. Fail-open. | |
| 7 | `lib/agent/{entities,registry,tools,prompt}.ts`, `job-context.ts` | Read gating — see below. Land it **after** step 6 so the denials are observable. | |

**On step 7, two things worth getting right.** Do not hand-write 28 `readRoles` arrays:
make the field optional with a sensible default and override only the sensitive handful
(`user`, `invoice`, `job`, `document`, `message`, `page_review_*`). And gate
`get_job_overview` explicitly with field-level stripping of `contract_price` /
`internal_notes` / invoice amounts for non-financial roles — a blanket read block on
`job` would make the most central entity unreadable to roles that legitimately need it.
Choose coarse entity gating *or* fine field gating per entity; do not half-do both.

`entityEnum` (`tools.ts:15`) is a module-level const baked into six tool JSON schemas,
so filtering it per-caller means turning `TOOL_DEFS` into a factory. Keep the
registry-level check regardless — a schema mistake should degrade to a clear error,
not a leak.

### Why `record_changes` cannot be the agent audit log

`record_id` is `uuid NOT NULL`, and the `document` entity uses `DOC-` prefixed text ids,
so those rows are structurally un-insertable. It is also trigger-driven, field-level,
and limited to 5 tables. It stays useful for before/after values on those tables; it is
not the agent trail.

### Milestone 2 — visibility (read-only)

| Path | Change |
| --- | --- |
| `lib/paperclip/{client,types}.ts` *(new)* | Server-side fetch wrapper. Bearer agent key, base URL, typed errors, graceful degradation. |
| `lib/paperclip/{agents,issues,approvals,activity,dashboard}.ts` *(new)* | Thin per-area readers. |
| `lib/ai-workforce/{access,guard}.ts` *(new)* | `AI_WORKFORCE_FLAG`, roles, `requireAiWorkforce`. |
| `app/dashboard/ai-workforce/**` *(new)* | Overview, Agents, Tasks, Approvals, Activity. Server pages, `getSessionStaff` → role → flag → `notFound()`. |
| `components/dashboard/nav.tsx` | One entry with `flag: "ai_workforce"`, beside the existing Bolt entry. |
| `supabase/<date>_ai_workforce.sql` *(new)* | Seed the flag **false**. |
| env | `PAPERCLIP_BASE_URL`, `PAPERCLIP_API_KEY`, `PAPERCLIP_COMPANY_ID`. Server-side only. |

### Milestone 3 — the MCP server and agent identity

| Path | Change |
| --- | --- |
| `supabase/<date>_ai_agents.sql` *(new)* | `ai_agents(id, name, paperclip_agent_id, token_hash, role_slug, enabled, …)`. |
| `lib/agent/service-context.ts` *(new)* | Build a `StaffContext` from an agent row — the current blocker, since `StaffContext` can only come from a cookie today. |
| `app/api/mcp/**` *(new)* | `remote_http` MCP surface wrapping `dispatchTool`. Reads only at first. |
| `supabase/<date>_agent_actions.sql` *(new)* | Action log with `actor_id uuid` **and** `actor_name text`, following `projection_activity` — external agents have no `staff_users` row. |

### Not in scope yet

Take-Off and estimating tools (no feature to wrap), specialist agents beyond Bolt,
any agent write path, outbound sending by an agent.

---

## 9. Verification

- **Hardening:** a `viewer` or `client` staff row must receive 403 from `/api/agent/chat`.
  A `designer` must not be able to `list_records("invoice", …)`. Replaying a consumed or
  expired pending id must fail. Existing Bolt chat for an `admin` must be unchanged —
  exercise the six starter prompts on `/dashboard/agent`.
- **Visibility:** with `PAPERCLIP_BASE_URL` unset or Paperclip stopped, every AI Workforce
  page must render a degraded state and the rest of the dashboard must be unaffected.
  Flag off → `notFound()` and no nav entry.
- **MCP:** register the connection in Paperclip, confirm every tool lands in the catalog
  **quarantined**, classify each as `read` / `write` / `destructive`, and prove a
  `require_approval` policy opens an Action Request before the call executes.

---

## 10. Open items

1. **`create_internal_task` needs a target.** Four candidate concepts; `deal_tasks` is
   the closest to a genuine internal task, and is what interviews already reuse for
   follow-ups. Confirm before writing the tool.
2. **Which Paperclip endpoints an agent API key can read.** Establish empirically once
   the company and agent exist; it determines whether the dashboard needs a board
   session instead.
3. **Skill descriptions are routing logic.** Paperclip requires only `name` and
   `description`, but the description is what an agent reads to decide whether to load
   the skill. The template in the implementation plan (§11) does not say this; skills
   written as marketing blurbs will not route.
4. **Domain inconsistency**, carried over from earlier work: 18 references to
   `my.constructedmatter.com` against 8 to bare `constructedmatter.com`. Worth settling
   before agents start generating links.
