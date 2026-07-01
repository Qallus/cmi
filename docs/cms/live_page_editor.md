# Live Page Editor — Implementation Notes (v1)

Primary implementation guide for the **Live Page Editor**, a Super Admin-only
visual page-review and note-taking workflow inside the CMS / Site Content area.

This document supersedes the original brief at `docs/Live_Page_Editor.md`
(kept for reference). It records the chosen architecture and what shipped in the
first stable version.

---

## Summary

The Live Page Editor lets a Super Admin:

- Pick a public frontend page and view it live inside a safe same-origin iframe.
- Toggle Desktop / Tablet / Mobile preview widths.
- Click headings and their parent sections (plus best-effort containers, rows,
  columns, cards, and components) to select them.
- Attach notes to the selected element with **priority**, **status**, and
  **change type**.
- Export the review as structured / AI-readable data (JSON + Markdown brief).
- Hand the brief to Bolt AI through a clean adapter.

It is a **review workflow, not a publishing workflow**. Nothing here edits or
publishes the live site. Any future AI-generated CMS changes must be saved as
drafts for Super Admin review — enforced by design (this feature never writes to
`site_content_blocks` / published content).

---

## Where it lives

- Button: **Site Content** header — `Bolt AI` · `Live Page Editor` · `New Block`.
  The Live Page Editor button is only rendered for `super_admin`.
- Route: `/dashboard/site-content/live-editor` (server-guarded, Super Admin only).
- API: `/api/site-content/live-editor` (Super Admin only, service-role DB access).

## Files

| Concern | Path |
| --- | --- |
| Migration | `supabase/2026-07-01_live_page_editor.sql` |
| Auth (super admin) | `apps/cmi-next/lib/auth/require-admin.ts` → `requireSuperAdmin` |
| Auth (RSC guard) | `apps/cmi-next/lib/auth/server-session.ts` |
| Types | `apps/cmi-next/lib/live-editor/types.ts` |
| Preview page catalog | `apps/cmi-next/lib/live-editor/pages.ts` |
| Data access | `apps/cmi-next/lib/live-editor/data.ts` |
| Export + AI brief | `apps/cmi-next/lib/live-editor/export.ts` |
| API route | `apps/cmi-next/app/api/site-content/live-editor/route.ts` |
| Page (guard) | `apps/cmi-next/app/dashboard/site-content/live-editor/page.tsx` |
| Editor UI | `apps/cmi-next/app/dashboard/site-content/live-editor/live-editor-client.tsx` |
| Header buttons | `apps/cmi-next/app/dashboard/site-content/site-content-client.tsx` |
| Bolt adapter (read entities) | `apps/cmi-next/lib/agent/entities.ts` |

---

## Preview & element-detection strategy (chosen approach)

The public frontend pages are Next.js routes in the **same app / same origin**
as the dashboard. So option 1 from the brief ("same-app iframe preview route")
is available and is the safest, most capable choice:

- The editor loads the real public route (e.g. `/about`) in an iframe.
- Because it is **same-origin**, the parent can read `iframe.contentDocument`
  directly. No cross-origin hacks, no proxy, no re-rendering from CMS data.
- On each load the parent injects a small **review overlay** (styles + listeners)
  into the iframe document. The overlay:
  - highlights the element under the cursor for the current selection mode,
  - captures clicks (suppressing navigation while in select mode),
  - builds a **stable element reference** and a descriptor, and
  - hands the descriptor back to the parent editor.

If the public site is ever moved to a different origin, the same overlay can be
delivered as a cooperating script that talks to the parent via `postMessage`;
the descriptor shape is already `postMessage`-friendly.

### Stable element references

Each detected element gets `element_ref`:

```
<page_slug>::<element_type>::<dom_path index chain>[::<heading text>]
```

built from page slug, element type, a `tag:nth-of-type` DOM path, and (for
headings) the trimmed heading text. This survives re-renders as long as page
structure is stable, and lets notes re-attach on the next visit.

### Selection modes

`Auto Detect`, `Sections`, `Containers`, `Rows`, `Columns`, `Cards`,
`Components`, `Headings Only`. In **Auto Detect**, if several candidate levels
sit under the cursor, a small picker lists them (Section / Container / Heading /
…) so the reviewer chooses the exact level.

First-version priority (per brief): **headings (H1–H6)** and their **nearest
parent section** are detected most reliably; the other levels are best-effort
class/tag heuristics.

---

## Data model

Four private tables (RLS: service-role only — see migration):

- `page_review_sessions` — one open session per page per reviewer.
- `page_review_elements` — inspected elements (deduped by `element_ref`).
- `page_review_notes` — notes with `priority`, `status`, `change_type`,
  `ai_generated`.
- `page_review_exports` — export records; `ai_visible` flags briefs handed to AI.

Notes `status` includes `draft` so AI-drafted suggestions are storable as drafts.

---

## API

`GET /api/site-content/live-editor?page_slug=…` → `{ session, elements, notes }`
for that page (creates/reuses an open session lazily on first note).

`POST /api/site-content/live-editor` with `{ action, … }`:

- `save_note` — ensure session + upsert element by `element_ref`, insert note.
- `update_note` — patch note (priority/status/change_type/note).
- `delete_note`.
- `export` — build structured export + Markdown brief, store an export row.
- `send_to_bolt` — build the brief, store an export row with `ai_visible = true`,
  return the AI brief for the reviewer to hand to Bolt.

All actions require `super_admin`.

---

## Bolt AI integration (clean adapter, no auto-publish)

Two connection points, neither of which can publish:

1. **Read access** — the review tables are registered as agent entities
   (`page_review_note`, `page_review_export`) so Bolt can list/read notes and
   briefs through its existing generic tools. Writes are gated to `super_admin`.
2. **AI brief** — `export.ts` builds an AI-readable brief (`buildAiBrief`) that
   the "Send to Bolt AI" button produces and copies. The brief explicitly tells
   Bolt to propose **drafts only**, scope each change to the referenced element,
   and never publish.

Guardrails:

- Bolt must not auto-publish or make destructive edits.
- Any AI-generated updates are stored as **drafts** (`page_review_notes.status =
  'draft'`, `ai_generated = true`) for Super Admin review.
- The existing Bolt button/workflow, New Block workflow, CMS routes, draft/publish
  workflow, and Super Admin protection are unchanged.

---

## Export format

Structured JSON (session + notes grouped by section/element) plus a Markdown
brief resembling:

```text
Page: About
Section: Hero
Element Type: H1 Heading
Element Text: Lead your life and legacy with intention
Requested Change: Make the headline shorter and improve mobile spacing.
Priority: High
AI Instruction: Update only the H1 heading and responsive typography. Do not
change the CTA buttons or background image. Save as a draft for review.
```

PDF generation is not yet wired (no existing PDF utility in the app). The export
returns clean structured data + Markdown; a `file_type: 'pdf'` path can be added
later behind the same `export.ts` abstraction and download in the client.

---

## Not in v1 / backlog

- Server-side screenshots per element (`screenshot_url` reserved).
- True PDF rendering of the brief.
- Prefilling the Bolt chat directly (today: copy brief → open Bolt).
- Persisting bounding boxes for an offline overlay replay.
