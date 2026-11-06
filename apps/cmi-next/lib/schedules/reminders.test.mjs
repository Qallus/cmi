import { strict as assert } from "node:assert";
import { test } from "node:test";
import { startReminders, weekdaysUntil, reminderSubtitle } from "./reminders.ts";

const t = (id, start, extra = {}) => ({ id, title: id.toUpperCase(), job_id: "j1", schedule_id: "s1", status: "not_started", start_date: start, percent_complete: 0, assignees: [{ id: "ben", type: "staff" }, { id: "acme", type: "vendor" }], ...extra });

test("weekdays skip the weekend", () => {
  assert.equal(weekdaysUntil("2026-11-06", "2026-11-06"), 0);
  assert.equal(weekdaysUntil("2026-11-06", "2026-11-09"), 1); // Fri → Mon
  assert.equal(weekdaysUntil("2026-11-06", "2026-11-13"), 5);
  assert.equal(weekdaysUntil("2026-11-06", "2026-11-05"), -1);
});

test("staff assignees of open tasks inside the job's window, once per start date", () => {
  const r = startReminders([
    t("soon", "2026-11-13"),                                     // 5 working days: in
    t("later", "2026-11-16"),                                    // 6: out
    t("started", "2026-11-09", { actual_start: "2026-11-06" }),  // already started: out
    t("done", "2026-11-09", { status: "complete" }),
    t("other", "2026-11-09", { job_id: "j2" }),                  // job j2 has reminders off
  ], (job) => (job === "j2" ? 0 : 5), "2026-11-06");
  assert.deepEqual(r.map((x) => [x.itemId, x.staffId, x.inDays, x.dedupe]), [["soon", "ben", 5, "start:soon:2026-11-13"]]);
  assert.equal(reminderSubtitle({ start: "2026-11-09", inDays: 1 }), "Starts tomorrow (Mon, Nov 9)");
});
