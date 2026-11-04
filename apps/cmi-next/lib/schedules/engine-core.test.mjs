import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runCpm } from "./cpm.ts";
import { buildInput, diffResult, planSwitch, blockedMove, wouldLoop, itemDuration, calendarFor } from "./engine-core.ts";
import { cmiHolidays } from "./calendar.ts";

const WD = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const sched = (id, mode = "legacy") => ({ id, job_id: "j", name: id, scheduling_mode: mode, workdays: WD, start_date: "2026-11-02" });
const item = (id, schedule_id, start, end, extra = {}) => ({
  id, schedule_id, title: id.toUpperCase(), kind: "task", status: "not_started",
  start_date: start, end_date: end, duration_days: null, is_locked: false, activity_id: null, ...extra,
});
const fs = (a, b, lag = 0) => ({ source_item_id: a, target_item_id: b, dependency_type: "finish_to_start", lag_days: lag });

// a (Mon–Wed) → b, but b sits a week later than it has to; c has no link.
const network = (mode = "legacy") => ({
  schedules: [sched("S", mode)],
  items: [
    item("a", "S", "2026-11-02", "2026-11-04"),
    item("b", "S", "2026-11-12", "2026-11-13"),
    item("c", "S", "2026-11-16", "2026-11-16"),
  ],
  deps: [fs("a", "b")],
});

test("legacy schedules are left alone", () => {
  const net = network("legacy");
  const changes = diffResult(net, runCpm(buildInput(net)));
  assert.equal(changes.length, 0);
});

test("switch with keepDates pins tasks that sit later than their links; nothing moves", () => {
  const plan = planSwitch(network(), "S", "auto", true);
  assert.deepEqual(plan.pins, { b: "2026-11-12", c: "2026-11-16" });
  assert.equal(plan.changes.filter((c) => c.moved).length, 0);
  assert.equal(plan.finishAfter, plan.finishBefore);
  const b = plan.changes.find((c) => c.id === "b");
  assert.equal(b.fields.constraint_type, "snet");
  assert.equal(b.fields.duration_days, 2);
  assert.equal(b.fields.total_float, 1, "b can slip one day: everything is bounded by the network finish (c, the 16th)");
});

test("switch without keepDates tightens to the links", () => {
  const plan = planSwitch(network(), "S", "auto", false);
  const b = plan.changes.find((c) => c.id === "b");
  assert.equal(b.moved, true);
  assert.equal(b.to.start, "2026-11-05");
  const c = plan.changes.find((x) => x.id === "c");
  assert.equal(c.to.start, "2026-11-02", "an unlinked task goes to the start");
  assert.ok(plan.finishAfter < plan.finishBefore);
});

test("manual mode keeps dates and reports float", () => {
  const plan = planSwitch(network(), "S", "manual", true);
  assert.equal(plan.changes.filter((c) => c.moved).length, 0);
  assert.equal(plan.changes.find((c) => c.id === "a").fields.total_float, 5, "a can slip to Wed 11/11, the day before b");
});

test("a legacy task drives an auto task linked after it", () => {
  const net = {
    schedules: [sched("L", "legacy"), sched("A", "auto")],
    items: [item("x", "L", "2026-11-09", "2026-11-13"), item("y", "A", "2026-11-02", "2026-11-03", { duration_days: 2 })],
    deps: [fs("x", "y")],
  };
  const changes = diffResult(net, runCpm(buildInput(net)));
  assert.equal(changes.length, 1);
  assert.equal(changes[0].id, "y");
  assert.equal(changes[0].to.start, "2026-11-16");
});

test("a refused early move names the link holding it", () => {
  const net = network("auto");
  net.items[1].duration_days = 2;
  const res = runCpm(buildInput(net));
  const blocked = blockedMove(net, "b", "2026-11-03", res);
  assert.equal(blocked.earliest, "2026-11-05");
  assert.equal(blocked.because[0].title, "A");
  assert.equal(blockedMove(net, "b", "2026-11-05", res), null);
  assert.equal(blockedMove(network("legacy"), "b", "2026-11-03", res), null, "legacy doesn't refuse");
});

test("holidays from the company calendar count", () => {
  const net = { ...network("auto"), company: { exceptions: cmiHolidays(2026) } };
  net.schedules = [{ ...sched("S", "auto"), start_date: "2026-11-25" }];
  net.items = [item("p", "S", "2026-11-25", "2026-11-25", { duration_days: 1 }), item("q", "S", "2026-11-26", "2026-11-26", { duration_days: 1 })];
  net.deps = [fs("p", "q")];
  const q = diffResult(net, runCpm(buildInput(net))).find((c) => c.id === "q");
  assert.equal(q.to.start, "2026-11-30", "skips Thanksgiving and the Friday after");
  assert.equal(itemDuration(item("w", "S", "2026-11-25", "2026-11-30"), calendarFor(net, net.schedules[0]), false), 2);
});

test("loop check", () => {
  const deps = [fs("a", "b"), fs("b", "c")];
  assert.equal(wouldLoop(deps, "c", "a"), true);
  assert.equal(wouldLoop(deps, "a", "c"), false);
  assert.equal(wouldLoop(deps, "a", "a"), true);
});
