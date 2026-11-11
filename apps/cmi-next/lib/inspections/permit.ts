// Inspection milestones, Step 5: the permit list wins. The PM pastes the
// inspection list printed on the permit; it's compared with the inspection
// milestones already on the schedule. Pure (no I/O), so the dialog, the API
// and the tests agree.
//   matched       the milestone takes the permit's name and code
//   scheduleOnly  on the schedule, not on the permit: suggested N/A
//   permitOnly    on the permit, not on the schedule: suggested as a new milestone
import { milestoneKey } from "./plan.ts";

export type PermitLine = { n: number; code: string | null; name: string; raw: string };
export type PermitItem = { id: string; title: string; inspection_step_id: string | null; inspection_code: string | null; inspection_status: string | null; status?: string | null };
export type PermitMatch = { line: PermitLine; items: PermitItem[]; by: "code" | "name" };
export type Reconcile = { lines: PermitLine[]; matched: PermitMatch[]; scheduleOnly: PermitItem[]; permitOnly: PermitLine[] };

const HEADER = /^(inspections?|code|type|description|inspection (type|code|name)|required inspections?|#|no\.?)$/i;
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9/ ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * One inspection per line, in whatever shape the permit prints it:
 * "615 Footing", "Footing (615)", "615 - Footing / UFER", "615⇥Footing", "Code 615: Footing".
 * Lines without a number keep just the name ("Final building").
 */
export function parsePermitList(text: string): PermitLine[] {
  const out: PermitLine[] = [];
  for (const raw0 of (text ?? "").split(/\r?\n/)) {
    const raw = raw0.trim();
    if (!raw) continue;
    // List markers: "- ", "• ", "1. ", "2) " (not a 3–4 digit inspection code).
    const bullet = raw.replace(/^(?:[-*••]|\d{1,2}[.)])\s+/, "");
    const m = bullet.match(/\b(\d{3,4}[A-Z]?)\b/);
    const code = m ? m[1] : null;
    let name = code ? bullet.replace(m![0], " ") : bullet;
    name = name.replace(/\b(code|insp(ection)?\s*(#|no\.?|code)?)\s*[:#]?\s*$/i, " ")
      .replace(/^\s*(code|insp(ection)?\s*(#|no\.?)?)\s*[:#-]?\s*/i, "")
      // Separators between code and name ("615 - Footing", "615: Footing", tabs), not hyphens inside words ("Pre-Slab").
      .replace(/[()[\]]/g, " ").replace(/\t|\s[-–—:|]\s|^\s*[-–—:|,]\s*|\s*[-–—:|,]\s*$|[:|,](?=\s)/g, " ").replace(/\s+/g, " ").trim();
    if (!name && !code) continue;
    if (!code && HEADER.test(name)) continue;
    if (name && /^(code\s+)?description$/i.test(name)) continue;
    out.push({ n: out.length + 1, code, name: name || `Inspection ${code}`, raw });
  }
  return out;
}

const codesOf = (c: string | null | undefined): string[] => (c ?? "").match(/\d{3,4}[A-Z]?/g) ?? [];
const words = (s: string) => new Set(norm(s).split(" ").filter((w) => w.length > 2 && !["and", "the", "inspection", "insp", "final"].includes(w)));
function similar(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return false;
  let both = 0; for (const w of wa) if (wb.has(w)) both++;
  const finalA = /\bfinal\b/i.test(a), finalB = /\bfinal\b/i.test(b);
  return finalA === finalB && both / Math.min(wa.size, wb.size) >= 0.6;
}

/** Inspections on the schedule (permit / contract and internal-check milestones have no inspection status). */
export const isInspection = (i: PermitItem) => !!i.inspection_step_id && !!i.inspection_status && i.status !== "cancelled";

/** Compare the permit's list with the schedule's inspections: by code first, then by name. */
export function reconcile(lines: PermitLine[], items: PermitItem[]): Reconcile {
  const pool = items.filter(isInspection);
  const used = new Set<string>();
  const matched: PermitMatch[] = [];
  const left: PermitLine[] = [];
  // Copies of one library row ("Footing (1 of 2)") move together.
  const siblings = (it: PermitItem) => pool.filter((p) => !used.has(p.id) && p.inspection_step_id === it.inspection_step_id);
  const take = (line: PermitLine, hit: PermitItem, by: PermitMatch["by"]) => {
    const group = siblings(hit);
    for (const g of group) used.add(g.id);
    matched.push({ line, items: group, by });
  };
  for (const line of lines) {
    const byCode = line.code ? pool.find((p) => !used.has(p.id) && codesOf(p.inspection_code).includes(line.code!)) : undefined;
    if (byCode) take(line, byCode, "code"); else left.push(line);
  }
  const permitOnly: PermitLine[] = [];
  for (const line of left) {
    const byName = pool.find((p) => !used.has(p.id) && similar(milestoneKey(p.title), line.name));
    if (byName) take(line, byName, "name"); else permitOnly.push(line);
  }
  matched.sort((a, b) => a.line.n - b.line.n);
  return { lines, matched, scheduleOnly: pool.filter((p) => !used.has(p.id)), permitOnly };
}

/** The milestone's new title from the permit line, keeping its prefix and copy number. */
export function permitTitle(current: string, line: PermitLine): string {
  const prefix = current.match(/^(INSP|MS|CHK)\s*·\s*/i)?.[0] ?? "INSP · ";
  const copy = current.match(/\s\((\d+) of (\d+)\)$/)?.[0] ?? "";
  return `${prefix}${line.name}${line.code ? ` (${line.code})` : ""}${copy}`;
}

/** A stable step ID for a permit-only inspection, so it's treated like a library row. */
export function permitStepId(line: PermitLine): string {
  const slug = norm(line.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);
  return `PERMIT-${line.code ?? (slug || String(line.n))}`.toUpperCase();
}
