import { strict as assert } from "node:assert";
import { test } from "node:test";
import { updateRows, nextWeekday, daysBetween, fallbackNarrative } from "./weekly-update.ts";

const t = (id, start, end, extra = {}) => ({ id, title: id.toUpperCase(), kind: "task", status: "not_started", start_date: start, end_date: end, percent_complete: 0, ...extra });

test("an update holds open work due by today and work finished in the period", () => {
  const rows = updateRows([
    t("late", "2026-10-20", "2026-10-24"),                                        // should have started, still 0%
    t("going", "2026-10-28", "2026-11-10", { percent_complete: 40, actual_start: "2026-10-28", status: "in_progress" }),
    t("due", "2026-10-26", "2026-11-03", { percent_complete: 80, actual_start: "2026-10-26", status: "in_progress" }),
    t("done", "2026-10-26", "2026-10-30", { percent_complete: 100, status: "complete", actual_finish: "2026-10-30" }),
    t("olddone", "2026-10-01", "2026-10-05", { percent_complete: 100, status: "complete", actual_finish: "2026-10-05" }),
    t("future", "2026-11-12", "2026-11-20"),
    t("gone", "2026-10-20", "2026-10-24", { status: "cancelled" }),
    t("ms", "2026-11-01", "2026-11-01", { kind: "milestone" }),
  ], "2026-10-27", "2026-11-04");
  assert.deepEqual(rows.map((r) => [r.task.id, r.flag]), [
    ["late", "not_started"], ["ms", "not_started"], ["due", "finish_due"], ["going", null], ["done", null],
  ]);
});

test("with no status date yet, everything open up to today is in", () => {
  const rows = updateRows([t("a", "2026-09-01", "2026-09-05", { percent_complete: 50, actual_start: "2026-09-01" }), t("b", "2026-12-01", "2026-12-02")], null, "2026-11-04");
  assert.deepEqual(rows.map((r) => r.task.id), ["a"]);
});

test("push dates skip the weekend", () => {
  assert.equal(nextWeekday("2026-11-06"), "2026-11-09"); // Fri → Mon
  assert.equal(nextWeekday("2026-11-04"), "2026-11-05");
  assert.equal(daysBetween("2026-11-04", "2026-11-09"), 5);
});

test("the fallback narrative covers progress, changes and the next two weeks", () => {
  const text = fallbackNarrative({
    schedule: "Construction", job: "26_001", from: "2026-10-27", to: "2026-11-04",
    finishBefore: "2027-03-01", finishAfter: "2027-03-04",
    completed: ["Framing"], started: ["Roofing"], inProgress: [{ title: "Roofing", pct: 30 }],
    pushed: [{ title: "Windows", reason: "Supplier delay", to: "2026-11-09" }], movedCount: 12, moved: [{ title: "Drywall", from: "2026-11-10", to: "2026-11-13" }],
    critical: ["Roofing", "Drywall"], nextTwoWeeks: [{ title: "Drywall", start: "2026-11-13", end: "2026-11-20" }],
  });
  assert.match(text, /Completed: Framing/);
  assert.match(text, /moved from Mar 1 to Mar 4 \(\+3 days\)/);
  assert.match(text, /Windows was pushed to Nov 9: Supplier delay/);
  assert.match(text, /12 tasks moved with the re-forecast, including on the critical path: Drywall \(Nov 10 → Nov 13\)/);
  assert.match(text, /Drywall: Nov 13 – Nov 20/);
});
