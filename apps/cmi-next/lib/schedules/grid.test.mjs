import { strict as assert } from "node:assert";
import { test } from "node:test";
import { scheduleRows, parseCell, cellText, parseDateCell, parseClipboard, headerMap } from "./grid.ts";

const item = (id, extra = {}) => ({
  id, schedule_id: "S", phase_id: null, kind: "task", title: id, status: "not_started", sort_order: 0,
  start_date: "2026-11-02", end_date: "2026-11-04", duration_days: 3, duration_unit: "workdays",
  percent_complete: 0, assignees: [], is_locked: false, activity_id: null, ...extra,
});
const ctx = (items, preds = {}) => ({
  idByActivity: new Map(items.filter((i) => i.activity_id != null).map((i) => [i.activity_id, i.id])),
  activityById: new Map(items.map((i) => [i.id, i.activity_id])),
  predsOf: (id) => preds[id] ?? [],
  succsOf: () => [],
  otherPredCount: () => 0,
});

test("rows follow phase order, then unphased; collapsed phases hide their tasks", () => {
  const phases = [{ id: "p2", name: "Two" }, { id: "p1", name: "One" }];
  const items = [item("a", { phase_id: "p1", sort_order: 2 }), item("b", { phase_id: "p1", sort_order: 1 }), item("c", { phase_id: "p2" }), item("d")];
  const keys = (rows) => rows.map((r) => (r.kind === "group" ? r.label : r.item.id)).join(",");
  assert.equal(keys(scheduleRows(items, phases)), "Two,c,One,b,a,Unphased,d");
  assert.equal(keys(scheduleRows(items, phases, { collapsed: new Set(["p1"]) })), "Two,c,One,Unphased,d");
});

test("dates in the formats people paste", () => {
  assert.equal(parseDateCell("2026-11-04"), "2026-11-04");
  assert.equal(parseDateCell("11/4/2026"), "2026-11-04");
  assert.equal(parseDateCell("11/4/26"), "2026-11-04");
  assert.equal(parseDateCell("Nov 4, 2026"), "2026-11-04");
  assert.equal(parseDateCell("46330"), "2026-11-04", "Excel serial");
  assert.equal(parseDateCell("2/30/2026"), null);
  assert.equal(parseDateCell("soon"), null);
});

test("duration, milestone, calendar days", () => {
  const it = item("a", { activity_id: 10 });
  const c = ctx([it]);
  assert.deepEqual(parseCell(it, "duration", "8", c).patch, { kind: "task", duration_days: 8, duration_unit: "workdays" });
  assert.deepEqual(parseCell(it, "duration", "7cd", c).patch, { kind: "task", duration_days: 7, duration_unit: "calendar" });
  assert.deepEqual(parseCell(it, "duration", "0", c).patch, { kind: "milestone", duration_days: null });
  assert.match(parseCell(it, "duration", "a week", c).error, /isn't a duration/);
  assert.equal(cellText({ ...it, duration_days: 7, duration_unit: "calendar" }, "duration", c), "7cd");
});

test("predecessor shorthand resolves activity IDs; bad ones are refused", () => {
  const a = item("a", { activity_id: 10 }), b = item("b", { activity_id: 20 }), x = item("x", { activity_id: 30 });
  const c = ctx([a, b, x]);
  assert.deepEqual(parseCell(x, "preds", "10, 20SS+2", c).preds, { itemId: "x", links: [
    { sourceItemId: "a", type: "finish_to_start", lag: 0 }, { sourceItemId: "b", type: "start_to_start", lag: 2 },
  ] });
  assert.match(parseCell(x, "preds", "99", c).error, /No activity 99/);
  assert.match(parseCell(x, "preds", "30", c).error, /itself/);
  assert.deepEqual(parseCell(x, "preds", "", c).preds.links, []);
  assert.equal(cellText(x, "preds", ctx([a, b, x], { x: [{ id: 20, type: "start_to_start", lag: 2 }, { id: 10, type: "finish_to_start", lag: 0 }] })), "10, 20SS+2");
});

test("activity IDs must be unique whole numbers", () => {
  const a = item("a", { activity_id: 10 }), b = item("b", { activity_id: 20 });
  const c = ctx([a, b]);
  assert.match(parseCell(b, "id", "10", c).error, /already used/);
  assert.deepEqual(parseCell(b, "id", "15", c).patch, { activity_id: 15 });
  assert.match(parseCell(b, "id", "1.5", c).error, /whole number/);
});

test("constraints, finish before start, percent", () => {
  const a = item("a");
  const c = ctx([a]);
  assert.deepEqual(parseCell(a, "constraint", "SNET", c).patch, { is_locked: false, constraint_type: "snet", constraint_date: "2026-11-02" });
  assert.deepEqual(parseCell(a, "constraint", "locked", c).patch, { is_locked: true, constraint_type: null });
  assert.deepEqual(parseCell(a, "constraint", "", c).patch, { is_locked: false, constraint_type: null, constraint_date: null });
  assert.match(parseCell(a, "finish", "2026-11-01", c).error, /before the start/);
  assert.deepEqual(parseCell(a, "pct", "50%", c).patch, { percent_complete: 50 });
  assert.match(parseCell(a, "pct", "150", c).error, /0 to 100/);
});

test("clipboard from Excel, with a header row", () => {
  const rows = parseClipboard('ID\tTask name\tDuration\tPredecessors\tColour\r\n10\t"Frame, walls"\t8\t\tred\r\n20\t"Say ""hi""\nthere"\t2\t10FS+1\t\r\n');
  assert.equal(rows.length, 3);
  assert.equal(rows[1][1], "Frame, walls");
  assert.equal(rows[2][1], 'Say "hi"\nthere');
  const h = headerMap(rows[0]);
  assert.deepEqual(h.columns, ["id", "name", "duration", "preds", null]);
  assert.deepEqual(h.unknown, ["Colour"]);
  assert.equal(headerMap(["10", "Frame", "8"]), null, "data rows map by position");
});
