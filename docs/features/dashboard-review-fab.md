# Dashboard Review FAB (Leadership capture tool)

A floating action button on **every dashboard page**, Super Admin-only, for
capturing web-edit requests, sharing them, screenshotting, and asking Bolt.

## What it does

- **Fixed bottom-right FAB** — rendered only for `super_admin` (mounted in
  `app/dashboard/layout.tsx`). Shows a red badge with the count of unread notes
  shared with you.
- **Note** tab — write a note (auto-tagged with the current route + page title),
  pick a **type** (Edit / Bug / Idea / Question / Remove) and **priority**,
  optionally **screenshot** the page (html2canvas → uploaded to the `cmi-media`
  bucket), and **share** it with selected Super Admins/Admins.
- **Shared** tab — notes shared with you; open the page, change status
  (Open → In Progress → Done → Archived). Opening the tab marks them read.
- **Ask Bolt** — opens a compact Bolt chat modal (same `/api/agent/chat` as the
  full Agent page) pre-grounded with the current page, with **voice input**
  (browser Web Speech API). Bolt proposes drafts only; nothing auto-publishes.

## Notifications

Sharing a note notifies each recipient two ways:
- **Email** via Resend (`lib/dashboard-notes/notify.ts`).
- **In-app bell** — unread shared notes are added to the header notification
  badge (`/api/notifications/unread-count`) and to the FAB badge.

## Files

| Concern | Path |
| --- | --- |
| Migration | `supabase/2026-07-01_dashboard_review_notes.sql` |
| Types / data / email | `apps/cmi-next/lib/dashboard-notes/*` |
| API (Super Admin) | `apps/cmi-next/app/api/dashboard-notes/route.ts` |
| FAB | `apps/cmi-next/components/dashboard/review-fab.tsx` |
| Bolt modal | `apps/cmi-next/components/dashboard/bolt-modal.tsx` |
| Mount point | `apps/cmi-next/app/dashboard/layout.tsx` |

## Data model — `dashboard_notes`

route, page_title, note, type, priority, status, created_by/_name,
`recipient_emails[]`, `read_by[]`, screenshot_url, shared. RLS: service-role
only (the API enforces Super Admin).

## Notes / backlog

- Screenshot uses **html2canvas** (one-click, no permission prompt); complex
  CSS/charts can render imperfectly. The FAB itself is excluded from the shot
  via `data-fab-ignore`.
- Voice uses the browser **Web Speech API** (Chrome/Edge). Upgrade path: the
  existing Recording Studio Whisper pipeline for cross-browser transcription.
- Future: a shared inbox page (cards/list/table) like the Live Page Editor's
  Saved Reviews, and wiring the header bell to open the shared list directly.
