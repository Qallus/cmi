// Excel export / template / upload for a schedule (Spec R2 §11). Server only.
// The column logic and the import plan are in excel-plan.ts (pure).
import ExcelJS from "exceljs";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { listItems, listPhases, listDependencies, getSchedule } from "./data";
import { loadNetwork } from "./engine";
import { mergeCalendars, EXCEPTION_LABELS } from "./calendar.ts";
import { contractVariance } from "./whatif.ts";
import { buildGridCtx, cellText, scheduleRows, COLUMN, type ColumnKey } from "./grid.ts";
import { EXPORT_COLUMNS, GUID_HEADER, PHASE_HEADER, planImport, type ImportPlan } from "./excel-plan.ts";
import type { ScheduleItem } from "./types";

const CHARCOAL = "FF2B2A28";
const ACCENT = "FF9E6F2E";
const DATE_COLS = new Set<ColumnKey>(["start", "finish", "cdate", "contract", "astart", "afinish"]);
const EXCEL_LABEL: Partial<Record<ColumnKey, string>> = { pct: "% Complete", float: "Total Float", variance: "Variance to contract" };

const label = (k: ColumnKey) => EXCEL_LABEL[k] ?? COLUMN[k].label;
const asDate = (iso: string | null | undefined) => (iso ? new Date(`${iso}T00:00:00Z`) : null);
const colLetter = (n: number) => { let s = ""; for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s; return s; };

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: CHARCOAL } };
  row.alignment = { vertical: "middle" };
  row.height = 20;
}

/** "26_001_The_Waters_Residence_Schedule_2026-11-04.xlsx" (Mac / PC safe). */
async function fileNameFor(scheduleId: string, kind: "export" | "template"): Promise<string> {
  const s = await getSchedule(scheduleId);
  let base = s?.name ?? "Schedule";
  if (s?.job_id) {
    const { data } = await getSupabaseAdmin().from("jobs").select("job_number, job_name").eq("id", s.job_id).maybeSingle();
    base = [data?.job_number, data?.job_name, s.name].filter(Boolean).join("_");
  }
  const safe = base.replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "_").slice(0, 90) || "Schedule";
  return kind === "template" ? `${safe}_Blank_Schedule_Template.xlsx` : `${safe}_Schedule_${new Date().toISOString().slice(0, 10)}.xlsx`;
}

export async function exportScheduleXlsx(scheduleId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const [items, phases, deps, net] = await Promise.all([
    listItems({ scheduleId }), listPhases(scheduleId), listDependencies({ scheduleId }), loadNetwork(scheduleId),
  ]);
  const variance = new Map(items.map((i) => [i.id, contractVariance(net, i)]));
  const ctx = buildGridCtx(items, deps, (id) => variance.get(id));
  const phaseName = new Map(phases.map((p) => [p.id, p.name]));
  const ordered = scheduleRows(items, phases).flatMap((r) => (r.kind === "item" ? [r.item] : []));

  const wb = new ExcelJS.Workbook();
  wb.creator = "Constructed Matter, Inc.";
  wb.created = new Date();
  const ws = wb.addWorksheet("Schedule", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 1 as never /* Letter */ },
  });
  const headers = [GUID_HEADER, PHASE_HEADER, ...EXPORT_COLUMNS.map(label)];
  ws.columns = headers.map((h, i) => ({
    header: h,
    width: i === 0 ? 38 : i === 1 ? 22 : Math.max(10, Math.round((COLUMN[EXPORT_COLUMNS[i - 2]]?.width ?? 90) / 7)),
  }));
  styleHeader(ws.getRow(1));
  ws.getColumn(1).hidden = true;
  for (const it of ordered) {
    const values: (string | number | Date | null)[] = [it.id, it.phase_id ? phaseName.get(it.phase_id) ?? "" : ""];
    for (const k of EXPORT_COLUMNS) {
      if (DATE_COLS.has(k)) { values.push(asDate(cellText(it, k, ctx) || null)); continue; }
      if (k === "id") { values.push(it.activity_id ?? null); continue; }
      if (k === "pct") { values.push(it.percent_complete ?? 0); continue; }
      if (k === "float") { values.push(it.total_float ?? null); continue; }
      if (k === "duration" && it.kind !== "milestone" && it.duration_unit !== "calendar" && it.duration_days != null) { values.push(Number(it.duration_days)); continue; }
      values.push(cellText(it, k, ctx) || null);
    }
    ws.addRow(values);
  }
  EXPORT_COLUMNS.forEach((k, j) => { if (DATE_COLS.has(k)) ws.getColumn(j + 3).numFmt = "yyyy-mm-dd"; });
  ws.autoFilter = { from: { row: 1, column: 2 }, to: { row: 1, column: headers.length } };

  // Calendar in effect (read-only reference).
  const sched = net.schedules.find((s) => s.id === scheduleId);
  const cal = mergeCalendars(net.company, { workdays: sched?.workdays ?? null }, net.job, net.scheduleCals?.[scheduleId]);
  const cs = wb.addWorksheet("Calendar");
  cs.columns = [{ header: "Date", width: 14 }, { header: "Working?", width: 10 }, { header: "Type", width: 14 }, { header: "Label", width: 34 }];
  styleHeader(cs.getRow(1));
  cs.addRow(["Working days", "", "", (["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const).filter((d) => cal.workdays[d]).map((d) => d[0].toUpperCase() + d.slice(1)).join(", ")]);
  for (const e of cal.exceptions) cs.addRow([asDate(e.date), e.working ? "Yes" : "No", EXCEPTION_LABELS[e.type], e.label ?? ""]);
  cs.getColumn(1).numFmt = "yyyy-mm-dd";

  // Weekly Gantt: bars are conditional formatting on dates pulled from the
  // Schedule sheet, so they follow any date edited in Excel.
  const gs = wb.addWorksheet("Gantt", { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 17 as never /* 11x17 */ } });
  const startCol = colLetter(3 + EXPORT_COLUMNS.indexOf("start"));
  const finishCol = colLetter(3 + EXPORT_COLUMNS.indexOf("finish"));
  const nameCol = colLetter(3 + EXPORT_COLUMNS.indexOf("name"));
  const dated = ordered.filter((i) => i.start_date);
  const minStart = dated.reduce<string | null>((m, i) => (!m || i.start_date! < m ? i.start_date! : m), null);
  const maxEnd = dated.reduce<string | null>((m, i) => { const e = i.end_date ?? i.start_date!; return !m || e > m ? e : m; }, null);
  const weeks: Date[] = [];
  if (minStart && maxEnd) {
    const d = new Date(`${minStart}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - d.getUTCDay() + 1); // Monday
    const end = new Date(`${maxEnd}T00:00:00Z`);
    for (; d <= end && weeks.length < 156; d.setUTCDate(d.getUTCDate() + 7)) weeks.push(new Date(d));
  }
  gs.columns = [{ header: "Task", width: 34 }, { header: "Start", width: 11 }, { header: "Finish", width: 11 }, ...weeks.map((w) => ({ header: "", width: 3.2, key: w.toISOString() }))];
  const head = gs.getRow(1);
  weeks.forEach((w, i) => { const c = head.getCell(4 + i); c.value = w; c.numFmt = "m/d"; c.alignment = { textRotation: 90 }; });
  styleHeader(head);
  head.height = 42;
  ordered.forEach((_, i) => {
    const r = i + 2;
    gs.getCell(`A${r}`).value = { formula: `Schedule!${nameCol}${r}` };
    gs.getCell(`B${r}`).value = { formula: `Schedule!${startCol}${r}` };
    gs.getCell(`C${r}`).value = { formula: `Schedule!${finishCol}${r}` };
  });
  gs.getColumn(2).numFmt = "m/d/yy";
  gs.getColumn(3).numFmt = "m/d/yy";
  if (weeks.length && ordered.length) {
    const last = colLetter(3 + weeks.length);
    gs.addConditionalFormatting({
      ref: `D2:${last}${ordered.length + 1}`,
      rules: [{ type: "expression", priority: 1, formulae: [`AND($B2<>"",$B2<=D$1+6,$C2>=D$1)`], style: { fill: { type: "pattern", pattern: "solid", bgColor: { argb: ACCENT } } } }],
    });
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName: await fileNameFor(scheduleId, "export") };
}

/** Blank sheet with the same columns, an example row and how-to notes. */
export async function templateXlsx(scheduleId: string): Promise<{ buffer: Buffer; fileName: string }> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Schedule", { views: [{ state: "frozen", xSplit: 0, ySplit: 1 }] });
  const cols: ColumnKey[] = ["id", "name", "duration", "start", "preds", "constraint", "calendar", "mtype", "contract", "cost_code", "notes"];
  ws.columns = [{ header: PHASE_HEADER, width: 22 }, ...cols.map((k) => ({ header: label(k), width: Math.max(10, Math.round(COLUMN[k].width / 7)) }))];
  styleHeader(ws.getRow(1));
  ws.addRow(["Site & Foundation", 10, "Site visit", 1, new Date("2026-11-02T00:00:00Z"), "", "", "", "", "", "", "Example row — replace or delete"]);
  ws.addRow(["Site & Foundation", 20, "Pour footings", 3, null, "10", "", "", "", "", "", ""]);
  ws.addRow(["Site & Foundation", 30, "Cure", "7cd", null, "20", "", "Calendar days", "", "", "", ""]);
  ws.addRow(["Closeout", 40, "Substantial completion", 0, null, "30FS+5", "", "", "Contract", new Date("2027-03-01T00:00:00Z"), "", ""]);
  ws.getColumn(5).numFmt = "yyyy-mm-dd";
  ws.getColumn(10).numFmt = "yyyy-mm-dd";
  const how = wb.addWorksheet("How to");
  how.columns = [{ header: "Column", width: 18 }, { header: "What to type", width: 90 }];
  styleHeader(how.getRow(1));
  for (const [c, t] of [
    ["Phase", "The phase name (must match a phase on the schedule; leave blank for none)."],
    ["ID", "Activity ID, by tens (10, 20, 30…). Leave blank and IDs are added for you."],
    ["Task name", "Required."],
    ["Duration", "Working days (8), calendar days (7cd), or 0 for a milestone."],
    ["Start", "Optional. A typed start becomes Start No Earlier Than; otherwise the links set it."],
    ["Predecessors", "Activity IDs with link type and lag: 10, 10FS+2, 20SS, 30FF-1."],
    ["Constraint", "None, SNET, MFO, ALAP or Locked."],
    ["Calendar", "Working days or Calendar days."],
    ["Milestone type", "Contract, Inspection, Client decision or Internal."],
    ["Contract date", "For contract milestones: the date in the contract."],
  ]) how.addRow([c, t]);
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName: await fileNameFor(scheduleId, "template") };
}

/** Cell → text the grid parser understands (dates as YYYY-MM-DD). */
function cellToText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if ("result" in v) return cellToText((v as ExcelJS.CellFormulaValue).result as ExcelJS.CellValue);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text ?? "");
  }
  return String(v);
}

export async function readUploadedSheet(buf: ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const ws = wb.getWorksheet("Schedule") ?? wb.worksheets[0];
  if (!ws) throw new Error("That workbook has no sheets.");
  const width = ws.actualColumnCount || ws.columnCount;
  const rows: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const out: string[] = [];
    for (let c = 1; c <= width; c++) out.push(cellToText(row.getCell(c).value).trim());
    rows.push(out);
  });
  return rows;
}

export async function previewImport(scheduleId: string, buf: ArrayBuffer): Promise<ImportPlan & { taskCount: number }> {
  const [sheet, items, phases, deps] = await Promise.all([readUploadedSheet(buf), listItems({ scheduleId }), listPhases(scheduleId), listDependencies({ scheduleId })]);
  const plan = planImport(sheet, items as ScheduleItem[], phases, buildGridCtx(items, deps));
  return { ...plan, taskCount: items.length };
}
