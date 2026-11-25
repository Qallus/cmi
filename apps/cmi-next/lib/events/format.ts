// Date and place formatting for invitations, always in Arizona time. Pure, so
// the page, the export and the emails all say the same thing.

const TZ = "America/Phoenix";

function parts(iso: string) {
  const d = new Date(iso);
  return {
    day: d.toLocaleDateString("en-US", { timeZone: TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }),
    ymd: d.toLocaleDateString("en-CA", { timeZone: TZ }),
  };
}

/** "Friday, December 18, 2026 · 6:00 – 9:00 PM" (or a range across days). */
export function formatWhen(startIso: string, endIso?: string | null): string {
  if (!startIso || Number.isNaN(new Date(startIso).getTime())) return "";
  const s = parts(startIso);
  if (!endIso || Number.isNaN(new Date(endIso).getTime())) return `${s.day} · ${s.time}`;
  const e = parts(endIso);
  if (s.ymd !== e.ymd) return `${s.day} · ${s.time} – ${e.day} · ${e.time}`;
  const sameHalf = s.time.slice(-2) === e.time.slice(-2);
  return `${s.day} · ${sameHalf ? s.time.slice(0, -3) : s.time} – ${e.time}`;
}

/** "Friday, December 4, 2026" */
export function formatDay(iso: string | null | undefined): string {
  if (!iso || Number.isNaN(new Date(iso).getTime())) return "";
  return parts(iso).day;
}

/** Venue on the first line, address on the rest. */
export function splitLocation(location: string | null | undefined): { venue: string; address: string } {
  const lines = (location ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) return { venue: lines[0] ?? "", address: "" };
  return { venue: lines[0], address: lines.slice(1).join(", ") };
}

export function mapUrl(location: string | null | undefined): string {
  const q = (location ?? "").split("\n").map((l) => l.trim()).filter(Boolean).join(", ");
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}

/** Split a title around its accent phrase: "Christmas Dinner & Drinks 2026" + "2026". */
export function splitTitle(title: string, accent: string): { before: string; accent: string; after: string } {
  const a = accent.trim();
  const i = a ? title.lastIndexOf(a) : -1;
  if (i < 0) return { before: title, accent: "", after: "" };
  return { before: title.slice(0, i), accent: a, after: title.slice(i + a.length) };
}

/**
 * "2026-12-18T18:00" (Arizona local), "2026-12-18" (noon), or a full ISO
 * timestamp with an offset → ISO UTC. Null when it can't be read.
 */
export function azLocalToIso(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim();
  // An offset only counts after a time; "2026-12-18" ends in "-18" too.
  if (/T\d{2}:\d{2}.*([zZ]|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/);
  if (!m) return null;
  const d = new Date(`${m[1]}T${m[2] ?? "12:00"}:00-07:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
