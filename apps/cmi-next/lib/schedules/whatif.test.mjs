import { strict as assert } from "node:assert";
import { test } from "node:test";
import { applyWhatIf, scheduleFinish, contractVariance } from "./whatif.ts";

const WD = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const item = (id, start, end, extra = {}) => ({
  id, schedule_id: "S", title: id.toUpperCase(), kind: "task", status: "not_started", start_date: start, end_date: end,
  duration_days: null, is_locked: false, activity_id: null, ...extra,
});
const fs = (a, b, lag = 0) => ({ source_item_id: a, target_item_id: b, dependency_type: "finish_to_start", lag_days: lag });
// a (3 wd) → b (2 wd) → done (milestone, contract 11/10)
const base = () => ({
  schedules: [{ id: "S", job_id: "j", name: "S", scheduling_mode: "auto", workdays: WD, start_date: "2026-11-02" }],
  items: [
    item("a", "2026-11-02", "2026-11-04", { duration_days: 3, activity_id: 10 }),
    item("b", "2026-11-05", "2026-11-06", { duration_days: 2, activity_id: 20 }),
    item("done", "2026-11-09", "2026-11-09", { kind: "milestone", activity_id: 30, contract_date: "2026-11-10" }),
  ],
  deps: [fs("a", "b"), fs("b", "done")],
});
const get = (st, id) => st.net.items.find((i) => i.id === id);

test("no steps: the base settles with nothing moving", () => {
  const st = applyWhatIf(base(), "S", []);
  assert.equal(get(st, "done").start_date, "2026-11-09");
  assert.equal(st.refused.length, 0);
});

test("a longer task pushes the finish; the base isn't touched", () => {
  const b = base();
  const st = applyWhatIf(b, "S", [{ updates: [{ id: "a", patch: { duration_days: 6 } }] }]);
  assert.equal(get(st, "a").end_date, "2026-11-09");
  assert.equal(get(st, "done").start_date, "2026-11-12");
  assert.equal(b.items[0].duration_days, 3, "sandbox works on a copy");
  assert.deepEqual(scheduleFinish(st.net, "S", "2026-11-09"), { finish: "2026-11-12", delta: 3 });
  assert.equal(contractVariance(st.net, get(st, "done")), 2, "2 working days past the contract date");
});

test("typing a finish sets the length; typing an early start is refused", () => {
  const st = applyWhatIf(base(), "S", [
    { updates: [{ id: "a", patch: { end_date: "2026-11-05" } }] },
    { updates: [{ id: "b", patch: { start_date: "2026-11-02" } }] },
  ]);
  assert.equal(get(st, "a").duration_days, 4);
  assert.equal(st.refused.length, 1);
  assert.match(st.refused[0], /can't start before 2026-11-06/);
  assert.equal(get(st, "b").start_date, "2026-11-06");
});

test("start two weeks later", () => {
  const st = applyWhatIf(base(), "S", [{ shift: 10 }]);
  assert.equal(get(st, "a").start_date, "2026-11-16");
  assert.equal(get(st, "done").start_date, "2026-11-23");
  assert.equal(contractVariance(st.net, get(st, "done")), 9);
});

test("predecessor changes, and loops refused", () => {
  const st = applyWhatIf(base(), "S", [{ predecessors: [{ itemId: "b", links: [{ sourceItemId: "a", type: "finish_to_start", lag: 2 }] }] }]);
  assert.equal(get(st, "b").start_date, "2026-11-09");
  const loop = applyWhatIf(base(), "S", [{ predecessors: [{ itemId: "a", links: [{ sourceItemId: "done", type: "finish_to_start", lag: 0 }] }] }]);
  assert.equal(loop.refused.length, 1);
});
