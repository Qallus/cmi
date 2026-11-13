import { strict as assert } from "node:assert";
import { test } from "node:test";
import { phaseColors, isPastDue, nextUpId, barFill, classicColor, CLASSIC, PHASE_PALETTE, PAST_DUE_COLOR } from "./colors.ts";

test("each phase gets its own colour; a phase's own colour wins", () => {
  const m = phaseColors([{ id: "pre" }, { id: "design" }, { id: "site", color: "#123456" }]);
  assert.equal(m.get("pre"), PHASE_PALETTE[0]);
  assert.equal(m.get("design"), PHASE_PALETTE[1]);
  assert.equal(m.get("site"), "#123456");
  assert.notEqual(m.get("pre"), m.get("design"));
});

test("past due: ended before today and not done", () => {
  const today = "2026-11-12";
  assert.equal(isPastDue({ id: "a", end_date: "2026-11-10", status: "in_progress" }, today), true);
  assert.equal(isPastDue({ id: "b", end_date: "2026-11-10", status: "complete" }, today), false);
  assert.equal(isPastDue({ id: "c", end_date: "2026-11-12", status: "not_started" }, today), false);
  assert.equal(isPastDue({ id: "d", start_date: "2026-11-01", kind: "milestone" }, today), true);
});

test("next up: earliest start from today, not done; schedule order breaks a tie", () => {
  const today = "2026-11-12";
  const items = [
    { id: "past", start_date: "2026-11-01" },
    { id: "later", start_date: "2026-11-20", sort_order: 1 },
    { id: "soon2", start_date: "2026-11-14", sort_order: 5 },
    { id: "soon1", start_date: "2026-11-14", sort_order: 3 },
    { id: "done", start_date: "2026-11-13", status: "complete" },
  ];
  assert.equal(nextUpId(items, today), "soon1");
  assert.equal(nextUpId([], today), null);
});

test("bar fill: task colour, then schedule, then phase; past due overrides", () => {
  const phases = phaseColors([{ id: "p1" }, { id: "p2" }]);
  const today = "2026-11-12";
  assert.deepEqual(barFill({ id: "x", phase_id: "p2", start_date: "2026-12-01" }, { today, phases }), { color: PHASE_PALETTE[1], pastDue: false });
  assert.equal(barFill({ id: "x", phase_id: "p2", bar_color: "#ff0000", start_date: "2026-12-01" }, { today, phases }).color, "#ff0000");
  assert.equal(barFill({ id: "x", phase_id: "p2", start_date: "2026-12-01" }, { today, phases, scheduleColor: "#00ff00" }).color, "#00ff00");
  assert.deepEqual(barFill({ id: "x", phase_id: "p2", bar_color: "#ff0000", end_date: "2026-11-01" }, { today, phases }), { color: PAST_DUE_COLOR, pastDue: true });
});

test("tan & charcoal: tan tasks, charcoal critical, grey complete; own colour and past due still win", () => {
  const phases = phaseColors([{ id: "p1" }]);
  const today = "2026-11-12";
  const opt = { today, phases, scheme: "classic" };
  assert.equal(barFill({ id: "a", phase_id: "p1", start_date: "2026-12-01", total_float: 4 }, opt).color, CLASSIC.task);
  assert.equal(barFill({ id: "b", phase_id: "p1", start_date: "2026-12-01", total_float: 0 }, opt).color, CLASSIC.critical);
  assert.equal(barFill({ id: "c", phase_id: "p1", start_date: "2026-11-01", end_date: "2026-11-02", status: "complete" }, opt).color, CLASSIC.complete);
  assert.equal(barFill({ id: "d", start_date: "2026-12-01", bar_color: "#123456" }, opt).color, "#123456");
  assert.equal(barFill({ id: "e", start_date: "2026-11-01", end_date: "2026-11-05" }, opt).color, PAST_DUE_COLOR);
  assert.equal(classicColor({ id: "m", kind: "milestone", start_date: "2027-03-12", contract_date: "2027-03-10", total_float: 3 }), CLASSIC.critical);
});
