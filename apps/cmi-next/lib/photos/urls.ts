// Photo URL helpers shared by the library and its tests. Pure.

/** The URL as the library stores it: trimmed, without a cache-busting query. */
export function photoKey(url: string): string {
  return url.trim().replace(/\?.*$/, "");
}

/** Unique, non-empty photo URLs in first-seen order. */
export function dedupeUrls(urls: (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (!u || !u.trim()) continue;
    const k = photoKey(u);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|avif)$/i;
