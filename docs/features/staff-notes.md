# Staff Notes (Documents → Notes) — Phase 1

**Shipped:** July 22, 2026

A rich personal-notes system inside the Documents section. Private to the
author and anyone the note is linked to.

## Routes & files

| Piece | Path |
|---|---|
| Notes tab UI | `components/notes/notes-panel.tsx` |
| Note editor modal | `components/notes/note-editor.tsx` |
| Client API helpers | `components/notes/notes-api.ts` |
| Types / vocab | `lib/notes/types.ts` |
| Server data layer | `lib/notes/data.ts` |
| Storage (signed URLs) | `lib/notes/storage.ts` |
| List / create | `app/api/notes/route.ts` |
| Update / delete / mark-read | `app/api/notes/[id]/route.ts` |
| Attachment upload URL | `app/api/notes/upload-url/route.ts` |
| Attachment read URL | `app/api/notes/media-url/route.ts` |
| Import | `app/api/notes/import/route.ts` |
| Wired into | `app/dashboard/documents/documents-client.tsx` (new "Notes" tab) |

## Database

Migration `supabase/2026-07-22_staff_notes.sql` (applied to production).

- `staff_notes` table: author, title, body (Markdown), status, color,
  `attachments` (jsonb), `linked_staff_ids` (uuid[]), `linked_emails` (text[]),
  `read_by` (uuid[]), `due_date`.
- Private storage bucket `notes-media`.
- RLS enabled with **no public policy** — all access is through server routes
  using the service-role key. Visibility (author OR linked) is enforced in
  `listNotesFor`.

## Features (Phase 1)

- **Notes tab** in Documents + **Add Note** button next to New SOW.
- **Editor**: title, Markdown body, Status select, Color picker (7 named
  colors), due date, link staff (multi-select), link any email (tag input),
  attachments (image / audio / video / slides / PDF / file), notify toggle.
- **Four views**: List, Table, Kanban (columns by status), Calendar (notes on
  their due date, falling back to updated date; month navigation).
- **Search** across title, body, linked people.
- **Export** (JSON download) / **Import** (JSON upload — text fields only;
  attachments and links are not carried across, by design).
- **Visibility**: private, plus anyone linked. A linked viewer can edit; only
  the author can delete.
- **Notifications on link**:
  - *In-app* — linked staff get a bell notification ("X linked you on a note")
    that clears when they open Documents. Wired through
    `lib/notifications/staff.ts` (new `note_link` kind) and the unread-count
    route.
  - *Email* — linked staff emails and linked external emails get a nudge via
    Resend, best-effort and respecting `messaging_suppressions`
    (`isSuppressed`). **Note:** email delivery depends on a working
    `RESEND_API_KEY` / `RESEND_FROM_EMAIL`; both are currently misconfigured in
    the environment (401 / misspelled domain), so email nudges will no-op until
    those are fixed. In-app is unaffected.

## Deferred to Phase 2 (per the agreed scope)

- Drawing tools (shapes, lines, icons) — planned to reuse the Project Canvas
  drawing engine (`components/features/project-canvas`).
- Slides and animations.

## Environment

No new environment variables. Uses the existing Supabase service-role
connection and the existing Resend variables for the email nudge.
