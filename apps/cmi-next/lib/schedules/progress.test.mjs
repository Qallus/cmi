import { strict as assert } from "node:assert";
import { test } from "node:test";
import { progressPatch, todayAZ } from "./progress.ts";

const T = "2026-11-05";

test("progress: % complete stamps actuals and status", () => {
  const fresh = { percent_complete: 0, status: "not_started", start_date: "2026-11-02" };
  assert.deepEqual(progressPatch(fresh, { percent_complete: 40 }, T), { actual_start: T, status: "in_progress" });
  assert.deepEqual(progressPatch(fresh, { percent_complete: 100 }, T), { actual_start: T, actual_finish: T, status: "complete" });
  // An actual start already set is kept.
  assert.deepEqual(progressPatch({ ...fresh, actual_start: "2026-11-02", percent_complete: 40, status: "in_progress" }, { percent_complete: 60 }, T), {});
  // Back below 100 reopens a finished task.
  assert.deepEqual(progressPatch({ percent_complete: 100, status: "complete", actual_start: "2026-11-02", actual_finish: "2026-11-04" }, { percent_complete: 80 }, T),
    { actual_finish: null, status: "in_progress" });
  // Back to 0 clears the stamps.
  assert.deepEqual(progressPatch({ percent_complete: 30, status: "in_progress", actual_start: "2026-11-02" }, { percent_complete: 0 }, T),
    { actual_start: null, actual_finish: null, status: "not_started" });
  // Changing % drops a typed remaining so the forecast follows the %.
  assert.deepEqual(progressPatch({ percent_complete: 30, status: "in_progress", actual_start: "2026-11-02", remaining_duration: 2 }, { percent_complete: 50 }, T),
    { remaining_duration: null });
  // Out-of-range values are clamped.
  assert.equal(progressPatch(fresh, { percent_complete: 140 }, T).percent_complete, 100);
});

test("progress: actual dates and Complete status", () => {
  assert.deepEqual(progressPatch({ percent_complete: 20, status: "in_progress", actual_start: "2026-11-02" }, { actual_finish: "2026-11-04" }, T),
    { percent_complete: 100, status: "complete" });
  assert.deepEqual(progressPatch({ percent_complete: 0, status: "not_started" }, { actual_finish: "2026-11-04" }, T),
    { percent_complete: 100, status: "complete", actual_start: "2026-11-04" });
  assert.deepEqual(progressPatch({ percent_complete: 0, status: "not_started" }, { actual_start: "2026-11-03" }, T), { status: "in_progress" });
  assert.deepEqual(progressPatch({ percent_complete: 0, status: "scheduled", start_date: "2026-11-02" }, { status: "complete" }, T),
    { percent_complete: 100, actual_start: "2026-11-02", actual_finish: T });
  // Unrelated edits change nothing.
  assert.deepEqual(progressPatch({ percent_complete: 10 }, { title: "Renamed" }, T), {});
});

test("progress: today is Arizona's date", () => {
  // 03:00 UTC on Nov 6 is still Nov 5 in Phoenix (UTC−7).
  assert.equal(todayAZ(new Date("2026-11-06T03:00:00Z")), "2026-11-05");
});
