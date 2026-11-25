// A small in-process limiter for the public RSVP endpoint. One app container,
// so memory is enough; it only has to stop a script hammering the form.

const hits = new Map<string, number[]>();

export function allowRequest(key: string, max = 20, windowMs = 10 * 60_000, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
  }
  return true;
}
