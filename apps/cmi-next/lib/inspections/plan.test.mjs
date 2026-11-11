import { strict as assert } from "node:assert";
import { test } from "node:test";
import { candidatesFor, buildPlan, hookTaskTitles, milestoneKey } from "./plan.ts";

const row = (o) => ({
  milestone_id: "X-M01", jurisdiction_code: "X", sort_order: 1, phase_id: "P02", phase: "Foundation", doc_step: null,
  gantt_name: "INSP · Footing / UFER", jurisdiction_name: "Footing", code: "615", code_basis: "Published",
  milestone_type: "inspection", scope_new: "Y", scope_add: "Y", scope_ren: "—", include_when: null,
  predecessor_hook: "Excavate footings", released_hook: "Pour footings", hold_point: true,
  request_rule: "IVR by 9 PM", ready_checklist: "Steel chaired", repeats: null, show_on_master: "Milestones only", notes: null, verified_on: null,
  ...o,
});
const task = (id, title, o = {}) => ({ id, title, kind: "task", status: "not_started", phase_id: "ph1", start_date: "2026-12-01", end_date: "2026-12-05", ...o });
const hooks = [
  { phase_id: "P02", hook: "Excavate footings", role: "predecessor", match_kind: "task", template_task: "Pad Prep, Footings and form boards" },
  { phase_id: "P02", hook: "Pour footings", role: "released", match_kind: "task", template_task: "Pour and Cure" },
  { phase_id: "P08", hook: "All rough trades complete", role: "predecessor", match_kind: "task", template_task: "Electrical Rough-In + Plumbing Rough In (all five)" },
  { phase_id: "P04", hook: "Backfill", role: "released", match_kind: "add", template_task: "Backfill & Compact" },
  { phase_id: "P11", hook: "Final building (next day or later)", role: "released", match_kind: "milestone", template_task: "Final building" },
];

test("hook titles and milestone keys", () => {
  assert.deepEqual(hookTaskTitles("Electrical Rough-In + HVAC Rough In + House Wrap (all five)"), ["Electrical Rough-In", "HVAC Rough In", "House Wrap"]);
  assert.deepEqual(hookTaskTitles("Landscaping/Finish Grade + Flatwork"), ["Landscaping/Finish Grade", "Flatwork"]);
  assert.equal(milestoneKey("INSP · Final drainage (970 (legacy))"), "final drainage");
  assert.equal(milestoneKey("Footing / UFER inspection"), "footing / ufer");
});

test("candidates follow scope, conditions and what's already loaded", () => {
  const rows = [
    row({ milestone_id: "X-M01" }),
    row({ milestone_id: "X-M02", scope_new: "If pool" }),
    row({ milestone_id: "X-M03", scope_new: "If gas" }),
    row({ milestone_id: "X-M04", scope_new: "As needed" }),
    row({ milestone_id: "X-M05", scope_new: "—" }),
  ];
  const items = [task("t1", "Pad Prep, Footings and form boards"), task("t2", "Pour and Cure"),
    { id: "m9", title: "INSP · Footing / UFER", kind: "milestone", start_date: null, end_date: null, inspection_step_id: "X-M01" }];
  const c = candidatesFor(rows, "NEW", ["pool"], items, hooks);
  assert.deepEqual(c.map((x) => [x.row.milestone_id, x.state, x.selected]), [
    ["X-M01", "include", false],        // already loaded once
    ["X-M02", "condition_on", true],
    ["X-M03", "condition_off", false],
    ["X-M04", "confirm", false],
  ]);
  assert.equal(c[0].alreadyLoaded, 1);
  assert.deepEqual(c[1].follows, ["Pad Prep, Footings and form boards"]);
  assert.deepEqual(c[1].releases, ["Pour and Cure"]);
});

test("a task named like the hook wins over the template mapping; missing tasks are reported", () => {
  const items = [task("t1", "Pad Prep, Footings and form boards"), task("t2", "Pour Footings", { start_date: "2026-12-08" })];
  const [c] = candidatesFor([row({})], "NEW", [], items, hooks);
  assert.deepEqual(c.releases, ["Pour Footings"]);
  const [d] = candidatesFor([row({ released_hook: "Backfill" })], "NEW", [], items, hooks);
  assert.equal(d.releases.length, 0);
  assert.match(d.missing[0], /Backfill & Compact/);
});

test("plan: milestones sit at the predecessor's finish and link Finish→Start both ways", () => {
  const items = [task("t1", "Pad Prep, Footings and form boards", { end_date: "2026-12-05" }), task("t2", "Pour and Cure", { start_date: "2026-12-08" })];
  const p = buildPlan([{ row: row({}), count: 1 }], items, hooks, [], { today: "2026-11-11" });
  assert.equal(p.milestones.length, 1);
  assert.equal(p.milestones[0].date, "2026-12-05");
  assert.equal(p.milestones[0].schedule_phase_id, "ph1");
  assert.match(p.milestones[0].internal_notes, /Code: 615/);
  assert.deepEqual(p.links.map((l) => [l.source, l.target, l.lag]), [["t1", "new:X-M01", 0], ["new:X-M01", "t2", 0]]);
});

test("plan: repeating rows become numbered copies", () => {
  const items = [task("t1", "Pad Prep, Footings and form boards"), task("t2", "Pour and Cure")];
  const p = buildPlan([{ row: row({ repeats: "Per pour" }), count: 3 }], items, hooks, []);
  assert.deepEqual(p.milestones.map((m) => m.title), ["INSP · Footing / UFER (1 of 3)", "INSP · Footing / UFER (2 of 3)", "INSP · Footing / UFER (3 of 3)"]);
  assert.equal(p.links.length, 6);
});

test("plan: a milestone hook links to another inspection, Maricopa's next-day rule adds a working day", () => {
  const drainage = row({ milestone_id: "MCO-M23", phase_id: "P11", gantt_name: "INSP · Final drainage (970 (legacy))", predecessor_hook: "", released_hook: "Final building (next day or later)" });
  const final = row({ milestone_id: "MCO-M28", phase_id: "P13", gantt_name: "INSP · Final building (900 (legacy))", predecessor_hook: "", released_hook: "" });
  const p = buildPlan([{ row: drainage, count: 1 }, { row: final, count: 1 }], [], hooks, []);
  assert.deepEqual(p.links.map((l) => [l.source, l.target, l.lag]), [["new:MCO-M23", "new:MCO-M28", 1]]);
});

test("plan: a link that would loop back is skipped and reported", () => {
  const items = [task("a", "Pad Prep, Footings and form boards"), task("b", "Pour and Cure")];
  // Existing link Pour and Cure → Pad Prep, so Pad Prep → M → Pour and Cure would loop.
  const p = buildPlan([{ row: row({}), count: 1 }], items, hooks, [{ source_item_id: "b", target_item_id: "a" }]);
  assert.equal(p.links.length, 1);
  assert.equal(p.skipped.length, 1);
  assert.match(p.skipped[0].note, /loop/);
});

test("plan: a milestone with no task to date it from sits with its nearest linked neighbour", () => {
  const items = [task("t1", "Pad Prep, Footings and form boards", { end_date: "2027-01-13" }), task("t2", "Pour and Cure", { start_date: "2027-01-27" })];
  const footing = row({ milestone_id: "X-M06", sort_order: 6 });
  const orphan = row({ milestone_id: "X-M07", sort_order: 7, gantt_name: "INSP · Pool steel", predecessor_hook: "Pool steel set", released_hook: "" });
  const p = buildPlan([{ row: orphan, count: 1 }, { row: footing, count: 1 }], items, hooks, [], { today: "2026-11-11" });
  assert.equal(p.milestones.find((m) => m.step_id === "X-M07").date, "2027-01-13");
  const alone = buildPlan([{ row: orphan, count: 1 }], items, hooks, [], { today: "2026-11-11" });
  assert.equal(alone.milestones[0].date, "2026-11-11"); // nothing dated to borrow from
});
