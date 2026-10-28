# CMI Cloud ↔ Google Drive two-way sync + Google Drive tab + Claude file access 

## Context

**Cloud today** (`/dashboard/cloud`):
- File bytes live in **Garage** (S3) on the office server. Metadata lives in Supabase `files` / `folders`, with soft
  delete as Trash.
- Folders are scoped to General (`project_id` null) or a project/job.
- Uploads go browser ↔ Garage through presigned URLs.
- Code: `lib/files/{s3,data,types}.ts`, `app/api/files/*`, `app/dashboard/cloud/*`.

**What Jeremy wants:**
1. A **Google Drive tab** in Cloud.
2. **Two-way sync**, so a change in Cloud appears in Google Drive and a change in Drive appears in Cloud.
3. **Claude access** to Cloud files through the CMI MCP connector.

**Decisions (Jeremy, 2026-10-23):**
- **Sync target:** one company **Shared Drive** named "CMI Cloud". Cloud's folder tree maps 1:1 to it.
- **Google Drive tab:** a live view of **each person's own Drive** (My Drive, Shared with me and their Shared Drives),
  browsed as them. Nothing is copied.
- **Google Docs, Sheets and Slides:** they appear in Cloud as a **link plus a cached PDF preview**, used for preview and
  for Claude. Editing stays in Google.
- **Sync account:** an **existing admin** (`CLOUD_SYNC_USER`, e.g. `jeremy@constructedmatter.com`), impersonated through
  the Phase 2 domain-wide delegation. Synced changes show as made by that person in Drive.

**Builds on:**
- Phase 2 Google client (`lib/google/{parse,client,workspace}.ts`), which already handles tokens, `driveRecent` and
  `driveReadFile`.
- MCP tools in `lib/mcp/tools.ts`, with audit and policy.

## ⚠️ Do now, during today's Google setup

Two-way sync must **write** to Drive, so in Google Admin → Domain wide delegation add the full Drive scope next to the
read-only ones:

```
https://www.googleapis.com/auth/gmail.readonly,https://www.googleapis.com/auth/drive,https://www.googleapis.com/auth/drive.readonly,https://www.googleapis.com/auth/spreadsheets.readonly,https://www.googleapis.com/auth/calendar.readonly
```

- **Only the sync worker** asks Google for the `drive` scope.
- **Claude's tools and the Drive tab stay read-only**, because the code requests `drive.readonly` for them. The app
  still decides whose Drive is read.

Then:
1. Create the Shared Drive **"CMI Cloud"**.
2. Add `CLOUD_SYNC_USER` as **Manager**.
3. Add the staff who should see it.

---

## Design

### Data model (one migration: `2026-10-xx_cloud_drive_sync.sql`)

- **`files`** gets new columns:
  - `drive_file_id` (unique), `drive_md5`, `drive_modified_at` and `drive_version`
  - `sync_state` (`synced` | `pending_push` | `pending_pull` | `conflict` | `error`) and `sync_error`
  - `google_mime` (set for native Docs/Sheets/Slides) and `web_view_link`
  - `content_md5`, set at upload. S3 ETag works for single-part uploads; multipart computes it in the worker.
- **`folders`** gets `drive_folder_id` (unique) and `drive_modified_at`.
- **`drive_sync_state`** is a single row: `shared_drive_id`, `changes_page_token`, `last_pull_at` and `last_push_at`.
- **`drive_sync_outbox`** queues Cloud → Drive work: `entity` (file/folder), `entity_id`, `op` (`create` | `update` |
  `rename` | `move` | `trash` | `restore`), `attempts`, `next_attempt_at`, `last_error` and `done_at`.
- **`drive_sync_log`** keeps history for the Settings panel and troubleshooting: direction, entity, op, outcome and
  timestamp.
- **Native Google files:** a Doc, Sheet or Slides file becomes a `files` row with `google_mime` set and its
  `storage_key` pointing to a cached PDF export (`gdrive-cache/<drive_id>.pdf`). It is marked read-only in Cloud.

### Folder mapping

| Cloud | Shared Drive "CMI Cloud" |
| --- | --- |
| General (root) | `/General/` |
| Project or job scope | `/Projects/<job_number> <job name>/`, created on first use. A job rename renames the folder. |
| Nested folders | The same nested folders |
| Trash | Drive Trash |

### Cloud → Drive (push)

**When a change is queued:** every write path in `app/api/files/*` and `lib/files/data.ts` adds an outbox row in the
same request. That covers complete-upload, rename, move, trash, restore, folder create, rename, move and trash.

**The worker** is `lib/drive-sync/push.ts`, run by `syncPush()`:
- **New file:** it streams the object from Garage (`GetObject` over the internal `S3_ENDPOINT`, so the tunnel's 100 MB
  cap doesn't apply) into Drive's **resumable upload** in 8 MB chunks. Bytes pass through the server, never through
  the browser.
- **After the upload:** it stores `drive_file_id`, `md5Checksum` and `modifiedTime`.
- **Rename, move, trash and restore:** these are cheap `files.update` calls.
- **Failures:** retries back off exponentially. After 5 tries the file is marked `sync_state=error` and shows in the UI.

### Drive → Cloud (pull)

The worker is `lib/drive-sync/pull.ts`, run by `syncPull()`:
- It reads Drive's **Changes API** (`changes.list` with `driveId`, `includeItemsFromAllDrives`, and a stored page
  token). Changes come in incrementally, so it never rescans.
- **New file:** it streams the bytes from Drive into Garage (`PutObject` / multipart), then inserts a `files` row in the
  mapped folder. `uploaded_by` is null, `metadata.source` is `"google_drive"`, and `lastModifyingUser` is recorded.
- **Changed file:** it pulls when `md5Checksum` changed and the Cloud side isn't pending, and replaces the object.
- **Native Google file:** it exports a PDF when `modifiedTime` changes.
- **Rename, move and trash:** these update metadata. Drive trash becomes a Cloud soft delete.
- **Permanent delete in Drive:** the file goes to Cloud Trash and is not hard-deleted. Data is never destroyed by sync.

### Loop prevention and conflicts

- The worker skips any change whose `md5` and `modifiedTime` equal what it just wrote, and any change made by the sync
  user within a few seconds of a push it recorded.
- **Conflict:** both sides changed since the last sync. The newer side wins. The other version is kept as
  `name (conflicted copy, Drive, 2026-10-24).ext` on both sides, `sync_state=conflict` is set, and the file gets a badge
  in Cloud.
- **Name rules:** Drive allows duplicate names but Cloud may not. Pulls de-dupe with a ` (2)` suffix.

### Scheduling

- A Coolify Scheduled Task `drive-sync` runs every 2 minutes and calls `POST /api/drive-sync/run`, guarded by
  `AUTOMATION_SECRET` like `/api/email-sync/run`. Each run does a push, then a pull.
- A Postgres advisory lock (`pg_try_advisory_lock`) stops overlapping runs.
- **Faster pushes:** after a Cloud write, the API also triggers `syncPush()` in the background, best-effort, so Cloud →
  Drive is near-instant.
- **Later:** Drive push notifications (`changes.watch` webhook), once the polling is proven.

### First-time setup (backfill)

`POST /api/drive-sync/backfill` is Super Admin only and runs in batches:
1. It creates `/General` and `/Projects/...` in the Shared Drive.
2. It pushes every existing Cloud file, oldest first.
3. It pulls anything already in the Shared Drive that isn't in Cloud.
4. It records the starting `changes_page_token`.

Settings shows progress throughout.

### Permissions

- **Cloud:** unchanged. Staff roles use `requireAdmin`; rename, move and delete need the owner or super_admin/admin.
- **Shared Drive:** access is managed in Google by Shared Drive membership.
- **The gap:** a person who isn't a Shared Drive member can still see synced files in Cloud, as today. The Settings
  panel lists Cloud users who aren't Shared Drive members, so Jeremy can line the two up.

## Google Drive tab (live, per person)

- Cloud's left panel gets a **Google Drive** section: **My Drive**, **Shared with me** and **Shared drives**, each
  expandable.
- The API is `GET /api/google-drive?folder=&q=&view=` (requireAdmin). It impersonates the **signed-in person's own
  email** through `assertWorkspaceStaff` and the `drive.readonly` scope, so people only see what Google already lets
  them see.
- It reuses Cloud's Grid/List/Table views with a "Drive" item type: icon, owner, modified date, and Open in Google.
- **Preview:** images and PDFs are proxied through `/api/google-drive/[id]/content` with a short cache. Docs use
  `driveReadFile` text, or the Google PDF export.
- **Actions in v1:**
  - **Copy to Cloud:** pulls a one-off copy into a chosen Cloud folder.
  - **Open in Google.**
  - Editing Drive from this tab isn't planned, because the synced Shared Drive covers that.
- **"CMI Cloud" appears under Shared drives** with a "Synced with Cloud" badge, so it's clear it's the same content.

## Claude (MCP) access to files

New tools in `lib/mcp/cloud-tools.ts`, merged into `MCP_TOOLS`. All are audited and read-only in v1:

| Tool | Does |
| --- | --- |
| `cloud_search_files(query?, job?, folder?, type?, since?)` | Searches Cloud metadata: name, folder path, job, uploader, size, type and a Drive link if synced. |
| `cloud_list_folder(folder_id? or path?, job?)` | Browses folders. |
| `cloud_read_file(file_id)` | Returns text: PDF via `unpdf`, txt/csv/md/json directly, docx/xlsx via a lightweight extractor (`mammoth`/`xlsx`, new dependencies), and native Google files via the cached PDF. Size-capped. Images return metadata plus a 5-minute link. |
| `cloud_get_link(file_id)` | A short-lived presigned download link to share in chat. |

**Scope:**
- Same visibility as the Cloud page: staff roles that use Bolt; trashed files are hidden.
- Money files aren't special-cased; the existing `redactFinancial` only touches structured fields.
- **Drive coverage:** the existing `drive_list_recent` / `drive_read_file` tools already read the person's Drive, and
  after sync "CMI Cloud" is in Drive too. Claude can use either.

**Later, with approval:** `cloud_save_file(name, folder, content)` lets Claude save a generated document (summary, daily
log PDF) into Cloud. It would be staged for confirmation, like Bolt's PendingAction, and would sync to Drive on its own.

**Bolt:** `cloud_search_files` and `cloud_read_file` are added to Bolt (`lib/agent/tools.ts`) through the same shared
`lib/cloud-ai/*` helpers.

## Dashboard

- **Cloud file status:** a small badge for Synced, Syncing, Conflict or Error, with a tooltip, plus **Open in Google
  Drive** in the file menu.
- **Settings → Cloud Sync** (Super Admin), a new tab or a section of the Claude tab. It shows:
  - the sync on/off switch (feature flag `drive_sync`, default off)
  - the Shared Drive ID and sync user
  - last push/pull times and a queue count
  - recent errors and conflicts, with Retry
  - a **Run sync now** button and **Backfill**
  - the membership mismatch list
- **Settings → Credentials:** adds `CLOUD_SYNC_USER` and `CLOUD_SHARED_DRIVE_ID`.
- **Bolt's guide:** `lib/agent/dashboard-guide.ts` gets entries for the Google Drive tab and sync status.

## Phases (stop for approval after each)

0. **Docs:** copy both plans into `docs/features/…`. Update `docs/ai-os/google-dwd-setup.md` with the `drive` scope
   and the Shared Drive setup steps.
1. **Google Drive tab:** read-only, per person. Lowest risk, and useful on its own.
2. **Claude file tools:** `cloud_search_files`, `cloud_list_folder`, `cloud_read_file` and `cloud_get_link`, plus the
   Bolt equivalents.
3. **Sync foundation:** the migration, outbox hooks in the file APIs, `push.ts` and backfill, behind `drive_sync`.
   Cloud → Drive only, so the result can be verified in Drive.
4. **Drive → Cloud:** `pull.ts` with the Changes API, native-file PDF previews, conflicts, loop prevention, and the
   Coolify task.
5. **Polish:** sync badges, the Settings → Cloud Sync panel, the membership report, and push notifications (optional).

## Critical files

- **New:**
  - `lib/drive-sync/{push,pull,map,conflict}.ts` with `map.test.mjs` and `conflict.test.mjs`
  - `app/api/drive-sync/{run,backfill,status}/route.ts`
  - `app/api/google-drive/route.ts` and `[id]/content/route.ts`
  - `lib/mcp/cloud-tools.ts` and `lib/cloud-ai/read.ts`
  - the migration file
- **Modified:**
  - `lib/google/workspace.ts`: Drive write helpers (resumable upload, `files.update`, `changes.list`, export) using the
    `drive` scope, sync worker only
  - `lib/google/parse.ts`: add `driveFull` to `GOOGLE_SCOPES`
  - `app/api/files/*` and `lib/files/data.ts`: outbox hooks
  - `lib/files/s3.ts`: server-side stream get/put helpers
  - `app/dashboard/cloud/*`: the Drive tab, badges and menu item
  - `app/dashboard/settings/*`, `lib/mcp/tools.ts`, `lib/agent/tools.ts`, `lib/agent/dashboard-guide.ts` and
    `.env.example`
- **Reused:**
  - `lib/google/client.ts` (`googleGet`, token cache and `assertWorkspaceStaff`)
  - `driveReadFile` / `driveRecent`
  - `lib/files/s3.ts` presign helpers
  - `lib/automations/auth.ts` (cron guard)
  - the Cloud views (`cloud-views.tsx`)
  - `unpdf`

## Verification

- **Unit tests:** folder ↔ path mapping, conflict decisions (newer wins plus a conflicted copy), loop-skip rules, and
  name de-duplication.
- **Staging Shared Drive first:**
  - Set `CLOUD_SHARED_DRIVE_ID` to a test Shared Drive "CMI Cloud (test)" and run a backfill on a handful of files.
  - Then check each path, both ways:
    - upload in Cloud → appears in Drive within one run
    - rename and move in Drive → reflected in Cloud
    - edit a Doc → its PDF preview refreshes
    - trash in Drive → Cloud Trash
    - restore → back
    - edit the same file on both sides → conflict copy on both sides
  - A 500 MB video tests the streaming and resumable paths.
- **Claude:**
  - "Find the latest structural plans for 26_012 and summarize them" calls `cloud_search_files` then `cloud_read_file`.
  - Confirm the audit rows.
- **Then switch on production:** point the IDs at the real "CMI Cloud" Shared Drive and backfill. The flag stays off
  until Jeremy says go.

## Risks and notes

- **Storage:** bytes are stored twice (Garage and Drive), so Drive quota applies to the Shared Drive.
- **Bandwidth:** the sync worker moves bytes between the VPS and Google. Large video uploads cost VPS bandwidth. If that
  becomes a problem, the worker can move to the office server next to Garage.
- **Sync identity:** with an admin as the sync user, Drive shows that person as the modifier of synced uploads. Cloud
  still records the real uploader.
