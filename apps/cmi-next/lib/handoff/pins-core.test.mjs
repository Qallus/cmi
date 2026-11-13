import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pinIsShown, otherAreas } from "./pins-core.ts";

const pin = (extra = {}) => ({ id: "p", record_type: "job", record_id: "j1", show_in: "precon", ...extra });

test("a Job pinned to Pre-Con shows there while the Job is its home", () => {
  assert.equal(pinIsShown(pin(), true), true);
});

test("no pin once the record isn't the home (moved back or archived)", () => {
  assert.equal(pinIsShown(pin(), false), false);
});

test("a pin to the record's own area never shows (it's already there)", () => {
  assert.equal(pinIsShown(pin({ show_in: "jobs" }), true), false);
});

test("an expired pin doesn't show; no expiry means it stays", () => {
  assert.equal(pinIsShown(pin({ expires_at: "2026-01-01T00:00:00Z" }), true, "2026-11-13T00:00:00Z"), false);
  assert.equal(pinIsShown(pin({ expires_at: null }), true), true);
});

test("a record can be pinned to the two other boards", () => {
  assert.deepEqual(otherAreas("deal"), ["precon", "jobs"]);
  assert.deepEqual(otherAreas("job"), ["pipeline", "precon"]);
});
