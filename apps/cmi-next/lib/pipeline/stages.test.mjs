import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validateTransition, missingForStage } from "./stages.ts";

const opp = (extra = {}) => ({ id: "o1", stage: "opportunity", ...extra });

test("guarded move: off-path and missing fields are refused", () => {
  const r = validateTransition(opp(), "active_project");
  assert.equal(r.ok, false);
  const r2 = validateTransition(opp({ stage: "pre_construction_design" }), "active_project");
  assert.equal(r2.ok, false);
  assert.deepEqual(r2.missing, ["construction_agreement_status", "start_date", "project_manager"]);
});

test("manual move: any stage, missing fields reported but not blocking", () => {
  const r = validateTransition(opp({ project_manager: "Ben" }), "active_project", {}, { manual: true });
  assert.equal(r.ok, true);
  assert.deepEqual(r.missing, ["construction_agreement_status", "start_date"]);
  assert.deepEqual(validateTransition(opp({ stage: "warranty" }), "opportunity", {}, { manual: true }), { ok: true, missing: [] });
});

test("manual move to the same stage is refused", () => {
  assert.equal(validateTransition(opp(), "opportunity", {}, { manual: true }).ok, false);
});

test("missing for the record's current stage", () => {
  assert.deepEqual(missingForStage({ stage: "not_moving_forward", lost_reason: "" }), ["lost_reason"]);
  assert.deepEqual(missingForStage({ stage: "opportunity" }), []);
});
