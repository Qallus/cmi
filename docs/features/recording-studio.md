# Recording Studio — Feature & Replication Guide

Meeting recordings + transcription + AI meeting intelligence. Staff record or
upload **audio**, get a Whisper transcript, and an AI (Bolt/Hermes) summary with
action items and suggestions — all connected to contacts, projects, quotes, and
staff. Built on **Next.js (App Router) + Supabase (DB + Storage)**.

---

## 1. Feature Overview

- **Capture audio** two ways: upload an audio file, or **record in the browser**
  (branded recorder modal with a live waveform visualizer + timer). Large files
  upload **directly to private Supabase Storage** via signed URLs (bypasses the
  app server); playback uses short-lived signed URLs.
- **Multiple recordings per meeting**, each with play / transcribe / remove, and
  a recording-count badge in the lists.
- **Transcription** via OpenAI Whisper (25 MB/file guard; audio-only keeps long
  meetings under it). Transcribe a specific recording or the primary one.
- **AI intelligence** (Bolt/Hermes): generates a **summary**, checkable **action
  items**, and **suggestions** from the transcript.
- **Connected records**: searchable multi-select **Contacts/clients**, a
  **"Recorded by" staff** field, plus **Project** and **Quote** links.
- **Audio types** with a colored highlight badge (client meeting, staff notes,
  project notes, brainstorming, designer, vendor, client, sub-contractor, city
  planner, site walkthrough, change order, etc.).
- **4 views**: Table, List, Cards, Calendar — each with per-item **Listen**
  (slide-up drawer player) + **Transcript** (modal) + image thumbnail.
- **Image/photo** per meeting (large dropzone + optional URL).
- **Notes**: internal, follow-up, and client-facing (+ "approved for sharing").
- **Statuses**: Draft → Processing → Transcribed → Reviewed → Action items →
  Shared → Archived. Archive/Restore/Delete from list or detail.
- **Bolt awareness**: the agent has a `meeting` entity so it can search/read
  meetings for project context.
- **Access**: admins & project managers see all; other staff see meetings they
  created or are assigned to. Edit/transcribe/delete = creator/assignee or admin.

---

## 2. Data Model (Supabase)

### `meetings`
`id, title, meeting_type, status (draft|processing|transcribed|reviewed|
action_items_created|shared_with_client|archived), meeting_date, duration_seconds,
location, contact_id, project_item_id, quote_id, document_id, staff_user_id,
related_records jsonb (e.g. multiple contacts), attendees jsonb,
recording_bucket/recording_path/recording_filename/recording_mime (legacy
primary), recordings jsonb (array of { id, path, filename, mime, created_at,
transcript? }), image_url, attachments jsonb, transcript, summary, action_items
jsonb, ai_suggestions jsonb, follow_up_notes, internal_notes, client_notes,
client_visible, created_by, updated_by, created_at, updated_at`.

RLS enabled; access via service-role routes.

### Storage
Private bucket **`meeting-recordings`** (≈500 MB file cap). Audio is uploaded by
the browser to a **signed upload URL**; the app never proxies the bytes. Playback
and transcription use signed download URLs / server-side `download()`.

> Migrations: `meetings.sql` (table + bucket), `meetings_image.sql`
> (`image_url`), `meeting_recordings_array.sql` (`recordings` jsonb).

---

## 3. API Routes (`app/api/meetings/…`, all `requireAdmin` + ownership)

| Route | Methods | Purpose |
|---|---|---|
| `/api/meetings` | GET, POST | List (role-scoped + filters: status/type/contact/project/search/date) ; create draft. |
| `/api/meetings/[id]` | GET, PATCH, DELETE | Detail (+ primary playback URL); update; delete (removes stored audio). |
| `/api/meetings/upload-url` | POST | Returns a signed upload URL + path for direct-to-storage upload. |
| `/api/meetings/[id]/recordings` | POST, DELETE | Append a recording `{path, filename, mime}`; remove one by `recordingId` (also deletes from storage). |
| `/api/meetings/[id]/playback` | GET | `?path=` → short-lived signed playback URL for a specific track. |
| `/api/meetings/[id]/transcribe` | POST | Whisper transcription of `{path}` (or primary); 25 MB guard; sets `transcript` + status. |
| `/api/meetings/[id]/summarize` | POST | Sends transcript to the Bolt/Hermes gateway (strict-JSON prompt) → summary + action items + suggestions. |
| `/api/staff-options` | GET | Lightweight staff directory for the "Recorded by" selector. |

---

## 4. Data Layer (`lib/meetings/`)
- **types.ts** — `Meeting`, `MeetingListItem`, `MeetingRecording`,
  `MeetingActionItem`, `MEETING_TYPES`, `MEETING_TYPE_LABELS`, `typeColor`,
  statuses.
- **data.ts** (server) — `loadMeetings` (role-scoped + filters), `loadMeeting`,
  `saveMeeting`, `updateMeetingFields`, `deleteMeeting`, `addRecordingEntry`,
  `removeRecordingEntry`, `createRecordingUploadUrl`, `getRecordingPlaybackUrl`,
  `downloadRecording` / `downloadByPath`.

---

## 5. UI
- **Dashboard** `app/dashboard/recording-studio/`:
  - `recording-studio-client.tsx` — 4 view modes (Table/List/Cards/Calendar) +
    view switcher, filters, shared **audio drawer** + **transcript modal**,
    per-item Listen/Transcript/image, recording-count badges.
  - `meeting-detail.tsx` — the editor: overview (title, **audio type** + highlight
    badge, date on its own row, location), **searchable multi-select contacts**,
    **"Recorded by" staff** (single combobox), project/quote, attendees (free
    textarea parsed on save: "Name, role, email"), **recordings list** (play in
    drawer / transcribe / remove), **image** (large dropzone + URL), notes,
    transcript panel, and the Bolt summary/action-items panel.
- **Reusable components**:
  - `components/audio/audio-recorder.tsx` — branded recorder modal with Web Audio
    `AnalyserNode` → canvas waveform + timer.
  - `components/audio/audio-player.tsx` — play/pause, scrub, volume, speed,
    download.
  - `components/ui/drawer.tsx` — branded bottom-sheet (slide-up) drawer.
  - `components/ui/multi-combobox.tsx` — searchable multi/single select.
  - Branded `components/ui/input.tsx` (Input/Select/Textarea) used for all fields
    (light/dark aware).

---

## 6. Integrations & env
- **Transcription**: OpenAI Whisper — `OPENAI_API_KEY` (25 MB/file limit; swap to
  AssemblyAI/Deepgram for hours-long files + speaker labels).
- **AI summary**: Bolt/Hermes gateway — `HERMES_AGENT_URL` (+ key/model),
  OpenAI-compatible `/v1/chat/completions`.
- **Storage**: Supabase Storage private bucket `meeting-recordings`.
- **Mic**: browser recording needs `Permissions-Policy: microphone=(self)` (not
  the default `microphone=()`).
- **Public URL** / signed URLs from `NEXT_PUBLIC_APP_URL` where needed.

---

## 7. Replication checklist
1. Apply migrations: `meetings` (+ private storage bucket), `image_url`,
   `recordings` jsonb. FKs → your contacts/projects/quotes/staff tables.
2. Port `lib/meetings/{types,data}.ts`.
3. Add the routes above (incl. `/api/staff-options`).
4. Build the recorder/player/drawer/multi-combobox components, then the detail
   editor and the 4-view list client.
5. Wire Whisper + the AI gateway; create the private storage bucket.
6. Ensure `microphone=(self)` in your Permissions-Policy, and exclude any public
   routes from auth middleware (this feature is staff-only, so usually none).
7. (Optional) register a `meeting` entity in your AI agent's tool registry for
   context.

**Future:** AssemblyAI/Deepgram (long files + diarization), calendar view polish,
client-portal sharing, notifications, Zoom/Teams/Meet auto-sync, one-click
"action item → task".
