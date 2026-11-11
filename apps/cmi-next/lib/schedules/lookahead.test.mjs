import { strict as assert } from "node:assert";
import { test } from "node:test";
import { buildLookahead, lookaheadDays } from "./lookahead.ts";

const it = (id, start, end, extra = {}) => ({ id, title: id.toUpperCase(), kind: "task", status: "not_started", phase_id: "p1", start_date: start, end_date: end, percent_complete: 0, client_visible: true, ...extra });
const phases = [{ id: "p1", name: "Framing", sort_order: 1 }, { id: "p0", name: "Site", sort_order: 0 }];

test("the window is 15 weekdays from this week's Monday", () => {
  const d = lookaheadDays("2026-11-06"); // Friday
  assert.equal(d[0], "2026-11-02");
  assert.equal(d[14], "2026-11-20");
  assert.equal(d.length, 15);
  assert.equal(lookaheadDays("2026-11-08")[0], "2026-11-02"); // Sunday belongs to the week that started Monday
});

test("rows: active in the window, grouped by phase in phase order, late open work kept", () => {
  const la = buildLookahead([
    it("frame", "2026-11-04", "2026-11-12", { percent_complete: 30, actual_start: "2026-11-04", responsible_company: "Acme Framing" }),
    it("grade", "2026-10-26", "2026-10-28", { phase_id: "p0" }),                 // late, before the window
    it("roof", "2026-11-23", "2026-11-30"),                                       // after the window
    it("done-old", "2026-10-01", "2026-10-02", { status: "complete", percent_complete: 100 }),
    it("loose", "2026-11-16", "2026-11-16", { phase_id: null, kind: "milestone" }),
  ], phases, [], "2026-11-06");
  assert.deepEqual(la.groups.map((g) => [g.phase, g.rows.map((r) => r.id)]), [["Site", ["grade"]], ["Framing", ["frame"]], ["Other", ["loose"]]]);
  const frame = la.groups[1].rows[0];
  assert.equal(frame.status, "in_progress");
  assert.equal(frame.trade, "Acme Framing");
  assert.deepEqual(frame.days, [2, 3, 4, 5, 6, 7, 8]);
  assert.equal(la.groups[0].rows[0].status, "late");
});

test("a task waiting on an undecided selection is flagged when the decision is due after it starts", () => {
  const sel = [{ id: "s1", name: "Kitchen tile", status: "pending", target_decision_date: "2026-11-20", client_visible: true }];
  const la = buildLookahead([it("tile", "2026-11-16", "2026-11-18", { link_type: "selection", link_id: "s1" })], phases, sel, "2026-11-06");
  assert.deepEqual(la.groups[0].rows[0].waitsOn, { name: "Kitchen tile", decided: false, due: "2026-11-20", late: true });
});

test("the client version keeps client tasks only, without trades, internal selections or 'late'", () => {
  const sel = [{ id: "s1", name: "Internal pick", status: "pending", target_decision_date: null, client_visible: false }];
  const la = buildLookahead([
    it("a", "2026-10-26", "2026-10-28", { responsible_company: "Acme" }),
    it("b", "2026-11-09", "2026-11-10", { client_visible: false }),
    it("c", "2026-11-09", "2026-11-10", { link_type: "selection", link_id: "s1" }),
  ], phases, sel, "2026-11-06", "client");
  const rows = la.groups.flatMap((g) => g.rows);
  assert.deepEqual(rows.map((r) => r.id), ["a", "c"]);
  assert.equal(rows[0].trade, null);
  assert.equal(rows[0].status, "not_started");
  assert.equal(rows[1].waitsOn, null);
});

test("inspection milestones carry their status and request-by (internal only)", () => {
  const m = it("insp", "2026-11-10", "2026-11-10", { kind: "milestone", inspection_step_id: "S-M01", inspection_status: "ready_to_call" });
  const la = buildLookahead([m], phases, [], "2026-11-09", "internal", { minutes: 21 * 60, method: "IVR" });
  assert.deepEqual(la.groups[0].rows[0].inspection, { status: "Ready to Call", requestBy: "Request by Mon 9:00 PM (IVR)", callNow: true });
  const client = buildLookahead([m], phases, [], "2026-11-09", "client", { minutes: 1260, method: null });
  assert.equal(client.groups[0].rows[0].inspection, null);
  const passed = buildLookahead([{ ...m, inspection_status: "passed" }], phases, [], "2026-11-09", "internal", { minutes: 1260, method: null });
  assert.equal(passed.groups[0].rows[0].inspection.requestBy, null);
});
