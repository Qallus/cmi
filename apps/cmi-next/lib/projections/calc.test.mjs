// Unit tests for the pure Projections math. Run: node --test lib/projections/
// (Node 22.18+ strips TypeScript types natively; no test framework needed.)
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  monthOf, addMonths, monthRange, monthsBetween, evenSpread, spreadMonths,
  allocation, statusFromJob, monthTotals, beyondByYear, applyMonthEdit, respreadFuture,
} from "./calc.ts";

test("month helpers", () => {
  assert.equal(monthOf("2026-09-18"), "2026-09-01");
  assert.equal(monthOf(new Date(2026, 8, 30, 23, 59)), "2026-09-01"); // local month, not UTC
  assert.equal(addMonths("2026-11-01", 3), "2027-02-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
  assert.deepEqual(monthRange("2026-11-01", 3), ["2026-11-01", "2026-12-01", "2027-01-01"]);
  assert.deepEqual(monthsBetween("2026-09-15", "2026-11-02"), ["2026-09-01", "2026-10-01", "2026-11-01"]);
  assert.deepEqual(monthsBetween("2026-11-01", "2026-09-01"), []);
});

test("even spread puts the rounding remainder on the last month", () => {
  const s = evenSpread(1000, ["2026-09-01", "2026-10-01", "2026-11-01"]);
  assert.deepEqual(s, { "2026-09-01": 333, "2026-10-01": 333, "2026-11-01": 334 });
  assert.equal(Object.values(evenSpread(40690.38, monthRange("2026-09-01", 7))).reduce((a, b) => a + b, 0), 40690);
  assert.deepEqual(evenSpread(0, ["2026-09-01"]), {});
  assert.deepEqual(evenSpread(-500, ["2026-09-01"]), {});
  assert.deepEqual(evenSpread(500, []), {});
});

test("spread window starts no earlier than the current month", () => {
  assert.deepEqual(spreadMonths("2026-05-04", "2026-11-20", "2026-09-01"), ["2026-09-01", "2026-10-01", "2026-11-01"]);
  assert.deepEqual(spreadMonths("2026-12-10", "2027-01-05", "2026-09-01"), ["2026-12-01", "2027-01-01"]);
  // Finish already past → everything lands in the current month.
  assert.deepEqual(spreadMonths("2026-08-19", "2026-09-07", "2026-10-01"), ["2026-10-01"]);
  assert.deepEqual(spreadMonths(null, "2026-12-01", "2026-09-01"), []);
});

test("allocation states", () => {
  assert.deepEqual(allocation(1000, 999.5), { unallocated: 0.5, state: "balanced" });
  assert.deepEqual(allocation(1000, 800), { unallocated: 200, state: "under" });
  assert.deepEqual(allocation(1000, 1250), { unallocated: -250, state: "over" });
});

test("status mapping from job status", () => {
  assert.equal(statusFromJob("active_project"), "contracted");
  assert.equal(statusFromJob("pre_construction_design"), "preconstruction");
  assert.equal(statusFromJob("active_budget"), "proposal");
  assert.equal(statusFromJob("opportunity"), "likely");
  assert.equal(statusFromJob("on_hold"), "on_hold");
  assert.equal(statusFromJob(null), "likely");
});

test("month totals: included rows only, variance only for started months", () => {
  const window = ["2026-08-01", "2026-09-01", "2026-10-01"];
  const rows = [
    { include: true, status: "contracted", remaining: 0, months: { "2026-08-01": { projected: 100, actual: 90 }, "2026-09-01": { projected: 100, actual: 0 }, "2026-10-01": { projected: 100, actual: 0 } } },
    { include: true, status: "likely", remaining: 0, months: { "2026-08-01": { projected: 0, actual: 0 }, "2026-09-01": { projected: 50, actual: 0 }, "2026-10-01": { projected: 0, actual: 0 } } },
    { include: false, status: "contracted", remaining: 0, months: { "2026-09-01": { projected: 999, actual: 999 } } },
  ];
  const t = monthTotals(rows, window, "2026-09-01");
  assert.deepEqual(t[0], { month: "2026-08-01", projected: 100, actual: 90, variance: -10, projects: 1, committed: 100, potential: 0 });
  assert.deepEqual(t[1], { month: "2026-09-01", projected: 150, actual: 0, variance: -150, projects: 2, committed: 100, potential: 50 });
  assert.equal(t[2].variance, null);
});

test("beyond-window forecast sums by year", () => {
  const months = { "2027-07-01": 100, "2027-08-01": 200, "2027-12-01": 50, "2028-01-01": 25, "2026-12-01": 999 };
  assert.deepEqual(beyondByYear(months, "2027-07-01"), { 2027: 250, 2028: 25 });
});

test("month edit: leave alone changes only that month", () => {
  const existing = { "2026-09-01": 100, "2026-10-01": 100, "2026-11-01": 100 };
  assert.deepEqual(
    applyMonthEdit({ existing, month: "2026-10-01", amount: 250, mode: "leave", remaining: 300, targets: Object.keys(existing), currentMonth: "2026-09-01" }),
    { "2026-10-01": 250 },
  );
});

test("month edit: redistribute spreads the rest over the other future months", () => {
  const existing = { "2026-08-01": 500, "2026-09-01": 100, "2026-10-01": 100, "2026-11-01": 100, "2027-03-01": 40 };
  const targets = ["2026-09-01", "2026-10-01", "2026-11-01"];
  // 300 remaining, Oct set to 101 → 199 over Sep + Nov (99 / 100); past Aug kept; Mar (outside window) zeroed.
  assert.deepEqual(
    applyMonthEdit({ existing, month: "2026-10-01", amount: 101, mode: "redistribute", remaining: 300, targets, currentMonth: "2026-09-01" }),
    { "2026-10-01": 101, "2026-09-01": 99, "2026-11-01": 100, "2027-03-01": 0 },
  );
  // Edited amount above what's remaining → other months go to zero, never negative.
  assert.deepEqual(
    applyMonthEdit({ existing: {}, month: "2026-09-01", amount: 400, mode: "redistribute", remaining: 300, targets, currentMonth: "2026-09-01" }),
    { "2026-09-01": 400, "2026-10-01": 0, "2026-11-01": 0 },
  );
  // Editing a past month doesn't eat into the future spread.
  assert.deepEqual(
    applyMonthEdit({ existing: {}, month: "2026-08-01", amount: 50, mode: "redistribute", remaining: 300, targets, currentMonth: "2026-09-01" }),
    { "2026-08-01": 50, "2026-09-01": 100, "2026-10-01": 100, "2026-11-01": 100 },
  );
});

test("respread replaces the future forecast only", () => {
  const existing = { "2026-08-01": 500, "2026-09-01": 100, "2026-12-01": 100 };
  assert.deepEqual(
    respreadFuture(existing, 300, ["2026-10-01", "2026-11-01"], "2026-09-01"),
    { "2026-10-01": 150, "2026-11-01": 150, "2026-09-01": 0, "2026-12-01": 0 },
  );
});
