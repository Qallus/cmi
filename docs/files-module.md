# Cloud (File Manager) module

Google-Drive-style file manager in the CMI dashboard (**Cloud** in the sidebar,
`/dashboard/cloud`). Staff upload construction documents, photos, videos, and
notes. Fully responsive (mobile camera capture included).

## Architecture
- **Bytes** live in **Garage** (S3-compatible) on the CMI office server, bucket
  `cmi-app-files`, behind a Cloudflare Tunnel (`https://storage.constructedmatter.com`).
- **Metadata** lives in Supabase: `files` and `folders` (migration
  `20260904_file_manager_phase1.sql`). RLS is deny-by-default; access is via the
  service-role client and role/ownership is enforced in the API routes
  (`requireAdmin` + `role_slug`), matching the rest of the app.
- **Uploads/downloads go directly browser ↔ Garage via presigned URLs.** File
  bytes never pass through the Next.js server or the VPS disk.
- Cloudflare Tunnel caps a request at 100 MB → single PUT and every multipart
  **part is ≤ 90 MB**. Files > 90 MB use S3 multipart (3 parts in parallel).
- Max file size 2 GB; MIME allowlist (images, video, audio, PDF, office docs, text, zip).

## Env vars (server-only — set in Coolify, never client-exposed)
```
S3_ENDPOINT=https://storage.constructedmatter.com
S3_REGION=garage
S3_BUCKET=cmi-app-files
S3_ACCESS_KEY_ID=…
S3_SECRET_ACCESS_KEY=…
```
S3 client uses `forcePathStyle: true` (required for Garage). If these are unset,
the UI shows a friendly "Files are temporarily unavailable" state and the rest
of the app keeps working.

## ⚠️ Garage bucket must allow browser CORS (or uploads fail silently)
Because the browser PUTs directly to Garage, the bucket needs a CORS rule that
allows `PUT`/`GET` from the app origin **and exposes the `ETag` header**
(required to complete multipart uploads):
```json
{
  "CORSRules": [{
    "AllowedOrigins": ["https://my.constructedmatter.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }]
}
```
Apply with the AWS CLI pointed at Garage:
`aws s3api put-bucket-cors --bucket cmi-app-files --cors-configuration file://cors.json --endpoint-url $S3_ENDPOINT`

## API (`app/api/files/`)
- `POST /presign-upload` — auth + validate; returns a single presigned PUT (≤90 MB)
  or a multipart `uploadId` + presigned part URLs. For images also returns a
  presigned thumbnail PUT (`thumbs/…`).
- `POST /complete` — completes multipart, verifies the object (HeadObject), then
  inserts the `files` row. No row without a real object.
- `POST /abort` — aborts a failed multipart upload.
- `GET /[id]/url` — short-lived presigned GET (5 min); `?download=1` forces attachment.
- `GET /` — list folders+files by scope (`view`=browse/my/recent/trash/search).
- `POST /folders`, `PATCH|DELETE /folders/[id]`, `PATCH|DELETE /[id]` — folder/file
  CRUD, rename, move, soft-delete/restore, permanent delete (removes the object).

## Data model
`files` (project_id, job_id, folder_id, name, unique storage_key, thumbnail_key,
mime_type, size_bytes, uploaded_by→staff_users, metadata jsonb, soft delete) and
`folders` (project_id, job_id, parent_id, name, created_by, soft delete).

## Local development (optional — prod uses the office server)
```
docker compose -f docker-compose.dev.yml up -d
bash scripts/garage-dev-init.sh      # one-time: layout + bucket + key
# paste the printed key/secret into .env.local, S3_ENDPOINT=http://localhost:3900
```

## Test checklist (staging)
- [ ] Upload a small image → appears, thumbnail shows, preview opens.
- [ ] Upload a > 90 MB file → multipart, progress advances, completes.
- [ ] Cancel an in-progress upload → aborts, no orphan row.
- [ ] Create folder, enter it, upload inside, breadcrumb navigates.
- [ ] Rename / move-to-trash / restore / delete-forever (object removed).
- [ ] Download and Copy link work; PDF/video/audio preview inline.
- [ ] A non-owner staff cannot rename/delete someone else's file (admins can).
- [ ] Stop Garage → "temporarily unavailable" state; rest of app still works.
- [ ] Mobile: camera capture uploads a photo; layout is usable.

## TODOs (out of scope for now)
Sharing links to external clients, version history, real-time collaboration,
OCR/full-text search. Star/favorite and multi-select bulk actions are planned
(Phase 5). Server-side video thumbnails skipped (client generates image thumbs).
