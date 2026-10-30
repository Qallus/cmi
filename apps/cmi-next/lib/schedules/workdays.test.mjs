import { strict as assert } from "node:assert";
import { test } from "node:test";
import { addWorkdays, workdayDiff, workdaysBetween, parseISO, fmtISO } from "./workdays.ts";
import { NEW_CONSTRUCTION_TEMPLATE as T } from "./template-new-construction.ts";

const WD = { mon: true, tue: true, wed: true, thu: true, fri: true, sat: false, sun: false };
const add = (iso, n) => fmtISO(addWorkdays(parseISO(iso), n, WD));

test("addWorkdays skips weekends both ways", () => {
  assert.equal(add("2026-10-30", 1), "2026-11-02"); // Fri + 1 → Mon
  assert.equal(add("2026-11-02", -1), "2026-10-30"); // Mon − 1 → Fri
  assert.equal(add("2026-10-31", 0), "2026-11-02"); // Sat snaps to Mon
  assert.equal(add("2025-05-23", -19), "2025-04-28"); // the template's FS −20 lag
});

test("workdayDiff is signed and undoes addWorkdays", () => {
  assert.equal(workdayDiff(parseISO("2026-10-30"), parseISO("2026-11-02"), WD), 1);
  assert.equal(workdayDiff(parseISO("2026-11-02"), parseISO("2026-10-30"), WD), -1);
  assert.equal(workdayDiff(parseISO("2026-11-02"), parseISO("2026-11-02"), WD), 0);
  for (const n of [-40, -5, 0, 3, 207]) assert.equal(workdayDiff(parseISO("2026-11-02"), addWorkdays(parseISO("2026-11-02"), n, WD), WD), n);
});

test("New Construction template is complete and consistent", () => {
  const keys = new Set(T.items.map((i) => i.key));
  const phases = new Set(T.phases.map((p) => p.key));
  assert.equal(T.items.length, 76);
  assert.equal(T.unit, "workdays");
  for (const i of T.items) {
    assert.ok(phases.has(i.phaseKey), `${i.title} has a phase`);
    for (const d of i.deps ?? []) assert.ok(keys.has(d.on), `${i.title} depends on a real task`);
  }
});

test("New Construction lays out on the original dates from its original start", () => {
  const at = (key) => T.items.find((i) => i.key === key);
  const start = (key) => add("2025-04-21", at(key).offset);
  assert.equal(start("t9"), "2025-04-28"); // Engineering Design
  assert.equal(start("t47"), "2025-09-08"); // A/V pre-wire (no predecessor)
  assert.equal(start("t76"), "2026-02-03"); // Completion/Final Walkthrough
});

test("New Construction: no task starts before its links allow", () => {
  const base = "2026-11-02";
  const range = new Map(T.items.map((i) => {
    const s = add(base, i.offset);
    return [i.key, { s, e: i.kind === "milestone" ? s : add(s, (i.duration ?? 1) - 1) }];
  }));
  for (const i of T.items) {
    for (const d of i.deps ?? []) {
      if (d.type && d.type !== "finish_to_start") continue;
      const earliest = add(range.get(d.on).e, 1 + (d.lag ?? 0));
      assert.ok(range.get(i.key).s >= earliest, `${i.title} starts ${range.get(i.key).s}, its link allows ${earliest}`);
    }
  }
  const len = workdaysBetween(parseISO(base), parseISO(range.get("t76").e), WD);
  assert.ok(len >= 200 && len <= 210, `about 207 working days (got ${len})`);
});
