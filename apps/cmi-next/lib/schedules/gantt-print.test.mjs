import { strict as assert } from "node:assert";
import { test } from "node:test";
import { printRows, printScale, xOf, endX } from "./gantt-print.ts";

const it = (id, s, e, extra = {}) => ({ id, title: id, kind: "task", status: "not_started", phase_id: "p1", start_date: s, end_date: e, client_visible: true, ...extra });
const phases = [{ id: "p1", name: "Build", sort_order: 1 }, { id: "p0", name: "Site", sort_order: 0 }];
const items = [
  it("frame", "2026-11-04", "2026-11-12"),
  it("grade", "2026-10-26", "2026-10-28", { phase_id: "p0" }),
  it("ms", "2026-12-01", "2026-12-01", { kind: "milestone", client_visible: false }),
  it("roof", "2027-01-10", "2027-01-20", { client_visible: false }),
  it("gone", "2026-11-05", "2026-11-06", { status: "cancelled" }),
];

test("each print option picks its tasks, grouped by phase in order", () => {
  const ids = (rows) => rows.map((r) => (r.kind === "phase" ? `#${r.name}` : r.item.id));
  assert.deepEqual(ids(printRows(items, phases, "full", "2026-11-06")), ["#Site", "grade", "#Build", "frame", "ms", "roof"]);
  assert.deepEqual(ids(printRows(items, phases, "milestones", "2026-11-06")), ["#Build", "ms"]);
  assert.deepEqual(ids(printRows(items, phases, "client", "2026-11-06")), ["#Site", "grade", "#Build", "frame"]);
  assert.deepEqual(ids(printRows(items, phases, "lookahead", "2026-11-06")), ["#Build", "frame"]);
});

test("weeks for short spans, months for long ones; positions on the scale", () => {
  const s = printScale(printRows(items, phases, "full", "2026-11-06"), "full", "2026-11-06");
  assert.equal(s.unit, "week");
  assert.equal(s.from, "2026-10-26");
  assert.equal(s.ticks[0].major, "Oct 26");
  const long = printScale([{ kind: "task", item: it("a", "2026-01-05", "2027-03-01") }], "full", "2026-11-06");
  assert.equal(long.unit, "month");
  assert.equal(long.ticks[0].at, "2026-01-01");
  assert.equal(xOf({ from: "2026-11-02", to: "2026-11-09" }, "2026-11-02"), 0);
  assert.equal(endX({ from: "2026-11-02", to: "2026-11-09" }, "2026-11-08"), 1);
});
