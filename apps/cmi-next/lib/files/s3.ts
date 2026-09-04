// Server-only Garage (S3-compatible) helper for the Cloud file manager.
// Bytes live in Garage on the CMI office server; only presigned URLs and
// server-side control-plane calls touch it here. Never import this in client code.
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare Tunnel caps a request at 100 MB, so single-PUT and each multipart
// part stay ≤ 90 MB. Anything larger than a single part uses multipart.
export const PART_SIZE_BYTES = 90 * 1024 * 1024; // 90 MB
export const SINGLE_MAX_BYTES = 90 * 1024 * 1024; // ≤ this → one presigned PUT
export const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB default cap
const PUT_TTL = 900; // 15 min
const GET_TTL = 300; // 5 min

const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/"];
const ALLOWED_MIME_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/zip",
  "application/json",
  "application/octet-stream",
]);

export function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_PREFIXES.some((p) => mime.startsWith(p)) || ALLOWED_MIME_EXACT.has(mime);
}

export class StorageNotConfiguredError extends Error {
  constructor() { super("Cloud storage is not configured."); }
}

export function storageConfigured(): boolean {
  return !!(process.env.S3_ENDPOINT && process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);
}

export const BUCKET = process.env.S3_BUCKET || "cmi-app-files";

let _client: S3Client | null = null;
function client(): S3Client {
  if (!storageConfigured()) throw new StorageNotConfiguredError();
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.S3_REGION || "garage",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true, // required for Garage
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return _client;
}

// Safe object key. Filenames are sanitized; a uuid keeps keys unique.
function safeName(name: string): string {
  const base = (name || "file").toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return base || "file";
}
export function storageKeyFor(projectId: string | null, filename: string): string {
  const scope = projectId ? `projects/${projectId}` : "general";
  return `${scope}/${crypto.randomUUID()}-${safeName(filename)}`;
}
export function thumbKeyFor(storageKey: string): string {
  return `thumbs/${storageKey}.jpg`;
}

// ── Single-PUT ──
export function presignPut(key: string, contentType: string) {
  return getSignedUrl(client(), new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn: PUT_TTL });
}
export function presignGet(key: string, downloadName?: string) {
  return getSignedUrl(client(), new GetObjectCommand({
    Bucket: BUCKET, Key: key,
    ...(downloadName ? { ResponseContentDisposition: `attachment; filename="${downloadName.replace(/"/g, "")}"` } : {}),
  }), { expiresIn: GET_TTL });
}

// ── Multipart ──
export async function startMultipart(key: string, contentType: string): Promise<string> {
  const out = await client().send(new CreateMultipartUploadCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }));
  if (!out.UploadId) throw new Error("Failed to start multipart upload.");
  return out.UploadId;
}
export function presignPart(key: string, uploadId: string, partNumber: number) {
  return getSignedUrl(client(), new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: PUT_TTL });
}
export async function completeMultipart(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]) {
  await client().send(new CompleteMultipartUploadCommand({
    Bucket: BUCKET, Key: key, UploadId: uploadId,
    MultipartUpload: { Parts: parts.sort((a, b) => a.PartNumber - b.PartNumber) },
  }));
}
export async function abortMultipart(key: string, uploadId: string) {
  await client().send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId }));
}

// ── Verify / delete ──
export async function objectExists(key: string): Promise<boolean> {
  try { await client().send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })); return true; }
  catch { return false; }
}
export async function deleteObject(key: string) {
  try { await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })); } catch { /* best-effort */ }
}

// Number of 90 MB parts a file of this size needs.
export function partCountFor(sizeBytes: number): number {
  return Math.max(1, Math.ceil(sizeBytes / PART_SIZE_BYTES));
}
