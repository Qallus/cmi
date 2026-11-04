import { strict as assert } from "node:assert";
import { test } from "node:test";
import { exifTakenAt } from "./exif.ts";
import { dedupeUrls } from "./urls.ts";

// A minimal big-endian JPEG: SOI, APP1 "Exif" with IFD0 → ExifIFD → DateTimeOriginal.
function jpegWithDate(date, { le = false } = {}) {
  const tiff = [];
  const w16 = (v) => (le ? tiff.push(v & 255, v >> 8) : tiff.push(v >> 8, v & 255));
  const w32 = (v) => (le ? tiff.push(v & 255, (v >> 8) & 255, (v >> 16) & 255, v >>> 24) : tiff.push(v >>> 24, (v >> 16) & 255, (v >> 8) & 255, v & 255));
  tiff.push(...(le ? [0x49, 0x49] : [0x4d, 0x4d])); w16(42); w32(8);
  // IFD0 at 8: one entry, ExifIFD pointer → 26
  w16(1); w16(0x8769); w16(4); w32(1); w32(26); w32(0);
  // Exif IFD at 26: one entry, DateTimeOriginal ASCII(20) at 44
  w16(1); w16(0x9003); w16(2); w32(20); w32(44); w32(0);
  for (const c of `${date}\0`) tiff.push(c.charCodeAt(0));
  const app1 = [..."Exif\0\0"].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = app1.length + 2;
  return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, len >> 8, len & 255, ...app1, 0xff, 0xda, 0, 2]);
}

test("photos: EXIF DateTimeOriginal, both byte orders; no EXIF → null", () => {
  assert.equal(exifTakenAt(jpegWithDate("2026:11:04 09:38:12")), "2026-11-04T09:38:12-07:00");
  assert.equal(exifTakenAt(jpegWithDate("2026:10:21 16:05:00", { le: true })), "2026-10-21T16:05:00-07:00");
  assert.equal(exifTakenAt(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2])), null, "no APP1");
  assert.equal(exifTakenAt(new Uint8Array([0x89, 0x50, 0x4e, 0x47])), null, "PNG");
  assert.equal(exifTakenAt(jpegWithDate("0000:00:00 00:00:00")), null, "blank camera date");
});

test("photos: URLs deduped per job, ignoring empties and query strings", () => {
  assert.deepEqual(dedupeUrls(["https://x/a.jpg", "https://x/a.jpg?v=2", "", "https://x/b.jpg", "https://x/a.jpg"]), ["https://x/a.jpg", "https://x/b.jpg"]);
});
