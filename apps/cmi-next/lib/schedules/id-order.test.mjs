import { strict as assert } from "node:assert";
import { test } from "node:test";
import { placeByActivityId } from "./id-order.ts";

const rows = () => [
  { id: "a", activity_id: 10, sort_order: 5 },
  { id: "b", activity_id: 20, sort_order: 6 },
  { id: "c", activity_id: 30, sort_order: 7 },
];

test("a new task numbered 25 goes between 20 and 30, using the phase's own positions", () => {
  const r = [...rows(), { id: "new", activity_id: 25, sort_order: 99 }];
  assert.deepEqual(placeByActivityId(r, "new"), [{ id: "new", sort_order: 7 }, { id: "c", sort_order: 99 }]);
});

test("renumbering a task to 5 moves it to the top", () => {
  const r = rows(); r[2].activity_id = 5;
  assert.deepEqual(placeByActivityId(r, "c"), [{ id: "c", sort_order: 5 }, { id: "a", sort_order: 6 }, { id: "b", sort_order: 7 }]);
});

test("already in place, or no ID: nothing changes", () => {
  assert.deepEqual(placeByActivityId(rows(), "b"), []);
  const r = rows(); r[1].activity_id = null;
  assert.deepEqual(placeByActivityId(r, "b"), []);
});

test("a number past the end goes last", () => {
  const r = rows(); r[0].activity_id = 90;
  assert.deepEqual(placeByActivityId(r, "a"), [{ id: "b", sort_order: 5 }, { id: "c", sort_order: 6 }, { id: "a", sort_order: 7 }]);
});

import { landingPhase, renumberPlan } from "./id-order.ts";

const doc = () => [
  { id: "t260", activity_id: 260, phaseId: "finish" },
  { id: "t270", activity_id: 270, phaseId: "finish" },
  { id: "t280", activity_id: 280, phaseId: "finish" },
  { id: "t300", activity_id: 300, phaseId: "closeout" },
];

test("280 → 265 stays in its phase between 260 and 270 (Addendum example)", () => {
  assert.equal(landingPhase(doc(), "t280", 265), "finish");
});

test("an ID past the end of a phase joins the phase above the spot it lands", () => {
  assert.equal(landingPhase(doc(), "t260", 290), "finish");
  assert.equal(landingPhase(doc(), "t260", 310), "closeout");
  assert.equal(landingPhase(doc(), "t300", 5), "finish");
});

test("renumber plan: tens in schedule order, with the old IDs for the preview", () => {
  const p = renumberPlan([{ id: "a", title: "A", activity_id: 20 }, { id: "b", title: "B", activity_id: 40 }, { id: "c", title: "C", activity_id: 30 }]);
  assert.deepEqual(p.map((c) => [c.from, c.to]), [[20, 10], [40, 20], [30, 30]]);
});
