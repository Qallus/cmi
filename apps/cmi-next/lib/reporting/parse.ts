// Parser for the existing Weekly Workload Meeting document.
//
// The Word/PDF version is a bullet outline with three levels:
//
//   Active Project Status              ← section heading (no marker)
//   • 25_062_ Olson Casita             ← item
//     o Project Status: In Progress    ← field
//     o Issues/Action Items:
//       § Photographs – need to be scheduled   ← action item
//
// PDF text extraction keeps the bullet characters but loses indentation, so
// depth comes from the marker alone. Everything here is pure so it can be
// unit-tested against real documents.

/**
 * The section list, in meeting order — it mirrors the headings in the current
 * Word document. Lives here because the parser needs it to recognise them.
 */
export const DEFAULT_SECTIONS = [
  { key: "active_projects", title: "Active Project Status" },
  { key: "office_items", title: "Office Items" },
  { key: "warranty", title: "Warranty Jobs" },
  { key: "precon", title: "Pre-Construction / Active Budgets" },
  { key: "active_leads", title: "Active Leads Status Updates" },
  { key: "long_term_leads", title: "Long Term Lead Status Updates" },
  { key: "general", title: "General Items" },
] as const;

export type ParsedAction = { body: string; ownerLabel: string | null };

export type ParsedItem = {
  jobNumber: string | null;
  title: string;
  statusText: string | null;
  scope: string | null;
  designPartner: string | null;
  valueNote: string | null;
  originalCompletion: string | null;
  currentCompletion: string | null;
  warrantyDate: string | null;
  financialNote: string | null;
  latestUpdate: string | null;
  procurementNote: string | null;
  notes: string | null;
  actions: ParsedAction[];
};

export type ParsedSection = { key: string; title: string; items: ParsedItem[] };

export type ParsedDocument = { meetingDate: string | null; sections: ParsedSection[] };

const BULLET = /^[•▪‣]\s*/;
const SUB = /^[o○]\s+/;
const DEEP = /^[§▪–-]\s+/;
// "1." / "I." / "4.1" style lines used in the General Items section.
const NUMBERED = /^(\d+\.\d+|\d+\.|[IVX]+\.|[a-z]\.)\s+/i;
// "25_062_ Olson Casita" — a job number always starts a new project, whatever
// bullet level it was typed at (the Warranty section uses "o", not "•").
const JOB_NUMBER = /^\d{2}_\d{3}/;

/** Headings in the source document mapped onto our section keys. */
const SECTION_ALIASES: Record<string, string> = {
  "active project status": "active_projects",
  "active projects": "active_projects",
  "office items": "office_items",
  angel: "office_items",
  "warranty jobs": "warranty",
  warranty: "warranty",
  "pre-construction/design": "precon",
  "pre-construction / design": "precon",
  "active budgets / pre-construction proposals": "precon",
  "active budgets/pre-construction proposals": "precon",
  "active leads status updates": "active_leads",
  "active leads": "active_leads",
  "long term lead status updates": "long_term_leads",
  "long-term lead status updates": "long_term_leads",
  "general items": "general",
};

const KNOWN_TITLES = new Map<string, string>(DEFAULT_SECTIONS.map((s) => [s.key as string, s.title as string]));

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

/**
 * Tolerant date reader for the phrasings the document actually uses:
 * "May 22nd, 2026", "Oct 1st, 2026", "9/14/2026", "09/07/26".
 * Returns an ISO date, or null when it can't tell — the raw text is kept
 * either way so nothing is silently dropped.
 */
export function parseLooseDate(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.trim();
  if (!text) return null;

  const words = text.match(/([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/);
  if (words) {
    const month = MONTHS[words[1].toLowerCase()];
    if (month) return iso(Number(words[3]), month, Number(words[2]));
  }

  const numeric = text.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (numeric) {
    const year = Number(numeric[3]);
    return iso(year < 100 ? 2000 + year : year, Number(numeric[1]), Number(numeric[2]));
  }

  return null;
}

function iso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "section";
}

/** "25_062_ Olson Casita - $1.2M" → number, title and value. */
export function splitTitle(raw: string): { jobNumber: string | null; title: string; valueNote: string | null } {
  let text = raw.trim();
  let valueNote: string | null = null;

  // A trailing budget note, with or without a dash: "- $1.2M", "$600-$800".
  const value = text.match(/\s*[–—-]?\s*(\$[\d.,]+\s*[KkMm]?(?:\s*[–—-]\s*\$?[\d.,]+\s*[KkMm]?)?)\s*$/);
  if (value) {
    valueNote = value[1].trim();
    text = text.slice(0, value.index).trim();
  }

  let jobNumber: string | null = null;
  const numbered = text.match(/^(\d{2}_\d{3})_?\s*(.*)$/);
  if (numbered) {
    jobNumber = numbered[1];
    text = numbered[2].trim();
  }

  return { jobNumber, title: text.replace(/[\s–—-]+$/, "").trim(), valueNote };
}

/** "Stair Rail – follow up – YH" → owner initials pulled off the end. */
export function splitOwner(raw: string): ParsedAction {
  const text = raw.trim();
  const trailing = text.match(/[\s–—-]+([A-Z]{2,3}(?:\/[A-Z]{2,3})?)\s*$/);
  if (trailing) {
    return { body: text.slice(0, trailing.index).replace(/[\s–—-]+$/, "").trim(), ownerLabel: trailing[1] };
  }
  return { body: text, ownerLabel: null };
}

/** A short, capitalised, unpunctuated line — i.e. a section title, not prose. */
function looksLikeHeading(text: string): boolean {
  if (text.length > 70) return false;
  if (!/[A-Za-z]/.test(text)) return false;       // stray "§" from the PDF
  if (!/^[A-Z0-9]/.test(text)) return false;      // wrapped prose keeps lower case
  return !/[.,;)]$/.test(text);
}

function emptyItem(title: string, jobNumber: string | null, valueNote: string | null): ParsedItem {
  return {
    jobNumber, title, valueNote,
    statusText: null, scope: null, designPartner: null,
    originalCompletion: null, currentCompletion: null, warrantyDate: null,
    financialNote: null, latestUpdate: null, procurementNote: null, notes: null,
    actions: [],
  };
}

function append(current: string | null, line: string): string {
  return current ? `${current}\n${line}` : line;
}

/**
 * Parse a pasted or extracted meeting document.
 *
 * Unrecognised headings become their own section rather than being dropped, so
 * an unusual week still imports completely and can be tidied in the UI.
 */
export function parseMeetingDocument(input: string): ParsedDocument {
  const lines = input.replace(/\r\n?/g, "\n").split("\n");

  const sections: ParsedSection[] = [];
  let section: ParsedSection | null = null;
  let item: ParsedItem | null = null;
  // Which "o Label:" bucket the following § lines belong to.
  let bucket: "actions" | "procurement" | "notes" | null = null;
  // True straight after a "§" line or a bullet continuing one. Only then can a
  // "•" be a continuation rather than the next project.
  let inDetail = false;
  let meetingDate: string | null = null;

  const ensureSection = (key: string, title: string) => {
    const existing = sections.find((s) => s.key === key);
    if (existing) { section = existing; return; }
    section = { key, title, items: [] };
    sections.push(section);
  };

  const ensureItem = (): ParsedItem => {
    if (!section) ensureSection("general", KNOWN_TITLES.get("general") ?? "General Items");
    if (!item) {
      item = emptyItem("Untitled", null, null);
      section!.items.push(item);
    }
    return item;
  };

  const startItem = (body: string) => {
    const parsed = splitTitle(body);
    item = emptyItem(parsed.title || body, parsed.jobNumber, parsed.valueNote);
    bucket = null;
    inDetail = false;
    if (!section) ensureSection("general", KNOWN_TITLES.get("general") ?? "General Items");
    section!.items.push(item);
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/ /g, " ").trimEnd();
    const text = line.trim();
    if (!text) continue;
    // A bullet character alone on a line — the PDF does this where a heading
    // had an empty sub-bullet. There's nothing to record.
    if (!/[A-Za-z0-9]/.test(text)) continue;

    // The document's own date, e.g. a bare "9/14/2026" near the top.
    if (!meetingDate && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) {
      meetingDate = parseLooseDate(text);
      continue;
    }

    if (BULLET.test(text)) {
      const body = text.replace(BULLET, "").trim();
      if (!body) continue;
      // A bullet straight under a "§" line continues it ("§ Windows" → "• Frank
      // Larriva – review proposal"), unless it opens with a job number, which
      // always means the next project.
      if (inDetail && item && !JOB_NUMBER.test(body)) {
        if (bucket === "procurement") item.procurementNote = append(item.procurementNote, body);
        else if (bucket === "notes") item.notes = append(item.notes, body);
        else if (item.actions.length > 0) {
          const last = item.actions[item.actions.length - 1];
          last.body = `${last.body}\n${body}`;
        } else item.actions.push(splitOwner(body));
        continue;
      }
      startItem(body);
      continue;
    }

    if (SUB.test(text)) {
      const body = text.replace(SUB, "").trim();
      if (!body) continue;
      // Warranty entries are typed at this level but are whole projects.
      if (JOB_NUMBER.test(body)) { startItem(body); continue; }
      const current = ensureItem();
      inDetail = false;

      // "Issues/Action Items" and friends are often typed without the colon.
      const bare = body.match(/^(issues\s*\/?\s*action items|action items|issues|procurement|project notes|punchlist items|notes)\s*:?\s*$/i);
      if (bare) {
        const name = bare[1].toLowerCase();
        bucket = name === "procurement" ? "procurement"
          : name === "project notes" || name === "notes" || name === "punchlist items" ? "notes"
          : "actions";
        continue;
      }

      const labelled = body.match(/^([^:]{2,60}):\s*(.*)$/);
      const label = labelled ? labelled[1].trim().toLowerCase() : "";
      const value = labelled ? labelled[2].trim() : "";

      switch (true) {
        case label === "project status" || label === "lead status" || label === "status":
          current.statusText = value || null; bucket = null; break;
        case label === "scope":
          current.scope = value || null; bucket = null; break;
        case label === "design partner":
          current.designPartner = value || null; bucket = null; break;
        case label === "original completion date":
          current.originalCompletion = value || null; bucket = null; break;
        case label === "current completion date":
          current.currentCompletion = value || null; bucket = null; break;
        case label.startsWith("substantial completion"):
          current.warrantyDate = value || null; bucket = null; break;
        case label === "financial":
          current.financialNote = value || null; bucket = null; break;
        case label.startsWith("issues") || label === "action items" || label === "issues/action items":
          bucket = "actions";
          if (value) current.actions.push(splitOwner(value));
          break;
        case label === "procurement":
          bucket = "procurement";
          if (value) current.procurementNote = append(current.procurementNote, value);
          break;
        case label === "project notes" || label === "notes" || label === "punchlist items" || label.startsWith("pre-con proposal"):
          bucket = "notes";
          if (value) current.notes = append(current.notes, value);
          break;
        default:
          // An unlabelled line is the narrative update for the project.
          bucket = null;
          current.latestUpdate = append(current.latestUpdate, body);
      }
      continue;
    }

    if (DEEP.test(text)) {
      const body = text.replace(DEEP, "").trim();
      if (!body) continue;
      const current = ensureItem();
      inDetail = true;
      if (bucket === "procurement") current.procurementNote = append(current.procurementNote, body);
      else if (bucket === "notes") current.notes = append(current.notes, body);
      else current.actions.push(splitOwner(body));
      continue;
    }

    if (NUMBERED.test(text)) {
      const body = text.replace(NUMBERED, "").trim();
      if (!body) continue;
      if (!section) ensureSection("general", KNOWN_TITLES.get("general") ?? "General Items");
      item = emptyItem(body, null, null);
      bucket = null;
      inDetail = false;
      section!.items.push(item);
      continue;
    }

    // A line at column zero is usually a heading — but PDF extraction also
    // drops the tail of a wrapped bullet there ("complete.", "fees may apply)"),
    // so those fold back into the item they came from instead of inventing a
    // section.
    if (!looksLikeHeading(text)) {
      if (item) item.latestUpdate = append(item.latestUpdate, text);
      continue;
    }

    const key = SECTION_ALIASES[text.toLowerCase().replace(/\s+/g, " ")] ?? slug(text);
    ensureSection(key, KNOWN_TITLES.get(key) ?? text);
    item = null;
    bucket = null;
    inDetail = false;
  }

  return { meetingDate, sections: sections.filter((s) => s.items.length > 0) };
}
