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
