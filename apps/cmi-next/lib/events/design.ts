// Event invitation design + RSVP input normalisation. Pure (no I/O, no path
// aliases) so it's unit-tested and shared by the API, the builder, Bolt and the
// Claude connector. Anything a client sends goes through these first.

import { DEFAULT_THEME_ID, isThemeId } from "./themes.ts";

export type GuestListMode = "full" | "first" | "count" | "off";
export type GoodToKnowRow = { label: string; value: string; url?: string };

export type EventDesign = {
  theme: string;
  /** Small line over the title, e.g. "Constructed Matter · You're invited". */
  eyebrow: string;
  /** Part of the title shown in the accent colour, e.g. "2026". */
  title_accent: string;
  message_heading: string;
  message_body: string;
  /** Sign-off lines, e.g. "Merry Christmas,\nBrandon & Joe". */
  signoff: string;
  /** Optional note above the RSVP buttons (e.g. how to RSVP by text instead). */
  rsvp_note: string;
  good_to_know: GoodToKnowRow[];
  guest_list: GuestListMode;
  dietary: boolean;
  /** Closing line in the footer, e.g. "Thank you for an incredible 2026." */
  footer_note: string;
  /** Optional photo shown in the message card. */
  image_url: string;
};

export const DESIGN_DEFAULTS: EventDesign = {
  theme: DEFAULT_THEME_ID,
  eyebrow: "Constructed Matter · You're invited",
  title_accent: "",
  message_heading: "",
  message_body: "",
  signoff: "",
  rsvp_note: "",
  good_to_know: [],
  guest_list: "full",
  dietary: true,
  footer_note: "",
  image_url: "",
};

export const LIMITS = {
  short: 160,
  long: 4000,
  rows: 12,
  customHtmlBytes: 500_000,
  name: 120,
  notes: 1000,
};

const GUEST_MODES: GuestListMode[] = ["full", "first", "count", "off"];

function text(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return v.replace(/\r\n/g, "\n").trim().slice(0, max);
}

/** Only http(s) and mailto/tel links survive. */
export function safeUrl(v: unknown): string {
  const s = text(v, 2000);
  if (!s) return "";
  return /^(https?:\/\/|mailto:|tel:)/i.test(s) ? s : "";
}

/**
 * Merge a (possibly partial, possibly hostile) design patch over an existing
 * design. Unknown keys are dropped; strings are trimmed and capped.
 */
export function normalizeDesign(patch: unknown, base: Partial<EventDesign> = DESIGN_DEFAULTS): EventDesign {
  const b: EventDesign = { ...DESIGN_DEFAULTS, ...(base ?? {}) };
  const p = (patch && typeof patch === "object" ? patch : {}) as Record<string, unknown>;
  const has = (k: string) => Object.prototype.hasOwnProperty.call(p, k);
  const out: EventDesign = { ...b };

  if (has("theme")) out.theme = isThemeId(p.theme) ? (p.theme as string) : b.theme;
  for (const k of ["eyebrow", "title_accent", "message_heading", "footer_note"] as const) {
    if (has(k)) out[k] = text(p[k], LIMITS.short);
  }
  for (const k of ["message_body", "signoff", "rsvp_note"] as const) {
    if (has(k)) out[k] = text(p[k], LIMITS.long);
  }
  if (has("image_url")) out.image_url = safeUrl(p.image_url);
  if (has("guest_list")) out.guest_list = GUEST_MODES.includes(p.guest_list as GuestListMode) ? (p.guest_list as GuestListMode) : b.guest_list;
  if (has("dietary")) out.dietary = Boolean(p.dietary);
  if (has("good_to_know")) {
    const rows = Array.isArray(p.good_to_know) ? p.good_to_know : [];
    out.good_to_know = rows
      .slice(0, LIMITS.rows)
      .map((r) => {
        const row = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
        const url = safeUrl(row.url);
        return { label: text(row.label, 40), value: text(row.value, LIMITS.short * 2), ...(url ? { url } : {}) };
      })
      .filter((r) => r.label || r.value);
  }
  if (!isThemeId(out.theme)) out.theme = DEFAULT_THEME_ID;
  return out;
}

export type RsvpStatus = "attending" | "declined";

export type RsvpInput = {
  name: string;
  email: string;
  phone: string;
  status: RsvpStatus;
  plus_one: boolean;
  plus_one_name: string;
  notes: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isRsvpToken(v: unknown): v is string {
  return typeof v === "string" && /^[a-f0-9]{32}$/.test(v);
}

/**
 * Validate an RSVP form. `needIdentity` is true for open-link RSVPs, where we
 * need a name and email to know who it is; a personal link already knows.
 */
export function parseRsvpInput(
  body: unknown,
  opts: { needIdentity: boolean; allowPlusOne: boolean },
): { ok: true; value: RsvpInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const status = b.status;
  if (status !== "attending" && status !== "declined") return { ok: false, error: "Choose whether you'll be there." };
  const name = text(b.name, LIMITS.name);
  const email = text(b.email, 200).toLowerCase();
  if (opts.needIdentity) {
    if (!name) return { ok: false, error: "Please add your name." };
    if (!EMAIL_RE.test(email)) return { ok: false, error: "Please add a valid email so you can change your RSVP later." };
  } else if (email && !EMAIL_RE.test(email)) {
    return { ok: false, error: "That email doesn't look right." };
  }
  const attending = status === "attending";
  const plusOne = attending && opts.allowPlusOne && Boolean(b.plus_one);
  return {
    ok: true,
    value: {
      name,
      email,
      phone: text(b.phone, 40),
      status,
      plus_one: plusOne,
      plus_one_name: plusOne ? text(b.plus_one_name, LIMITS.name) : "",
      notes: text(b.notes, LIMITS.notes),
    },
  };
}

export type GuestRow = { name: string; status: string; plus_one: boolean };

/** What the public "Who's coming" list shows, per the event's setting. */
export function publicGuestList(rows: GuestRow[], mode: GuestListMode): { count: number; names: { name: string; plus_one: boolean }[] } {
  const coming = rows.filter((r) => r.status === "attending");
  const count = coming.reduce((n, r) => n + 1 + (r.plus_one ? 1 : 0), 0);
  if (mode === "off" || mode === "count") return { count, names: [] };
  const names = coming
    .map((r) => {
      const n = r.name.trim();
      return { name: mode === "first" ? n.split(/\s+/)[0] : n, plus_one: r.plus_one };
    })
    .filter((r) => r.name)
    .sort((a, b) => a.name.localeCompare(b.name));
  return { count, names };
}

/** Headcount summary for staff. */
export function rsvpCounts(rows: { status: string; plus_one: boolean }[]) {
  let attending = 0, declined = 0, waiting = 0, plusOnes = 0;
  for (const r of rows) {
    if (r.status === "attending") { attending++; if (r.plus_one) plusOnes++; }
    else if (r.status === "declined") declined++;
    else waiting++;
  }
  return { attending, declined, waiting, plusOnes, headcount: attending + plusOnes, invited: rows.length };
}
