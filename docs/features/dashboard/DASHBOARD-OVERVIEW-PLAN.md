# Customizable Dashboard Overview

## Status (2026-11-25)
- Migration `2026-11-25_dashboard_v2.sql` applied. Flag `dashboard_v2` is **off**; turn it on in Settings → Features.
- Built: layout model + per-person saving, Standard/Blank chooser + Blank focus bundles, Customize (drag sections and cards, size, hide, remove), Add card, All features slide-out (catalog in lib/features/catalog.ts), the default rows (search, All features, date/time, animated weather, notifications, My Tasks, stats, What's new, company overview), CMI cards and charts, tools (dialpad, recorder, notepad, to-do with reminders, Ask Bolt, quick links, admin shortcuts), Settings → Dashboard (company default, What's New), Claude tools (cmi_whats_new_draft, cmi_dashboard_cards, cmi_dashboard_add_card), Bolt guide.
- Not built yet: multiple named views per person (tabs).
- Tested in a production build with Playwright (desktop and phone). My Tasks with real tasks was not visually checked (no tasks due for the test account).


## Context
Jeremy wants CMI's **Dashboard Overview** (`/dashboard/overview`) to become a per-person dashboard:
- Every card and section can be dragged into place, resized or hidden.
- An **Add Card** slide-out offers a large widget library.
- New users start from **Standard** (today's Overview plus the new default rows) or **Blank** with a Get Started wizard.
- An **All Features** slide-out lists every CMI feature, links to each one, and includes the integrations such as the Claude (MCP) connector.

He pointed to **Echo** (`github.com/Qallus/echo`, public, same Next 16 / React 19 stack), which already ships this:

| Echo file | What it is |
| --- | --- |
| `src/components/dashboard/dashboard.tsx` | `@dnd-kit` drag and drop, Customize mode, autosave |
| `section-view.tsx`, `slide-row.tsx`, `card-shell.tsx`, `kit.tsx` | Rows that slide sideways or grids; card chrome with resize, hide, remove |
| `add-card.tsx` | The Add card panel |
| `start-chooser.tsx` | Choose Standard or Blank |
| `cards/{index,stats,charts,lists,schedule,tools,info,weather}.tsx` | About 40 card types: stats, dialpad, recorder, notepad, mini calendar, weather, What's new, charts (recharts) |
| `src/lib/dashboard/{layout,cards,data,actions}.ts` | Layout model `{ v, template, sections[{ id, title, style: row \| grid, hidden, collapsed, cards[{ id, type, size xs–xl, hidden, settings }] }] }`, the `STANDARD` and `BLANK` presets, `normalize()` |
| `src/lib/features.ts` + `src/components/shell/feature-menu.tsx` + `src/components/ui/responsive-panel.tsx` | **All features**: side sheet on desktop, bottom sheet on phones, expandable, search box, grouped two-column cards (icon, title, one-line "what"), each linking to its page |
| `supabase/migrations/20261125130000_user_dashboards.sql` | Per-person layout table |

**CMI today:**
- `app/dashboard/overview/{page,overview-client}.tsx` shows the header ("Overview" plus a subtitle to remove), 12 count cards, Recent Activity, Revenue Outlook (admins), Quick Actions and Upcoming.
- There is no layout storage, no drag-and-drop library and no chart library.

**Decisions (from Jeremy):**
- **My Tasks:** one swipeable row with 3½ cards visible and a hide icon. Each card is one of *your* due tasks (`buildBriefing` from `lib/briefing/build.ts`).
- **Layout storage:** per person in the database. A Super Admin sets the company default: Standard or Blank.
- **What's new:** admin-written entries, which Bolt or Claude can draft. Each person can view or hide them.
- **Calls:** company-wide call stats; the dialpad is opt-in on desktop only, and it shares the office line.

Everything is behind the feature flag **`dashboard_v2`**, which stays off until approved. While it's off, today's Overview is unchanged. The spec goes in `docs/features/dashboard/DASHBOARD-OVERVIEW-PLAN.md` first.

## Approach: port Echo's dashboard, then make it CMI's

### 1. Port the framework
Copy Echo's dashboard files into `components/dashboard/home/*`, `lib/dashboard/*` and `components/ui/responsive-panel.tsx`, then adapt them:

**Saving**
- Echo's server action `saveDashboard` becomes `PUT /api/dashboard/layout`, guarded by `requireAdmin`.
- Saving is per person and debounced, with Echo's localStorage fallback.

**Dependencies:** add `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` and `recharts`, at the same versions as Echo.

**UI pieces**
- Use CMI's `Button`, `Card`, Radix dropdown and dialog, `SidePanel` and `Drawer`, styled with CMI brand tokens (accent `#9e6f2e`).
- If Echo's components rely on a shadcn file CMI lacks (`sheet`, `dropdown-menu`), add the matching shadcn file under `components/ui/`.

**Header**
- "Overview" with the subtitle removed. A time-of-day greeting ("Good afternoon, Jeremy") replaces it.
- **Add card**, **Customize** and a ⋯ menu with Reset to Standard, Reset to Blank, and Show hidden.

**Section behaviour** (as in Echo)
- Each section has a collapse chevron and a hide (eye) icon.
- **Slider** rows are single horizontal lines that swipe or scroll. Every stat row and My Tasks use this ("each row of stats is a single row").
- Drag, resize, hide and remove work in Customize, with touch, mouse and keyboard support.

### 2. All Features slide-out (`lib/features/catalog.ts` + `components/dashboard/feature-menu.tsx`)
- **One catalog** feeds the slide-out, the Add Card "Quick links" card, and Bolt (`dashboard-guide.ts` keeps its steps; the catalog links to it).
- **Each entry:** `{ group, title, href, icon, what, keywords, roles?, flag?, external? }`.
- **Filtering:** by the person's role and flags, with the same rules as `NAV_ITEMS`, so nobody sees a page they can't open.
- **Panel:**
  - Search box.
  - Groups in sidebar order, two-column cards (icon, title, one-line description), each linking to its feature.
  - An expand button for full width.
  - A bottom sheet on phones.
- **Groups and contents:**

| Group | Contents |
| --- | --- |
| **Start** | Overview, Today, Search (Ctrl+K), Ask Bolt (AI Agents) |
| **CRM** | Contacts, Leads, Prospects, Clients, Trade Partners (application, MSA, COI), Interviews, Pipeline, Pre-Con |
| **Jobs** | Jobs, Jobs Map, Templates, Schedules (schedule engine, inspections), Selections and Live Selection Builder, Daily Logs / Field Reports, Punch Lists, Client Engagement, Project Canvas and Canvas Briefs, Take-Off, Commitments |
| **Money** | Projections, Billing / Invoices, Executive Summaries |
| **Reporting** | Weekly Reports, Analytics |
| **Communication** | Communications (email, SMS, calls, dialer), Direct Messages, Notifications and Broadcasts, Messaging Consent, Prints, Email Templates, Recording Studio |
| **Schedule** | Bookings, Events (invitations), Calendar |
| **Files and docs** | Cloud, Workspace (documents) |
| **Marketing and site** | Business Cards, Site Content, Portfolio, Blog, Team, public website pages (Home, Contact, Become a Trade Partner, booking page) |
| **AI and integrations** | Claude connector (MCP: what it can do, how to connect, Settings → Claude access), Bolt, Paperclip agents, Chrome Selection extension, Google Workspace, Plaud, Twilio and Resend status |
| **Client portal** | What clients see; links to the portal pages, shown to staff |
| **Account** | My Profile, User Management, Settings, Feature flags, Nav visibility |

- **External** items (the Claude connector setup page, the Chrome Web Store) open in a new tab.

### 3. CMI cards (`lib/dashboard/cards.ts` + `components/dashboard/home/cards/*`)
- **Keep Echo's generic cards:** search, all_features, clock, weather, dialpad, recorder, notepad, quick_links, notifications, next_up, mini_calendar, upcoming, whats_new, the charts and the stat cards.
- **Rewire each card's data** to CMI's loaders through `lib/dashboard/data.ts` and `GET /api/dashboard/data?keys=…`, with each key re-checking the role and never throwing:

| Card | Data source |
| --- | --- |
| Calls (out / in / missed) | Move the stats out of `app/api/communications/calls/route.ts` into `lib/communications/call-stats.ts`. Company-wide, 60 s cache. |
| SMS, Emails | `messages` by channel |
| Bookings | `booking_appointments` |
| Calendar | `calendarEvents` from `lib/google/workspace.ts`, with bookings as fallback |
| Notifications | `loadStaffNotifications` |
| Messages | DM `getUnreadCount` |
| Alerts | Briefing `attention` |
| Files | `storageUsedBytes` plus my uploads |
| Weather | Add a `currentWeather()` to `lib/weather.ts` (Open-Meteo at the office, with "Use my location"). Animated icon, as in Echo's `weather.tsx`. |
| Dialpad | `CallsWorkspace` compact, desktop only, one instance |
| Recorder | `AudioRecorder` → Recording Studio |

- **CMI-only cards to add:**
  - **My Tasks** (slider, 3½ visible, hide icon)
  - **AI agent alert** (Paperclip approvals and issues, pending Bolt items)
  - **Job alert** (schedules needing a look, failed inspections, client alerts)
  - Jobs by status, Pipeline funnel and value, Pre-Con, open punch items, daily logs this week
  - Revenue outlook and 12-month forecast (projections role plus flag), invoices due
  - Report action items
  - Recent Workspace docs; blog and portfolio drafts
  - Paperclip agents
  - Ask Bolt
  - Admin settings shortcuts
  - Configurable chart and data grid
  - **Task list** and **Reminders**
  - Today's existing widgets: the 12 company counts, Recent Activity, Quick Actions and Upcoming
- **Notepad, task list and reminders** store their data per person.

### 4. Default layouts (`lib/dashboard/layout.ts`)
**Standard** (top to bottom):
1. **Get started** row: setup and Get Started card, until it's dismissed.
2. **Search and status:** search (CMI `/api/search`), **All features** button, date and time, weather.
3. **Notifications:**
   - AI agent message or alert
   - Next to-do from the calendar
   - Job alert
   - Latest notification
4. **My Tasks:** slider, 3½ cards.
5. **Stats:** a slider with Call Stats, Outbound, Inbound, Missed, SMS, Booking Stats, Calendar Stats, Notifications, Messages, Alerts, Emails and File Stats.
6. **What's new:** cards you can view or hide.
7. **Company:** today's widgets (the 12 counts as a slider, Recent Activity, Revenue Outlook for admins, Quick Actions, Upcoming).

**Blank:** the Get Started wizard (Echo's `start-chooser` plus focus bundles), then an empty "My dashboard" grid.
1. Pick a focus: Office/Admin, Sales/Pipeline, Project Management or Field.
2. Pick suggested card bundles.
3. Add tools.

**Multiple views** are named tabs per person.

### 5. What's new
- **Table:** `whats_new`.
- **Admin:** Settings → **What's New** tab (Super Admin): write, edit, publish.
- **Drafting:** Claude tool `cmi_whats_new_draft` and a Bolt draft tool; publishing stays in the dashboard.
- **Per-person hides** are stored in the layout.

### 6. Migration (`apps/cmi-next/supabase/migrations/2026-11-25_dashboard_v2.sql`, applied only after approval)
Based on Echo's `user_dashboards`, keyed by `staff_user_id`. RLS is on and access is through the service role only.

| Table | Purpose |
| --- | --- |
| `dashboard_layouts` | `staff_user_id` (primary key), `layout` jsonb, `updated_at` |
| `dashboard_defaults` | Single row: `preset` and an optional default `layout`, set by a Super Admin |
| `dashboard_widget_data` | Per person and key: notepad, task list and reminders |
| `whats_new` | The entries |

The migration also seeds the `dashboard_v2` flag (off).

### 7. Bolt and Claude
- Rewrite the Overview entry in `lib/agent/dashboard-guide.ts`: Customize, Add card, All features, views, What's new.
- Optional Claude tool `cmi_dashboard_add_card`, scoped to the person's own layout.

## Phases (each ends with typecheck, lint, tests and a working page)
1. **Port the framework:**
   - dependencies, migration and flag
   - the layout API
   - sections and sliders, Customize with drag and drop, hide and restore
   - Add card
   - Standard and Blank, the wizard, the Super Admin default
   - the subtitle removed, plus the greeting
2. **All Features catalog and panel**, the Search and status row (animated weather), the Notifications row, My Tasks, and the Stats row with CMI data.
3. **CMI card library**, charts and grids, What's new (table, admin tab, drafting).
4. **Personal tools** (dialpad, recorder, notepad, task list, reminders), multiple views, the Bolt guide and the optional Claude tool.

## Files (representative)
- **New:**
  - `components/dashboard/home/*` (ported from Echo)
  - `components/dashboard/feature-menu.tsx`
  - `components/ui/responsive-panel.tsx`
  - `lib/dashboard/{layout,cards,data,presets}.ts`
  - `lib/features/catalog.ts`
  - `lib/communications/call-stats.ts`
  - `app/api/dashboard/{layout,data,defaults,widget-data,whats-new}/route.ts`
  - the migration and the spec
- **Edit:**
  - `app/dashboard/overview/{page,overview-client}.tsx` (flag branch)
  - `lib/weather.ts`
  - `components/dashboard/global-search.tsx` (export the page filter)
  - `app/api/communications/calls/route.ts`
  - `lib/agent/dashboard-guide.ts`
  - `lib/mcp/tools*.ts`
  - Settings
  - `package.json`

## Verification
- **Unit tests** (`node:test`):
  - `normalize` (drops unknown or role-blocked cards)
  - the presets for each role
  - catalog filtering by role and flag (no unreachable links)
  - call-stats "missed" counting
  - weather code → icon
- **In the browser** (Playwright at desktop and phone width, flag on):
  - Standard renders the rows in order, with no subtitle.
  - All Features opens as a side sheet (a bottom sheet on a phone), search narrows it, expand works, and every link goes to a real page.
  - Drag a card and reload: it stays where you put it.
  - Hide and restore a card or section.
  - Add card adds a card.
  - Blank shows the wizard.
  - My Tasks shows 3½ cards and slides.
  - Weather animates, and goes still with reduced motion.
- **Checks:** `npm run typecheck`, `npm run lint` (app, lib, components) and `npm run test` in `apps/cmi-next`.
- **Migration:** applied only after approval. The flag stays off until Jeremy turns it on.
- **Commit and push:** only when asked, staging only changed files.
