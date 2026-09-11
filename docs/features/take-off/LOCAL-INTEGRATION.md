# Take-Off local integration

## Scope and changes

Installed the 11 new files from `apps/cmi-next/components/take-off/CMI-Take-Off-NextJS/CMI-Take-Off-NextJS/files/` at their matching repository paths. The extra package nesting was reconciled locally. The supplied package and its full FEATURE-PARITY, MIGRATION-SPEC and DATA-MODEL backlog remain intact.

- `app/dashboard/take-off/`: page, loading and error boundaries; inherits the existing dashboard layout.
- `components/take-off/`: module, engine/declaration, core, demo data, theme source and generated styles.
- `lib/take-off/access.ts`: exact allowed roles and `take_off` key.
- Existing `components/dashboard/nav.tsx`: added Ruler to the existing lucide import and one role/flag-aware Take-Off entry immediately after Pre-Con, before Jobs. This follows the request's specific navigation instruction; its opening “under Jobs” wording was ambiguous.
- `scripts/take-off-access.test.cjs`: isolated execution of the actual page guard with mocked external session/flag/Next contracts; no database access or application bypass.

No shared auth, layout, theme, TypeScript configuration, dependencies or lockfiles changed. No SQL executed, flags registered/enabled, production records created, commits pushed or deployment performed. Missing/disabled flags deny access by default; the connected database's current flag state was not queried.

The local app matches the package helper contracts: strict TypeScript with allowJs=false, getSessionStaff(), isFeatureEnabled(), and the existing role slugs. JavaScript engine internals remain outside strict TypeScript checking. Local preview warnings, sample rates/plans/jobs, quantity-only CSV fidelity, no automatic PDF renderer, and lifecycle cleanup remain intact.

## Verification actually run

| Check | Result |
| --- | --- |
| Package core and installer tests | 31 passed on Windows |
| Installer dry run, additive apply, post-install dry run | No conflicts; all 11 payload files byte-identical on recheck |
| `node --test scripts/take-off-access.test.cjs` | 16 passed: login redirect; four allowed roles with enabled, disabled and missing flags; seven other current roles plus unknown/empty/null/undefined denied |
| `node --check apps/cmi-next/components/take-off/engine.js` | Passed |
| App `npm run typecheck` | Passed after installation. Before installation, the nested supplied package had two unresolved destination imports; installing the payload resolved them |
| App `npm run lint` | Failed before and after integration: ESLint 9.39.4 cannot find plugin `react` for `react/no-unescaped-entities`; configuration left unchanged |
| App `npm run build` | Passed, Next.js 16.2.6; Take-Off listed as a dynamic route. Existing middleware deprecation warning. Build skips type validation, so the independent typecheck above was run |
| Built app HTTP check on temporary loopback port 3105 | Logged-out GET `/dashboard/take-off` returned 307 with `/login?redirectTo=%2Fdashboard%2Ftake-off`; temporary server stopped |
| `git diff --check` | Passed |

App script logs are retained at repository root as `.take-off-typecheck.log`, `.take-off-lint.log`, `.take-off-build.log`, and baseline typecheck/lint logs.

Attempted to open `preview/index.html` through the browser tool, which reported no browser available. Read the preview source instead. The package's historical 38 Chromium checks were not rerun and are not integration evidence.

Still unverified: authenticated HTTP behavior against real sessions for every role/flag combination; collapsed sidebar and hamburger interactions; light/dark changes and focus preservation; drawing, local CSV selection/import/export; route leave/reentry listener behavior; responsive widths in the real layout; all existing navigation destinations; deployed CSP. Source inspection confirms shared navigation reuse and explicit listener/observer teardown, but is not a substitute for those runtime checks. No verified isolated staging database or authenticated browser was available.

## Staging enablement proposal — not executed

1. Verify that the staging application and its database are separate from production. Obtain approval before any live/shared database flag registration.
2. Review the existing schema from `supabase/2026-07-17_project_canvas.sql`: `feature_flags` has key text primary key, enabled boolean default false, description text, updated_at timestamptz; RLS enabled. No new table is needed. Verify that schema in the actual target environment.
3. Review the package's `integration/feature-flag.sql`: insert only `take_off`, disabled, using `ON CONFLICT (key) DO NOTHING`. It is review-only and remains outside automatic migrations. Existing admin management updates existing rows; it does not register them.
4. After approved registration, an admin/super_admin can toggle the flag at `/dashboard/settings/features`, backed by PATCH `/api/dashboard/feature-flags`. The server clears its process cache; allow up to 30 seconds for other processes, and reload the dashboard because navigation fetches flags on mount.
5. Complete the runtime matrix above in staging, then disable again until rollout is explicitly approved. Do not remove the route guard to display the preview.

## Next bounded production work

First complete staging verification and resolve the pre-existing lint configuration in a separately scoped change. Before production persistence, map take-off resources to canonical CMI jobs/projects and quotes. Inspected services include `lib/jobs/data.ts`, `lib/project-manager/data.ts`, `lib/quotes/data.ts`, and `lib/job-documents/data.ts`; the latter currently links documents by project name, so a durable ID relationship requires explicit design. Reuse existing vendors, selections, procurement, billing and document systems rather than create duplicates.

Retain the complete supplied backlog: private original document storage; durable operations; per-object authorization; audited scale/revision changes; authoritative validated calculations; real import fixtures and independent reconciliation; idempotent handoffs. No ConstructConnect account migration or native editable geometry recovery has been performed or certified.
