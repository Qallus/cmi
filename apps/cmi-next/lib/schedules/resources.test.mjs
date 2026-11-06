import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyAssign, convertLabel, resourceLoad, tradeLabel, weekStarts } from "./resources.ts";

const ben = { id: "ben", name: "Ben Peck", type: "staff" };
const elec = tradeLabel("  Electrician ");
const acme = { id: "co1", name: "Acme Electric", type: "vendor" };

test("trade labels, assign and convert", () => {
  assert.deepEqual(elec, { id: "trade:electrician", name: "Electrician", type: "trade" });
  assert.deepEqual(applyAssign([ben], [ben, elec], "add").map((a) => a.id), ["ben", "trade:electrician"]);
  assert.deepEqual(applyAssign([ben, elec], [elec], "remove").map((a) => a.id), ["ben"]);
  assert.deepEqual(applyAssign([ben], [elec], "replace").map((a) => a.id), ["trade:electrician"]);
  const c = convertLabel([ben, elec], "trade:electrician", acme);
  assert.equal(c.changed, true);
  assert.deepEqual(c.next.map((a) => a.id), ["ben", "co1"]);
  assert.equal(convertLabel([ben], "trade:electrician", acme).changed, false);
});

test("weeks across with overlaps across jobs", () => {
  assert.deepEqual(weekStarts("2026-11-06", 2), ["2026-11-02", "2026-11-09"]);
  const rows = resourceLoad([
    { id: "a", title: "A", job_id: "j1", schedule_id: "s1", status: "not_started", start_date: "2026-11-09", end_date: "2026-11-11", assignees: [ben] },
    { id: "b", title: "B", job_id: "j2", schedule_id: "s2", status: "not_started", start_date: "2026-11-11", end_date: "2026-11-12", assignees: [ben, elec] },
    { id: "c", title: "C", job_id: "j2", schedule_id: "s2", status: "complete", start_date: "2026-11-02", end_date: "2026-11-03", assignees: [ben] },
  ], "2026-11-06", 3);
  const b = rows.find((r) => r.resource.id === "ben");
  assert.equal(b.tasks, 2);
  assert.equal(b.jobs, 2);
  assert.deepEqual(b.cells.map((c) => [c.taskIds.length, c.overlap]), [[0, false], [2, true], [0, false]]);
  assert.equal(rows[0].resource.id, "ben"); // staff first
});
