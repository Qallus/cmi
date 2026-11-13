import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dealMovedOn, preconMovedOn, homeOf, liveJobOppIdSet, isJobPhaseStage } from "./home.ts";

test("a Closed Won deal has left the Pipeline; other stages haven't", () => {
  assert.equal(dealMovedOn({ stage: "closed_won" }), true);
  assert.equal(dealMovedOn({ stage: "negotiation" }), false);
});

test("a Pre-Con record leaves Pre-Con only when a live Job links to it", () => {
  const ids = liveJobOppIdSet([
    { related_opportunity_id: "o1", archived_at: null },
    { related_opportunity_id: "o2", archived_at: "2026-11-13" },
    { related_opportunity_id: null },
  ]);
  assert.equal(preconMovedOn("o1", ids), true);
  assert.equal(preconMovedOn("o2", ids), false); // its Job was archived (moved back)
  assert.equal(preconMovedOn("o3", ids), false);
});

test("home is the furthest live record", () => {
  assert.equal(homeOf({ deal: { stage: "closed_won" }, precon: {}, job: {} }), "jobs");
  assert.equal(homeOf({ deal: { stage: "closed_won" }, precon: {}, job: { archived_at: "x" } }), "precon");
  assert.equal(homeOf({ deal: { stage: "negotiation" }, precon: { archived_at: "x" } }), "pipeline");
  assert.equal(homeOf({}), null);
});

test("Active Project, Warranty and Closed are Job phases", () => {
  assert.equal(isJobPhaseStage("active_project"), true);
  assert.equal(isJobPhaseStage("pre_construction_design"), false);
});
