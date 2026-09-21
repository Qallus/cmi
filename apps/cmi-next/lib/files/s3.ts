// Server-only Garage (S3-compatible) helper for the Cloud file manager.
// Bytes live in Garage on the CMI office server; only presigned URLs and
// server-side control-plane calls touch it here. Never import this in client code.
import {
  S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { Readable } from "node:stream";

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

export const BUCKET = process.env.S3_BUCKET || "cmi-files";

// Two delivery modes:
//  • Direct (S3_PUBLIC_ENDPOINT set, e.g. https://server.constructedmatter.com):
//    browsers upload/download straight to Garage with presigned URLs.
//  • Proxy (default): presigned URLs would point at a tailnet-only, plain-HTTP
//    endpoint that browsers can't reach, so bytes stream through this server
//    instead (/api/files/upload and /api/files/[id]/download).
export function publicEndpoint(): string | null {
  const v = process.env.S3_PUBLIC_ENDPOINT?.trim();
  return v ? v.replace(/\/$/, "") : null;
}
export function directDelivery(): boolean {
  return publicEndpoint() !== null;
}

// Everything this app writes lives under one folder (key prefix) in the bucket,
// so web-app files are clearly separated from backups and anything else.
export const ROOT_PREFIX = process.env.S3_ROOT_PREFIX ?? "CMI Web App Files";
const root = ROOT_PREFIX ? `${ROOT_PREFIX.replace(/^\/+|\/+$/g, "")}/` : "";

// Object keys this app creates; anything else is rejected on upload.
const SCOPE_RE = /^(general|projects\/[0-9a-fA-F-]{36}|thumbs\/(general|projects\/[0-9a-fA-F-]{36}))\/[A-Za-z0-9._\- /]+$/;
export function isOwnKey(key: string): boolean {
  if (typeof key !== "string" || key.length > 512 || key.includes("..")) return false;
  if (!key.startsWith(root)) return false;
  return SCOPE_RE.test(key.slice(root.length));
}

let _client: S3Client | null = null;
let _signer: S3Client | null = null;

// Client used for presigning when the public endpoint differs from the one
// this server talks to (direct mode).
function signingClient(): S3Client {
  const pub = publicEndpoint();
  if (!pub) return client();
  if (_signer) return _signer;
  if (!storageConfigured()) throw new StorageNotConfiguredError();
  _signer = new S3Client({
    region: process.env.S3_REGION || "garage",
    endpoint: pub,
    forcePathStyle: true, // required for Garage
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
    },
  });
  return _signer;
}

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
  return `${root}${scope}/${crypto.randomUUID()}-${safeName(filename)}`;
}
export function thumbKeyFor(storageKey: string): string {
  // Mirror the object key under thumbs/ inside the same root folder.
  const rel = storageKey.startsWith(root) ? storageKey.slice(root.length) : storageKey;
  return `${root}thumbs/${rel}.jpg`;
}

// ── Single-PUT ──
export function presignPut(key: string, contentType: string) {
  return getSignedUrl(signingClient(), new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }), { expiresIn: PUT_TTL });
}
export function presignGet(key: string, downloadName?: string) {
  return getSignedUrl(signingClient(), new GetObjectCommand({
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
  return getSignedUrl(signingClient(), new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: PUT_TTL });
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

// ── Proxy mode: stream bytes through this server ──────────────────────────

/** Store a single object. `length` is required — Garage needs Content-Length. */
export async function putObjectStream(key: string, body: Readable, contentType: string, length: number): Promise<string> {
  const out = await client().send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType, ContentLength: length }));
  return (out.ETag ?? "").replace(/"/g, "");
}

/** Store one multipart part; returns its ETag for the complete step. */
export async function uploadPartStream(key: string, uploadId: string, partNumber: number, body: Readable, length: number): Promise<string> {
  const out = await client().send(new UploadPartCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId, PartNumber: partNumber, Body: body, ContentLength: length }));
  return (out.ETag ?? "").replace(/"/g, "");
}

/** Read an object back for streaming to the browser. `range` is passed through
 *  so video/audio seeking works (the browser sends "bytes=..."). */
export async function getObjectStream(key: string, range?: string | null): Promise<{
  body: ReadableStream; contentType: string | null; contentLength: number | null; contentRange: string | null;
}> {
  const out = await client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key, ...(range ? { Range: range } : {}) }));
  if (!out.Body) throw new Error("File is empty or unavailable.");
  return {
    body: out.Body.transformToWebStream(),
    contentType: out.ContentType ?? null,
    contentLength: typeof out.ContentLength === "number" ? out.ContentLength : null,
    contentRange: out.ContentRange ?? null,
  };
}
