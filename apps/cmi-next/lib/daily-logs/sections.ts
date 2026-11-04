// Field Reports (plan: docs/features/field-reports/field-reports-plan.md).
// The structured body of a daily log: one standard template, filled from
// dictation, typing and photos through the day. Pure, so the server, the
// review screen and the tests share it.

export const SECTION_KEYS = [
  "work", "onsite", "deliveries", "inspections", "delays", "safety",
  "equipment", "visitors", "lookahead", "actions", "internal",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

export const SECTION_LABELS: Record<SectionKey, string> = {
  work: "Work completed",
  onsite: "On site",
  deliveries: "Deliveries",
  inspections: "Inspections",
  delays: "Delays & issues",
  safety: "Safety",
  equipment: "Equipment",
  visitors: "Visitors",
  lookahead: "Look-ahead",
  actions: "Action items",
  internal: "Internal notes",
};

/** Kept out of a client Executive Summary as written (Bolt may still describe
 *  them in client-ready words, and a person can add an item back). */
export const INTERNAL_SECTIONS: readonly SectionKey[] = ["onsite", "delays", "actions", "internal"];

export type LogItem = {
  id: string;
  section: SectionKey;
  text: string;
  /** ☆ — lead with this in the Executive Summary. */
  star?: boolean;
  source?: "dictated" | "typed" | "photo";
  at?: string;
  // On site (crew and hours are optional, never required)
  company?: string | null;
  trade?: string | null;
  crew?: number | null;
  hours?: number | null;
  // Inspections
  result?: string | null;
  // Delays
  impact?: string | null;
  // Action items
  owner?: string | null;
  due?: string | null;
  /** The internal commitment made from this action item on Submit. */
  commitment_id?: string | null;
};

/** What was said or typed, kept word for word for the record. */
export type RawCapture = { at: string; text: string; audio_url?: string | null; by?: string | null; unsorted?: boolean };

export type LogSections = { items: LogItem[]; raw: RawCapture[] };

export function emptySections(): LogSections {
  return { items: [], raw: [] };
}

let seq = 0;
export function newItemId(): string {
  seq = (seq + 1) % 1e6;
  return `i${Date.now().toString(36)}${seq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const str = (v: unknown, max = 600) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const isoDate = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null);

/** One item from anywhere (the model, the review screen) made safe. Null when unusable. */
export function cleanItem(raw: unknown, fallbackSection: SectionKey = "work"): LogItem | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const text = str(r.text, 1000);
  const section = (SECTION_KEYS as readonly string[]).includes(String(r.section)) ? (r.section as SectionKey) : fallbackSection;
  const company = str(r.company, 120);
  if (!text && !(section === "onsite" && company)) return null;
  const item: LogItem = { id: str(r.id, 40) ?? newItemId(), section, text: text ?? company ?? "" };
  if (r.star === true) item.star = true;
  if (r.source === "dictated" || r.source === "typed" || r.source === "photo") item.source = r.source;
  if (str(r.at, 40)) item.at = str(r.at, 40)!;
  if (section === "onsite") {
    item.company = company; item.trade = str(r.trade, 80);
    item.crew = num(r.crew); item.hours = num(r.hours);
  }
  if (section === "inspections") item.result = str(r.result, 200);
  if (section === "delays") item.impact = str(r.impact, 300);
  if (section === "actions") {
    item.owner = str(r.owner, 120); item.due = isoDate(r.due);
    if (str(r.commitment_id, 60)) item.commitment_id = str(r.commitment_id, 60);
  }
  return item;
}

/** Whatever is stored (or sent) as sections, made safe. */
export function normalizeSections(raw: unknown): LogSections {
  if (!raw || typeof raw !== "object") return emptySections();
  const r = raw as Record<string, unknown>;
  const items = (Array.isArray(r.items) ? r.items : []).map((i) => cleanItem(i)).filter(Boolean) as LogItem[];
  const caps = (Array.isArray(r.raw) ? r.raw : []).flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const x = c as Record<string, unknown>;
    const text = str(x.text, 20_000);
    if (!text) return [];
    return [{ at: str(x.at, 40) ?? new Date().toISOString(), text, audio_url: str(x.audio_url, 1000), by: str(x.by, 120), ...(x.unsorted === true ? { unsorted: true } : {}) } as RawCapture];
  });
  return { items: items.slice(0, 400), raw: caps.slice(0, 100) };
}

const key = (i: Pick<LogItem, "section" | "text">) => `${i.section}|${i.text.toLowerCase().replace(/\s+/g, " ").trim()}`;

/** A capture appended to the day's log: new items in, exact repeats skipped. */
export function mergeCapture(current: LogSections, add: { items?: LogItem[]; raw?: RawCapture | null }): LogSections {
  const seen = new Set(current.items.map(key));
  const items = [...current.items];
  for (const i of add.items ?? []) {
    if (seen.has(key(i))) continue;
    seen.add(key(i));
    items.push(i);
  }
  return { items, raw: add.raw ? [...current.raw, add.raw] : current.raw };
}

export type ReviewFlag = { key: string; text: string; itemId?: string; section?: SectionKey };

/** What a superintendent should look at before submitting. */
export function needsALook(s: LogSections): ReviewFlag[] {
  const flags: ReviewFlag[] = [];
  const of = (k: SectionKey) => s.items.filter((i) => i.section === k);
  const anyWork = s.items.some((i) => i.section === "work" || i.section === "onsite");
  if (anyWork && !of("safety").length) flags.push({ key: "no-safety", section: "safety", text: "No safety note yet. Add one, even \"No incidents.\"" });
  for (const i of of("inspections")) if (!i.result) flags.push({ key: `insp-${i.id}`, itemId: i.id, section: "inspections", text: `Inspection without a result: "${i.text.slice(0, 60)}"` });
  for (const i of of("delays")) if (!i.impact) flags.push({ key: `delay-${i.id}`, itemId: i.id, section: "delays", text: `Delay without an impact (time or what it holds up): "${i.text.slice(0, 60)}"` });
  for (const i of of("onsite")) if (!i.trade) flags.push({ key: `trade-${i.id}`, itemId: i.id, section: "onsite", text: `On site without a trade: ${i.company ?? i.text}` });
  for (const i of of("actions")) if (!i.owner) flags.push({ key: `owner-${i.id}`, itemId: i.id, section: "actions", text: `Action item without an owner: "${i.text.slice(0, 60)}"` });
  if (s.raw.some((r) => r.unsorted)) flags.push({ key: "unsorted", text: "Some dictation couldn't be sorted automatically. Check Work completed." });
  return flags;
}

/** Items a client summary may use as written, and the ones kept internal
 *  (internal sections, unless their id was added back). Starred first. */
export function clientSafeItems(s: LogSections, addedBack: Iterable<string> = []): { client: LogItem[]; internal: LogItem[] } {
  const back = new Set(addedBack);
  const client: LogItem[] = [], internal: LogItem[] = [];
  for (const i of s.items) ((INTERNAL_SECTIONS.includes(i.section) && !back.has(i.id)) ? internal : client).push(i);
  const starFirst = (a: LogItem, b: LogItem) => Number(!!b.star) - Number(!!a.star);
  return { client: client.sort(starFirst), internal: internal.sort(starFirst) };
}

/** Plain text of a log for search, titles and the legacy notes column. */
export function sectionsText(s: LogSections): string {
  return SECTION_KEYS.flatMap((k) => {
    const items = s.items.filter((i) => i.section === k);
    if (!items.length) return [];
    return [`${SECTION_LABELS[k]}: ${items.map((i) => i.section === "onsite" ? [i.company, i.trade].filter(Boolean).join(" – ") || i.text : i.text).join("; ")}`];
  }).join("\n");
}
