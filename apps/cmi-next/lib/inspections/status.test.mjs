import { strict as assert } from "node:assert";
import { test } from "node:test";
import { inspectionPatch, requestBy, unpassedInspectionsBefore, startsWork, inspectionStatusLabel } from "./status.ts";

const prev = { inspection_status: "scheduled", status: "scheduled", internal_notes: "Code: 615" };
const ctx = { today: "2026-12-03", who: "Joe" };

test("passed finishes the milestone and notes it", () => {
  const r = inspectionPatch(prev, { status: "passed" }, ctx);
  assert.equal(r.patch.status, "complete");
  assert.equal(r.patch.percent_complete, 100);
  assert.equal(r.patch.actual_finish, "2026-12-03");
  assert.equal(r.patch.internal_notes, "Code: 615\n[2026-12-03] Passed (Joe)");
});

test("failed needs a date and a note, then moves the milestone there", () => {
  assert.match(inspectionPatch(prev, { status: "failed" }, ctx).error, /re-inspection date/);
  assert.match(inspectionPatch(prev, { status: "failed", date: "2026-12-08" }, ctx).error, /note/);
  const r = inspectionPatch(prev, { status: "failed", date: "2026-12-08", note: "Missing straps" }, ctx);
  assert.deepEqual([r.patch.start_date, r.patch.end_date, r.patch.constraint_type, r.patch.constraint_date, r.patch.status], ["2026-12-08", "2026-12-08", "snet", "2026-12-08", "waiting_inspection"]);
  assert.match(r.patch.internal_notes, /Failed \/ Correction for 2026-12-08 \(Joe\): Missing straps$/);
});

test("N/A cancels; leaving Passed clears the actuals", () => {
  assert.equal(inspectionPatch(prev, { status: "na" }, ctx).patch.status, "cancelled");
  const r = inspectionPatch({ inspection_status: "passed", status: "complete", internal_notes: null, actual_finish: "2026-12-01" }, { status: "ready_to_call" }, ctx);
  assert.deepEqual([r.patch.status, r.patch.actual_finish, r.patch.percent_complete], ["ready", null, 0]);
  assert.match(inspectionPatch(prev, { status: "bogus" }, ctx).error, /status/);
  assert.match(inspectionPatch(prev, { status: "scheduled", date: "12/8" }, ctx).error, /date/);
  assert.equal(inspectionStatusLabel(null), "Not Ready");
});

test("request-by is the working day before, at the cutoff", () => {
  assert.deepEqual(requestBy("2026-12-09", 21 * 60, "IVR"), { date: "2026-12-08", minutes: 1260, label: "Request by Tue 9:00 PM (IVR)" });
  assert.equal(requestBy("2026-12-07", 1440).label, "Request by Fri midnight"); // Monday → Friday
  assert.equal(requestBy("2026-12-07", 1440).date, "2026-12-04");
  assert.equal(requestBy("2026-12-07", null), null);
  assert.equal(requestBy(null, 600), null);
});

test("hold points: unpassed inspections before a task", () => {
  const items = [
    { id: "m1", title: "INSP · Footing", kind: "milestone", inspection_step_id: "S-M01", inspection_status: "scheduled" },
    { id: "m2", title: "INSP · UFER", kind: "milestone", inspection_step_id: "S-M02", inspection_status: "passed" },
    { id: "t0", title: "Excavate", kind: "task" },
    { id: "t1", title: "Pour", kind: "task" },
  ];
  const links = [{ source_item_id: "m1", target_item_id: "t1" }, { source_item_id: "m2", target_item_id: "t1" }, { source_item_id: "t0", target_item_id: "t1" }];
  assert.deepEqual(unpassedInspectionsBefore("t1", links, items).map((i) => i.id), ["m1"]);
  assert.ok(startsWork({ status: "in_progress" }));
  assert.ok(startsWork({ percent_complete: 20 }));
  assert.ok(!startsWork({ title: "x" }));
});
