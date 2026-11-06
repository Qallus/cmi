import { strict as assert } from "node:assert";
import { test } from "node:test";
import { orderByDate, weekdaysBefore } from "./order-by.ts";

test("order by = earliest successor start − lead, in weekdays", () => {
  assert.equal(weekdaysBefore("2026-11-16", 5), "2026-11-09");
  assert.equal(weekdaysBefore("2026-11-09", 1), "2026-11-06"); // Mon → Fri
  assert.equal(orderByDate({ start_date: "2026-11-02", lead_time_days: 10 }, ["2026-11-30", "2026-11-23"]), "2026-11-09");
  assert.equal(orderByDate({ start_date: "2026-11-23", lead_time_days: 5 }, []), "2026-11-16");
  assert.equal(orderByDate({ start_date: "2026-11-23", lead_time_days: 0 }, ["2026-11-30"]), null);
});
