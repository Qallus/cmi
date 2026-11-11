// Builds the inspection library seed migration from Brandon's workbook.
//
//   node scripts/import-inspection-library.mjs <workbook.xlsx> supabase/migrations/2026-11-11_inspection_milestones_seed.sql
//
// Reads the "Milestone Library" tab (the source of truth) and the "Work Task
// Hooks" tab (column D = the CMI template task each hook maps to), and writes
// an idempotent SQL file: re-running it with a later revision of the workbook
// updates rows in place, keyed by milestone ID (e.g. SCOT-M07). Jurisdiction
// details (scheduling method, cutoffs) come from the reference doc and are set
// below; edit them here when a jurisdiction confirms a cutoff.
import ExcelJS from "exceljs";
import { writeFileSync } from "node:fs";

const [, , SRC, OUT] = process.argv;
if (!SRC || !OUT) {
  console.error("usage: node scripts/import-inspection-library.mjs <workbook.xlsx> <out.sql>");
  process.exit(1);
}
const VERIFIED_ON = "2026-11-09"; // "Researched Nov 9, 2026" in the workbook

// cutoff_minutes: minutes after midnight on the business day before the
// inspection (1440 = midnight). null = not published, confirm with the jurisdiction.
const JURISDICTIONS = [
  { code: "SCOT", name: "City of Scottsdale", sort: 1, method: "Scottsdale SPUR portal for permits started after Jan 6, 2026 (permit → Inspections → Request Inspection). Older permits: legacy eServices with the permit-receipt keycode and the code from the Inspection Code Lookup, or the QR code on the permit card.", portal_url: null, phone: "480-312-5750", cutoff_minutes: null, cutoff_label: "Pick the date in SPUR", hours: "Apr–Oct 6:00 AM–2:30 PM · Nov–Mar 7:00 AM–3:30 PM", notes: "Fire & life safety: 480-312-1855. Call the area inspector the morning of for an ETA (6:00–6:30 AM Apr–Oct, 7:00–7:30 AM Nov–Mar)." },
  { code: "PHX", name: "City of Phoenix", sort: 2, method: "IVR (602) 495-0800 (permit number, address, inspection type; stay on for the confirmation number) or online with the permit number + Web Inspection Key, up to 5 inspections per request on one permit. New residential applications use SHAPE PHX.", portal_url: null, phone: "602-495-0800", cutoff_minutes: 21 * 60, cutoff_label: "9:00 PM (Mon–Fri) for the next workday", hours: null, notes: "Overflow carryovers are auto-rescheduled to the next working day with priority. Remote video inspections available for many home projects." },
  { code: "PV", name: "Town of Paradise Valley", sort: 3, method: "Accela Citizen Access portal or by text per the Town inspection list. A confirmation number is required: no number, not scheduled.", portal_url: "https://aca-prod.accela.com/PARADISEVLY", phone: "480-348-3692", cutoff_minutes: 15 * 60, cutoff_label: "3:00 PM for the next business day", hours: "Oct–Apr 7:00 AM–3:00 PM · May–Sep 6:00 AM–3:00 PM", notes: "Ladder for grout inspections 8 ft and higher and for roof nailing / shear. ROW permits need a pre-con with Engineering (480-348-3681)." },
  { code: "MESA", name: "City of Mesa", sort: 4, method: "DIMES (Accela) online; text 480-644-2428 \"S PMT-XXXX Code MM/DD/YYYY\" (RS = reschedule, C = cancel); or the 24-hour phone line.", portal_url: null, phone: "480-644-2428", cutoff_minutes: null, cutoff_label: "Next business day (exact cutoff to confirm)", hours: "Mon–Fri 6:30 AM–5:00 PM", notes: "Results emailed from noreply@mesaaz.gov. Meter set after final: 480-644-2221. Permit void if no inspection within 180 days." },
  { code: "TMP", name: "City of Tempe", sort: 5, method: "24-hour IVR or the Citizen Access Portal; up to two weeks ahead, only after the permit is issued and work has started.", portal_url: null, phone: "480-350-8341", cutoff_minutes: 24 * 60, cutoff_label: "Midnight for the next business day", hours: "6:30 AM–3:30 PM business days", notes: "ETA line 480-350-8341, call 6:00–6:30 AM the morning of." },
  { code: "CHD", name: "City of Chandler", sort: 6, method: "Text 844-281-3520 \"S [permit #] [code] [date]\" (C = cancel, RESCHED, RESULT); IVR 480-782-3100; or Accela online.", portal_url: "https://aca-prod.accela.com/CHANDLER", phone: "480-782-3000", cutoff_minutes: null, cutoff_label: "Not published (confirm with Development Services)", hours: null, notes: null },
  { code: "CC", name: "Town of Cave Creek", sort: 7, method: "By phone; the Town also runs an online Citizen Portal (iWorQ). Confirm online scheduling with the Town.", portal_url: null, phone: "480-488-1400", cutoff_minutes: null, cutoff_label: "Not published (confirm with the Town)", hours: null, notes: "Fire sprinklers: Rural Metro (schedule separately). Septic: Maricopa County Environmental Services. Both approvals needed before final." },
  { code: "CF", name: "Town of Carefree", sort: 8, method: "Town SmartGov portal; scheduling method not published (confirm with the Building Department).", portal_url: "https://twn-carefree-az.smartgovcommunity.com", phone: "480-488-3686", cutoff_minutes: null, cutoff_label: "Not published (confirm with the Building Department)", hours: null, notes: "Surveyor and engineer certifications: pre-grading fence as-built, setbacks and finished floor before the pour, height at framing, engineer's completion letter. Rural Metro and County septic approvals before final." },
  { code: "MCO", name: "Maricopa County (unincorporated)", sort: 9, method: "Permit Center portal: permit → Inspections tab → check the inspection → Request Inspection → date → on-site contact and gate code in Comments. Prerequisites are enforced in the portal.", portal_url: null, phone: "602-506-7170", cutoff_minutes: 15 * 60 + 30, cutoff_label: "3:30 PM (online) for the next business day", hours: null, notes: "Two tracks: Final Drainage (Engineering) must pass before Building Final, not the same day. Call Center 602-506-3301." },
];

const cell = (c) => {
  const x = c.value;
  if (x == null) return "";
  if (typeof x === "object") return x.richText ? x.richText.map((r) => r.text).join("") : String(x.result ?? x.text ?? "");
  return String(x);
};
const q = (v) => (v == null || v === "" ? "null" : `'${String(v).trim().replace(/'/g, "''")}'`);
const blank = (v) => (v === "—" || v === "-" ? "" : v);

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(SRC);

// ── Milestone Library (header on row 5) ──
const lib = wb.getWorksheet("Milestone Library");
const head = [];
lib.getRow(5).eachCell({ includeEmpty: true }, (c, i) => { head[i] = cell(c).trim(); });
const col = (name) => {
  // Exact header first ("Phase" vs "Phase ID", "Code" vs "Code basis"), then a prefix.
  const lower = name.toLowerCase();
  let i = head.findIndex((h) => h && h.toLowerCase() === lower);
  if (i < 0) i = head.findIndex((h) => h && h.toLowerCase().startsWith(lower));
  if (i < 0) throw new Error(`Milestone Library: no column "${name}"`);
  return i;
};
const C = {
  id: col("Milestone ID"), phaseId: col("Phase ID"), phase: col("Phase"), step: col("Prior doc step"),
  gantt: col("Schedule item name"), jname: col("Jurisdiction inspection name"), code: col("Code"), basis: col("Code basis"),
  mtype: col("Milestone type"), dur: col("Duration"), new: col("NEW"), add: col("ADD"), ren: col("REN"),
  when: col("Include when"), pred: col("Predecessor work task"), rel: col("Releases work task"), hold: col("Hold point"),
  rule: col("Request rule"), check: col("Ready-to-call"), repeats: col("Repeats"), master: col("Show on Master"), notes: col("Notes"),
};
const codes = new Set(JURISDICTIONS.map((j) => j.code));
const rows = [];
lib.eachRow((row, n) => {
  if (n <= 5) return;
  const g = (k) => cell(row.getCell(C[k])).trim();
  const id = g("id");
  const m = /^([A-Z]+)-M\d+$/.exec(id);
  if (!m) return;
  if (!codes.has(m[1])) throw new Error(`${id}: unknown jurisdiction prefix ${m[1]}`);
  const mtype = g("mtype").toLowerCase();
  if (!["inspection", "internal", "contract"].includes(mtype)) throw new Error(`${id}: milestone type "${g("mtype")}"`);
  if (Number(g("dur") || 0) !== 0) throw new Error(`${id}: duration ${g("dur")} (milestones are 0)`);
  rows.push({
    id, j: m[1], sort: rows.length + 1, phaseId: g("phaseId"), phase: g("phase"), step: blank(g("step")), gantt: g("gantt"), jname: g("jname"),
    code: blank(g("code")), basis: g("basis"), mtype, sNew: g("new"), sAdd: g("add"), sRen: g("ren"), when: g("when"),
    pred: g("pred"), rel: g("rel"), hold: g("hold").toUpperCase() === "Y", rule: g("rule"), check: g("check"),
    repeats: g("repeats"), master: g("master"), notes: g("notes"),
  });
});

// ── Work Task Hooks (header on row 5; column D = CMI template task) ──
const hooksWs = wb.getWorksheet("Work Task Hooks");
const hooks = [];
hooksWs.eachRow((row, n) => {
  if (n <= 5) return;
  const phase = cell(row.getCell(1)).trim();
  const hook = cell(row.getCell(2)).trim();
  if (!/^P\d\d$/.test(phase) || !hook) return;
  const role = cell(row.getCell(3)).trim().toLowerCase().startsWith("released") ? "released" : "predecessor";
  const raw = cell(row.getCell(4)).trim();
  const kind = !raw ? "unmapped" : raw.startsWith("ADD:") ? "add" : raw.startsWith("MILESTONE:") ? "milestone" : "task";
  const target = raw.replace(/^(ADD|MILESTONE):\s*/, "");
  hooks.push({ phase, hook, role, kind, target });
});

// ── SQL ──
const out = [];
out.push(`-- Inspection library seed, generated by scripts/import-inspection-library.mjs`);
out.push(`-- from ${SRC.split(/[\\/]/).pop()} (${rows.length} milestones, ${hooks.length} task hooks).`);
out.push(`-- Idempotent: re-run with a later workbook revision to update rows in place.`);
out.push(``);
out.push(`insert into public.inspection_jurisdictions (code, name, sort_order, scheduling_method, portal_url, phone, cutoff_minutes, cutoff_label, inspection_hours, notes, verified_on) values`);
out.push(JURISDICTIONS.map((j) => `  (${q(j.code)}, ${q(j.name)}, ${j.sort}, ${q(j.method)}, ${q(j.portal_url)}, ${q(j.phone)}, ${j.cutoff_minutes ?? "null"}, ${q(j.cutoff_label)}, ${q(j.hours)}, ${q(j.notes)}, ${q(VERIFIED_ON)})`).join(",\n"));
out.push(`on conflict (code) do update set name = excluded.name, sort_order = excluded.sort_order, scheduling_method = excluded.scheduling_method, portal_url = excluded.portal_url, phone = excluded.phone, cutoff_minutes = excluded.cutoff_minutes, cutoff_label = excluded.cutoff_label, inspection_hours = excluded.inspection_hours, notes = excluded.notes, verified_on = excluded.verified_on, updated_at = now();`);
out.push(``);
out.push(`insert into public.inspection_library (milestone_id, jurisdiction_code, sort_order, phase_id, phase, doc_step, gantt_name, jurisdiction_name, code, code_basis, milestone_type, scope_new, scope_add, scope_ren, include_when, predecessor_hook, released_hook, hold_point, request_rule, ready_checklist, repeats, show_on_master, notes, verified_on) values`);
out.push(rows.map((r) => `  (${[q(r.id), q(r.j), r.sort, q(r.phaseId), q(r.phase), q(r.step), q(r.gantt), q(r.jname), q(r.code), q(r.basis), q(r.mtype), q(r.sNew), q(r.sAdd), q(r.sRen), q(r.when), q(r.pred), q(r.rel), r.hold, q(r.rule), q(r.check), q(r.repeats), q(r.master), q(r.notes), q(VERIFIED_ON)].join(", ")})`).join(",\n"));
out.push(`on conflict (milestone_id) do update set jurisdiction_code = excluded.jurisdiction_code, sort_order = excluded.sort_order, phase_id = excluded.phase_id, phase = excluded.phase, doc_step = excluded.doc_step, gantt_name = excluded.gantt_name, jurisdiction_name = excluded.jurisdiction_name, code = excluded.code, code_basis = excluded.code_basis, milestone_type = excluded.milestone_type, scope_new = excluded.scope_new, scope_add = excluded.scope_add, scope_ren = excluded.scope_ren, include_when = excluded.include_when, predecessor_hook = excluded.predecessor_hook, released_hook = excluded.released_hook, hold_point = excluded.hold_point, request_rule = excluded.request_rule, ready_checklist = excluded.ready_checklist, repeats = excluded.repeats, show_on_master = excluded.show_on_master, notes = excluded.notes, verified_on = excluded.verified_on, updated_at = now();`);
out.push(``);
out.push(`insert into public.inspection_task_hooks (phase_id, hook, role, match_kind, template_task) values`);
out.push(hooks.map((h) => `  (${q(h.phase)}, ${q(h.hook)}, ${q(h.role)}, ${q(h.kind)}, ${q(h.target)})`).join(",\n"));
out.push(`on conflict (phase_id, hook, role) do update set match_kind = excluded.match_kind, template_task = excluded.template_task, updated_at = now();`);
out.push(``);
writeFileSync(OUT, out.join("\n"));

const by = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {});
console.log(JSON.stringify({ milestones: rows.length, byJurisdiction: by("j"), byType: by("mtype"), hooks: hooks.length, hookKinds: hooks.reduce((m, h) => ((m[h.kind] = (m[h.kind] ?? 0) + 1), m), {}) }));
