// When a photo was taken, from its EXIF (JPEG only): DateTimeOriginal, else
// DateTime. Pure and tiny, so the Photos library doesn't need a dependency.
// Phone cameras write local time with no zone; jobs are in Arizona (UTC−7, no
// daylight saving), so the result is stamped -07:00.

export function exifTakenAt(bytes: Uint8Array): string | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 <= bytes.length) {
    if (bytes[p] !== 0xff) return null;
    const marker = bytes[p + 1];
    const len = (bytes[p + 2] << 8) | bytes[p + 3];
    if (marker === 0xda || marker === 0xd9) return null; // image data: no EXIF before it
    if (marker === 0xe1 && len > 8 && ascii(bytes, p + 4, 6) === "Exif\0\0") return fromTiff(bytes, p + 10, Math.min(bytes.length, p + 2 + len));
    p += 2 + len;
  }
  return null;
}

function ascii(b: Uint8Array, at: number, n: number): string {
  let s = "";
  for (let i = 0; i < n && at + i < b.length; i++) s += String.fromCharCode(b[at + i]);
  return s;
}

function fromTiff(b: Uint8Array, t: number, end: number): string | null {
  const le = ascii(b, t, 2) === "II";
  if (!le && ascii(b, t, 2) !== "MM") return null;
  const u16 = (o: number) => (o + 2 > end ? -1 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o: number) => (o + 4 > end ? -1 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const readIfd = (off: number): Map<number, number> => {
    const tags = new Map<number, number>();
    const at = t + off, n = u16(at);
    if (n < 0 || n > 500) return tags;
    for (let i = 0; i < n; i++) {
      const e = at + 2 + i * 12;
      const tag = u16(e);
      if (tag < 0) break;
      tags.set(tag, e);
    }
    return tags;
  };
  const dateAt = (entry: number | undefined): string | null => {
    if (entry == null) return null;
    const count = u32(entry + 4), off = u32(entry + 8);
    if (count < 19 || off < 0 || t + off + 19 > end) return null;
    const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(ascii(b, t + off, 19));
    if (!m || m[1] === "0000") return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}-07:00`;
  };
  const first = u32(t + 4);
  if (first < 0) return null;
  const ifd0 = readIfd(first);
  const exifPtr = ifd0.get(0x8769);
  if (exifPtr != null) {
    const exif = readIfd(u32(exifPtr + 8));
    const d = dateAt(exif.get(0x9003)) ?? dateAt(exif.get(0x9004));
    if (d) return d;
  }
  return dateAt(ifd0.get(0x0132));
}
