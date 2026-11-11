import { strict as assert } from "node:assert";
import { test } from "node:test";
import { scheduleHealth } from "./health.ts";
import { makeCalendar } from "./calendar.ts";

const WD = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const wc = { workdays: WD, exceptions: [{ date: "2026-11-03", working: false, type: "weather", label: "Rain" }] };
const cal = makeCalendar(wc);
const it = (id, start, end, extra = {}) => ({ id, title: id.toUpperCase(), kind: "task", status: "not_started", start_date: start, end_date: end, percent_complete: 0, ...extra });
const base = { selections: [], cal, workCalendar: wc, onEngine: false, statusDate: "2026-11-06", today: "2026-11-06", engineFinish: null, targetCompletion: null, startDate: "2026-11-02" };
const tile = (h, k) => h.tiles.find((t) => t.key === k);

test("baseline, behind and weather tiles", () => {
  const h = scheduleHealth({ ...base, items: [
    it("a", "2026-11-02", "2026-11-04", { baseline_end: "2026-11-04" }),                     // finish due, still open
    it("b", "2026-11-09", "2026-11-13", { baseline_end: "2026-11-11" }),                     // forecast 2 wd later
    it("c", "2026-11-02", "2026-11-05", { status: "complete", percent_complete: 100 }),
  ] });
  assert.equal(h.finish, "2026-11-13");
  assert.equal(tile(h, "baseline").value, "+2 wd");
  assert.equal(tile(h, "baseline").tone, "bad");
  assert.deepEqual(tile(h, "baseline").tasks.map((t) => t.id), ["b"]);
  assert.equal(tile(h, "behind").value, "1");
  assert.equal(tile(h, "weather").value, "1");
  assert.equal(tile(h, "critical"), undefined); // not on the engine
});

test("contract variance and float on the finish read the contract completion", () => {
  const h = scheduleHealth({ ...base, items: [
    it("work", "2026-11-09", "2026-11-20"),
    it("done", "2026-11-20", "2026-11-20", { kind: "milestone", milestone_type: "contract", contract_date: "2026-11-24" }),
  ] });
  assert.equal(tile(h, "contract").value, "-2 wd");
  assert.equal(tile(h, "contract").tone, "good");
  assert.equal(tile(h, "float").value, "2 wd");
  assert.equal(tile(h, "float").tone, "warn");
});

test("late selections: undecided past due, or due after the work starts", () => {
  const h = scheduleHealth({ ...base,
    selections: [{ id: "s1", name: "Tile", status: "pending", target_decision_date: "2026-11-20" }, { id: "s2", name: "Paint", status: "approved", target_decision_date: "2026-11-01" }],
    items: [
      it("tile", "2026-11-16", "2026-11-18", { link_type: "selection", link_id: "s1" }),
      it("paint", "2026-11-16", "2026-11-18", { link_type: "selection", link_id: "s2" }),
    ] });
  assert.deepEqual(tile(h, "selections").tasks.map((t) => t.id), ["tile"]);
  assert.ok(h.issues >= 1);
});

test("waiting on inspection tile only when the schedule has inspections", () => {
  assert.equal(tile(scheduleHealth({ ...base, items: [it("a", "2026-11-02", "2026-11-04")] }), "inspections"), undefined);
  const ms = (id, st) => it(id, "2026-11-10", "2026-11-10", { kind: "milestone", inspection_step_id: id, inspection_status: st });
  const h = scheduleHealth({ ...base, items: [ms("m1", "scheduled"), ms("m2", "failed"), ms("m3", "not_ready")] });
  const t = tile(h, "inspections");
  assert.equal(t.value, "2");
  assert.equal(t.tone, "bad");
  assert.match(t.note, /1 failed/);
});
