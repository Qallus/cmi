import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planImport, GUID_HEADER } from "./excel-plan.ts";

const item = (id, extra = {}) => ({
  id, schedule_id: "S", phase_id: "p1", kind: "task", title: id.toUpperCase(), status: "not_started", sort_order: 0,
  start_date: "2026-11-02", end_date: "2026-11-04", duration_days: 3, duration_unit: "workdays",
  percent_complete: 0, assignees: [], is_locked: false, activity_id: null, internal_notes: null, ...extra,
});
const items = [item("a", { activity_id: 10, title: "Dig" }), item("b", { activity_id: 20, title: "Pour", start_date: "2026-11-05", end_date: "2026-11-05", duration_days: 1 })];
const phases = [{ id: "p1", name: "Site" }, { id: "p2", name: "Frame" }];
const ctx = {
  idByActivity: new Map([[10, "a"], [20, "b"]]), activityById: new Map([["a", 10], ["b", 20]]),
  predsOf: (id) => (id === "b" ? [{ id: 10, type: "finish_to_start", lag: 0 }] : []), succsOf: () => [], otherPredCount: () => 0,
};
const head = [GUID_HEADER, "Phase", "ID", "Task name", "Duration", "Start", "Finish", "Predecessors", "Successors", "Float", "Notes", "Colour"];

test("an unchanged export round-trips to no changes", () => {
  const sheet = [head,
    ["a", "Site", "10", "Dig", "3", "2026-11-02", "2026-11-04", "", "20", "0", "", ""],
    ["b", "Site", "20", "Pour", "1", "2026-11-05", "2026-11-05", "10", "", "0", "", ""]];
  const plan = planImport(sheet, items, phases, ctx);
  assert.equal(plan.rows.length, 0);
  assert.equal(plan.unchanged, 2);
  assert.deepEqual(plan.deletions, []);
  assert.deepEqual(plan.ignoredColumns, ["Colour"]);
});

test("edits, a new row linked to an existing one, and a missing row offered for deletion", () => {
  const sheet = [head,
    ["a", "Frame", "10", "Dig deeper", "5", "2026-11-02", "", "", "", "", "ZZ note", ""],
    ["", "Frame", "30", "Walls", "8", "", "", "10FS+2", "", "", "", ""]];
  const plan = planImport(sheet, items, phases, ctx);
  const upd = plan.rows.find((r) => r.kind === "update");
  assert.deepEqual(upd.changes.map((c) => c.field).sort(), ["Duration", "Notes", "Phase", "Task name"].sort(), "a blank Finish is left alone");
  assert.deepEqual(plan.ops.updates[0].patch.phase_id, "p2");
  assert.equal(plan.ops.updates[0].patch.duration_days, 5);
  const created = plan.ops.creates[0];
  assert.equal(created.row.title, "Walls");
  assert.equal(created.row.activity_id, 30);
  assert.deepEqual(plan.ops.predecessors.find((p) => p.itemId === created.tempId).links, [{ sourceItemId: "a", type: "finish_to_start", lag: 2 }]);
  assert.deepEqual(plan.deletions.map((d) => d.id), ["b"], "Pour isn't in the file");
});

test("a blank template (no GUIDs) only adds; bad cells are reported, not guessed", () => {
  const sheet = [["ID", "Task name", "Duration", "Predecessors"], ["10", "Site visit", "1", ""], ["20", "Proposal", "2", "10"], ["", "", "", ""], ["30", "", "x", ""], ["40", "Permits", "a week", ""]];
  const plan = planImport(sheet, [], phases, { ...ctx, idByActivity: new Map(), activityById: new Map(), predsOf: () => [] });
  assert.equal(plan.ops.creates.length, 3);
  assert.equal(plan.deletions.length, 0);
  assert.ok(plan.errors.some((e) => /no task name/.test(e)));
  assert.ok(plan.errors.some((e) => /isn't a duration/.test(e)));
  const proposal = plan.ops.creates.find((c) => c.row.title === "Proposal");
  assert.equal(plan.ops.predecessors.find((p) => p.itemId === proposal.tempId).links[0].sourceItemId, plan.ops.creates[0].tempId);
});

test("a sheet without a Task name column is refused", () => {
  assert.match(planImport([["ID", "Duration"]], items, phases, ctx).errors[0], /Task name/);
});
