# Adaptive (financials) → CMI MCP + Bolt, read-only

## Context

CMI keeps job financials in **Adaptive.build**, which syncs with QuickBooks. Adaptive has no MCP server, but it does
have a documented REST API at https://oauth-docs.adaptive.build. Jeremy wants Claude, through the CMI connector, and Bolt
to answer questions such as *"Review all active projects, find budget overruns, compare actual spend to budget, and
summarize."*

Rules:
- **Read-only** for now. Any financial update needs explicit approval and belongs to a later phase.
- **Admins only:** super_admin and admin, the same roles as Projections (`PROJECTION_ROLES` in
  `lib/projections/access.ts`).
- **Credentials:** Jeremy is requesting them from Adaptive. Build and unit-test against the documented API now, and
  switch it on when the key arrives.

### What the Adaptive API gives us (from the docs)

- All paths are under `/api/external/`. Lists are paginated with `limit`/`offset` and return
  `{count, next, previous, results}`. Date filters look like `{field}_after` / `{field}_before`.
- **Jobs are "customers":** `GET customers/` returns `id, fully_qualified_name, realm_id, active, addresses`.
- **Budget:** `GET customers/{id}/budget-lines/`. `builder_amount` is the cost budget and `owners_amount` is the revenue
  budget.
- **Actuals:** `GET wip/?realm=`. `calculated_spent` is cost to date, and `calculated_cost_to_complete` is the revised
  cost budget minus spent. So the revised budget is spent + cost to complete.
- **Change orders:** `GET customers/{id}/change-orders/`. EXTERNAL change orders affect cost and revenue; INTERNAL ones
  affect cost only.
- **Other reads:** `bills/` and `expenses/` (realm required), `purchase-orders/`, `vendors/`, `items/` (cost codes) and
  `realms/`.
- **Auth:** read scopes such as `read:wip`, `read:budget_lines`, `read:bills`, or an API key. The docs give **no base
  URL, no API-key header format and no OAuth URLs**, so those must come from Adaptive.
- **Writes exist** (budget lines, change orders, POs, context entries). We won't call any of them in this build.

## Step 0: Credentials request for Jeremy (docs only)

Write `docs/ai-os/adaptive-api-setup.md` with a short message for Jeremy to send to Adaptive support. It asks for:
- the API base URL
- a **read-only** API key, or an OAuth client limited to the `read:*` scopes, and its header format
- the realm ID for Constructed Matter
- rate limits

The doc also lists the Coolify env vars to set (runtime-only): `ADAPTIVE_API_BASE_URL`, `ADAPTIVE_API_KEY`,
`ADAPTIVE_AUTH_HEADER` (default `Authorization: Bearer`; a `Api-Key` / `X-API-Key` form is configurable) and
`ADAPTIVE_REALM_ID`.

## Phase A: Adaptive read client + analysis (inert until env is set)

**`lib/adaptive/client.ts`** (server-only). Follows the `lib/paperclip/client.ts` pattern:
- It never throws. Missing env returns `{ reason: "unconfigured", missing: [...] }`.
- It has an 8–15 s timeout and returns errors as values.
- **Only GET exists.** There is no method parameter, so writing is impossible by construction.
- A `getAll(path, params)` helper follows `next` up to a page cap.
- An in-memory cache keeps each URL for 5 minutes, to stay polite to an unknown rate limit.
- Read-only is also enforced on Adaptive's side, by requesting a read-only key or `read:*` scopes.

**`lib/adaptive/data.ts`** has typed fetchers:
- `listJobs({active})`
- `wip()`
- `budgetLines(customerId)`
- `changeOrders(customerId)`
- `bills` / `expenses` / `purchaseOrders({customer?, after?, before?})`
- `vendors(search)`
- `items()`

**`lib/adaptive/analysis.ts`** is pure, with no I/O or aliases, so it can be tested:
- **Per job:** original cost budget (Σ budget-line `builder_amount`), revenue budget (Σ `owners_amount`), spent and
  cost-to-complete (WIP), and revised budget (spent + CTC).
- **Derived figures:** change-order delta (revised − original), % spent, and margin from revenue minus revised cost.
- **Overrun flags:** spent > revised budget (over), CTC < 0, revised > original by more than a threshold (budget creep),
  and % spent ≥ 90% (watch).
- **Sorting:** `summarizePortfolio(rows)` sorts by overrun dollars and totals the portfolio.

**Matching Adaptive jobs to CMI jobs:**
- The order is `jobs.accounting_customer_id` (the same key Projections' CSV import uses, `lib/projections/data.ts`),
  then job number inside `fully_qualified_name`, then normalized name.
- Unmatched Adaptive jobs are still reported, labeled "not linked to a CMI job".
- A small **Link** action in Job Info sets `accounting_customer_id`. The field already exists in `lib/jobs/types.ts`.

**Tests:** `lib/adaptive/analysis.test.mjs` covers the budget/WIP math, overrun flags, sorting and name matching, using
fixture JSON shaped like the docs.

## Phase B: Expose it to Claude (MCP) and Bolt, admins only

**Gate:** `canUseProjections(role)` (super_admin, admin) **and** feature flag `adaptive` (default off) **and** the
client is configured. Tools are hidden from `tools/list` otherwise, and the check runs again on every call.

**MCP tools** go in a new `lib/mcp/adaptive-tools.ts`, merged into `MCP_TOOLS`. All are read-only and audited like the
others:

| Tool | Returns |
| --- | --- |
| `adaptive_financial_summary` | Every active job: budget, revised, spent, CTC, % spent, CO delta, margin and flags. Portfolio totals. Overruns first. This answers the example question in one call. |
| `adaptive_job_financials(job)` | One job, by CMI job id/number/name or Adaptive id: budget lines by cost code, change orders, WIP, and recent bills/expenses. |
| `adaptive_list_transactions(job?, type=bills\|expenses\|purchase_orders, after?, before?)` | Paged list with vendor, date, amount and cost code. |
| `adaptive_list_vendors(search?)` | Vendor directory. |

- Rows carry the CMI `job_number` and a dashboard link when matched.
- The server instructions get one line: figures come from Adaptive; never estimate; say when a job isn't linked.

**Bolt:** add the same two main tools (`adaptive_financial_summary`, `adaptive_job_financials`) to `toolDefsFor(ctx)` /
`dispatchTool` in `lib/agent/tools.ts`, gated exactly like `get_projections_summary`. Both surfaces share
`lib/adaptive/*`, so the numbers always match.

**Dashboard:**
- Settings → Credentials gets an **Adaptive** card (env set or missing).
- Settings → Features gets the `adaptive` flag row.
- `lib/agent/dashboard-guide.ts` gets a line on asking Claude or Bolt for job financials.
- No new Adaptive page yet; Claude and Bolt are the interface.

**Not in this build:** money redaction changes. Non-admins never see these tools at all, so the existing
`redactFinancial` path is irrelevant for them.

## Phase C (later, separate approval): writes with explicit approval

- These would be proposals only. Claude or Bolt calls `adaptive_propose_change` (budget line, change order or PO), which
  creates a row in a new `adaptive_change_requests` table. It reuses the confirm-then-execute idea from Bolt's
  `PendingAction`, but makes it durable and auditable.
- A Super Admin reviews it in the dashboard (diff, Approve / Reject). Only on Approve does the server call Adaptive with a
  separate write-scoped credential (`ADAPTIVE_WRITE_API_KEY`), and it logs the result.
- Nothing in Phases A/B can write.
- A possible follow-on: feed Adaptive billing into Projections as an `external` actuals source.

## Critical files

- **New:** `lib/adaptive/{client,data,analysis}.ts`, `lib/adaptive/analysis.test.mjs`, `lib/mcp/adaptive-tools.ts`,
  `docs/ai-os/adaptive-api-setup.md`, and a small migration that inserts the `adaptive` feature flag (off).
- **Modified:** `lib/mcp/tools.ts` (merge the tool list), `lib/mcp/server.ts` (instructions line), `lib/agent/tools.ts`
  (two gated Bolt tools), `app/dashboard/settings/page.tsx` (Credentials card), `.env.example`,
  `lib/agent/dashboard-guide.ts`, and possibly the Job Info Link control
  (`app/dashboard/jobs/[jobId]/info/job-info-client.tsx`).
- **Reused:**
  - `lib/projections/access.ts` (`canUseProjections`) and `lib/flags.ts` (`isFeatureEnabled`)
  - `lib/paperclip/client.ts` (the result-value client pattern)
  - `lib/mcp/{auth,audit,policy}.ts`
  - Bolt's `dispatchTool` and `toolDefsFor`
  - `lib/agent/job-context.ts` (resolve a job by id/number/name)

## Verification

- `npm run typecheck`, `lint` and `test`. The analysis tests cover the overrun math and job matching.
- **Without credentials:**
  - With the env unset, the tools don't appear for admins.
  - With a fake base URL, a stub local server returns doc-shaped JSON. `adaptive_financial_summary` then returns
    correct overruns and totals.
  - A PM's token gets neither the tool listing nor the call (403 text). Every call is audited.
- **With real credentials:**
  - Jeremy sets the env and turns on the `adaptive` flag.
  - In Claude, as an admin, ask the example question. Spot-check two jobs against Adaptive's WIP page.
  - Confirm the `mcp_audit_log` rows.
- Commit and push to `master` after each phase, only when Jeremy approves.
