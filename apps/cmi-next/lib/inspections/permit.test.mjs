import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parsePermitList, reconcile, permitTitle, permitStepId } from "./permit.ts";

test("parses the shapes permits print inspections in", () => {
  const lines = parsePermitList([
    "Required Inspections",
    "Code\tDescription",
    "615 Footing",
    "Stem Wall (701)",
    "730 - Underground Plumbing",
    "1. 759 Final Electrical",
    "Code 900: Final Building",
    "Final Grading",
    "",
  ].join("\n"));
  assert.deepEqual(lines.map((l) => [l.code, l.name]), [
    ["615", "Footing"], ["701", "Stem Wall"], ["730", "Underground Plumbing"], ["759", "Final Electrical"], ["900", "Final Building"], [null, "Final Grading"],
  ]);
});

const it = (id, title, code, o = {}) => ({ id, title, inspection_step_id: o.step ?? id.toUpperCase(), inspection_code: code, inspection_status: "not_ready", ...o });

test("matches by code, then by name; copies move together; the rest is split both ways", () => {
  const items = [
    it("a1", "INSP · Footing / UFER (700) (1 of 2)", "700", { step: "S-M06" }),
    it("a2", "INSP · Footing / UFER (700) (2 of 2)", "700", { step: "S-M06" }),
    it("b", "INSP · Stem wall (701)", "701"),
    it("c", "INSP · Final electrical (759)", "759"),
    it("d", "INSP · Pool final (605)", "605"),
    it("e", "INSP · Final building", "Per permit"),
    it("m", "MS · Permit issued & posted", null, { inspection_status: null }),
  ];
  const r = reconcile(parsePermitList("700 Footing\n701 Stem Wall\nFinal Building\n745 Final Plumbing\n759 Final Electrical"), items);
  assert.deepEqual(r.matched.map((m) => [m.line.name, m.items.map((i) => i.id), m.by]), [
    ["Footing", ["a1", "a2"], "code"], ["Stem Wall", ["b"], "code"], ["Final Building", ["e"], "name"], ["Final Electrical", ["c"], "code"],
  ]);
  assert.deepEqual(r.scheduleOnly.map((i) => i.id), ["d"]); // the MS row isn't an inspection
  assert.deepEqual(r.permitOnly.map((l) => l.code), ["745"]);
});

test("final vs rough names don't cross-match", () => {
  const r = reconcile(parsePermitList("Rough Electrical"), [it("c", "INSP · Final electrical (759)", "759")]);
  assert.equal(r.matched.length, 0);
});

test("titles and step IDs from the permit", () => {
  assert.equal(permitTitle("INSP · Footing / UFER (700) (2 of 2)", { n: 1, code: "615", name: "Footing", raw: "" }), "INSP · Footing (615) (2 of 2)");
  assert.equal(permitTitle("Footing", { n: 1, code: null, name: "Footing", raw: "" }), "INSP · Footing");
  assert.equal(permitStepId({ n: 3, code: "745", name: "Final Plumbing", raw: "" }), "PERMIT-745");
  assert.equal(permitStepId({ n: 3, code: null, name: "Final Grading", raw: "" }), "PERMIT-FINAL-GRADING");
});

test("hyphens inside names stay", () => {
  assert.deepEqual(parsePermitList("707 Pre-Slab\n615 - Footing\n733: Top-Out").map((l) => l.name), ["Pre-Slab", "Footing", "Top-Out"]);
});
