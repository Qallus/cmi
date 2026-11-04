import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runCpm } from "./cpm.ts";
import { makeCalendar, mergeCalendars, cmiHolidays, countExceptions, addW, workDiff, latestFrom, dayNum, isoOf, CALENDAR_DAYS } from "./calendar.ts";
import { parseLinks, formatLinks, parseDuration, successorsOf, idBetween, validateLinks } from "./predecessors.ts";
import { NEW_CONSTRUCTION_TEMPLATE as T } from "./template-new-construction.ts";

const WEEK = makeCalendar(mergeCalendars({}));
const cals = { job: WEEK, calendar_days: CALENDAR_DAYS };
const fs = (from, to, lag = 0) => ({ from, to, type: "finish_to_start", lag });
const run = (tasks, links, extra = {}) => runCpm({ start: "2026-11-02", tasks, links, calendars: cals, defaultCalendar: "job", ...extra });

test("calendar: merge levels, holidays, worked Saturday, counts", () => {
  const company = { workdays: null, exceptions: cmiHolidays(2026) };
  const job = { workdays: { sat: true }, exceptions: [
    { date: "2026-11-27", working: true, type: "other", label: "Working the Friday" },
    { date: "2026-11-18", working: false, type: "weather", label: "Monsoon" },
  ] };
  const merged = mergeCalendars(company, job);
  const cal = makeCalendar(merged);
  assert.equal(cal.isWorking(dayNum("2026-11-26")), false, "Thanksgiving closed");
  assert.equal(cal.isWorking(dayNum("2026-11-27")), true, "job reopens the Friday");
  assert.equal(cal.isWorking(dayNum("2026-11-28")), true, "Saturday worked");
  assert.equal(cal.isWorking(dayNum("2026-11-29")), false, "Sunday off");
  assert.equal(cal.isWorking(dayNum("2026-11-18")), false, "weather day");
  assert.deepEqual(countExceptions(merged, "2026-11-01", "2026-11-30"), { holiday: 1, weather: 1, jurisdiction: 0, owner: 0, other: 0 });
  const h = cmiHolidays(2026).map((e) => `${e.date} ${e.label}`);
  assert.ok(h.includes("2026-05-25 Memorial Day"));
  assert.ok(h.includes("2026-09-07 Labor Day"));
  assert.ok(h.includes("2026-11-26 Thanksgiving"));
});

test("calendar: addW / workDiff / latestFrom agree", () => {
  const fri = dayNum("2026-10-30");
  assert.equal(isoOf(addW(WEEK, fri, 1)), "2026-11-02");
  assert.equal(isoOf(addW(WEEK, dayNum("2026-10-31"), 0)), "2026-11-02");
  assert.equal(isoOf(addW(WEEK, dayNum("2026-10-31"), 1)), "2026-11-02", "Sat + 1 is Monday, not Tuesday");
  for (const n of [-12, -1, 0, 1, 5, 40]) assert.equal(workDiff(WEEK, fri, addW(WEEK, fri, n)), n);
  for (const n of [-3, 0, 1, 4]) {
    const target = dayNum("2026-11-11");
    const f = latestFrom(WEEK, target, n);
    assert.ok(addW(WEEK, f, n) <= target && addW(WEEK, f + 1, n) > target);
  }
});

test("textbook network: forward, backward, float, critical path", () => {
  // Calendar days for easy arithmetic. A(3) → B(2), C(4) → D(2).
  const r = runCpm({
    start: "2026-01-01", calendars: cals, defaultCalendar: "calendar_days",
    tasks: [{ id: "A", duration: 3 }, { id: "B", duration: 2 }, { id: "C", duration: 4 }, { id: "D", duration: 2 }],
    links: [fs("A", "B"), fs("A", "C"), fs("B", "D"), fs("C", "D")],
  });
  const g = (id) => r.tasks.get(id);
  assert.equal(g("A").earlyFinish, "2026-01-03");
  assert.equal(g("C").earlyStart, "2026-01-04");
  assert.equal(g("D").earlyStart, "2026-01-08");
  assert.equal(r.finish, "2026-01-09");
  assert.equal(g("B").totalFloat, 2);
  assert.equal(g("B").freeFloat, 2);
  assert.equal(g("B").lateStart, "2026-01-06");
  assert.deepEqual(r.criticalPath, ["A", "C", "D"]);
  assert.ok(g("B").nearCritical);
  assert.deepEqual(r.orphans, { noPredecessor: ["A"], noSuccessor: ["D"] });
});

test("working days: a 10-day task from Friday finishes Thursday of the week after next", () => {
  const r = run([{ id: "x", duration: 10, constraint: "snet", constraintDate: "2026-11-06" }], []);
  assert.equal(r.tasks.get("x").start, "2026-11-06");
  assert.equal(r.tasks.get("x").finish, "2026-11-19");
});

test("all four link types with lag, including negative lag", () => {
  const tasks = [{ id: "p", duration: 5 }, { id: "fs", duration: 2 }, { id: "ss", duration: 2 }, { id: "ff", duration: 3 }, { id: "sf", duration: 2 }, { id: "neg", duration: 2 }];
  const links = [
    fs("p", "fs", 2),
    { from: "p", to: "ss", type: "start_to_start", lag: 2 },
    { from: "p", to: "ff", type: "finish_to_finish", lag: 1 },
    { from: "p", to: "sf", type: "start_to_finish", lag: 3 },
    fs("p", "neg", -2),
  ];
  const r = run(tasks, links);
  const g = (id) => r.tasks.get(id);
  // p: Mon 11/2 – Fri 11/6
  assert.equal(g("p").finish, "2026-11-06");
  assert.equal(g("fs").start, "2026-11-11", "FS+2: Mon 11/9 + 2 working days");
  assert.equal(g("ss").start, "2026-11-04", "SS+2");
  assert.equal(g("ff").finish, "2026-11-09", "FF+1: finishes Monday after p");
  assert.equal(g("ff").start, "2026-11-05");
  assert.equal(g("sf").finish, "2026-11-05", "SF+3");
  assert.equal(g("neg").start, "2026-11-05", "FS−2 overlaps p by two days");
});

test("calendar-day cure over a weekend and a holiday", () => {
  const cal = makeCalendar(mergeCalendars({ exceptions: cmiHolidays(2026) }));
  const r = runCpm({
    start: "2026-11-23", calendars: { job: cal, calendar_days: CALENDAR_DAYS }, defaultCalendar: "job",
    tasks: [{ id: "pour", duration: 1, constraint: "snet", constraintDate: "2026-11-25" }, { id: "cure", duration: 7, calendar: "calendar_days" }, { id: "frame", duration: 2 }],
    links: [fs("pour", "cure"), fs("cure", "frame")],
  });
  assert.equal(r.tasks.get("cure").start, "2026-11-26", "cure runs through Thanksgiving");
  assert.equal(r.tasks.get("cure").finish, "2026-12-02");
  assert.equal(r.tasks.get("frame").start, "2026-12-03");
});

test("a working-day successor of a calendar-day task finishing Saturday starts Monday", () => {
  const r = run([{ id: "cure", duration: 6, calendar: "calendar_days" }, { id: "next", duration: 1 }], [fs("cure", "next")]);
  assert.equal(r.tasks.get("cure").finish, "2026-11-07"); // Sat
  assert.equal(r.tasks.get("next").start, "2026-11-09");
});

test("constraints: SNET on a closed day, Must Finish On, locked, ALAP", () => {
  const r = run(
    [
      { id: "a", duration: 2, constraint: "snet", constraintDate: "2026-11-07" }, // Saturday
      { id: "m", duration: 3, constraint: "mfo", constraintDate: "2026-11-20" },
      { id: "l", duration: 2, constraint: "locked", start: "2026-11-04", end: "2026-11-05" },
      { id: "late", duration: 1, constraint: "alap" },
      { id: "end", duration: 1 },
    ],
    [fs("a", "end"), fs("late", "end")],
  );
  assert.equal(r.tasks.get("a").start, "2026-11-09");
  assert.match(r.tasks.get("a").note, /non-working day/);
  assert.equal(r.tasks.get("m").start, "2026-11-18");
  assert.equal(r.tasks.get("m").fixed, true);
  assert.equal(r.tasks.get("l").start, "2026-11-04");
  // end waits for a (finishes 11/10) → starts 11/11; ALAP 'late' slides to 11/10.
  assert.equal(r.tasks.get("late").start, "2026-11-10");
  assert.equal(r.tasks.get("late").earlyStart, "2026-11-02");
});

test("negative float when a target finish is too early or a locked task blocks", () => {
  const r = run([{ id: "a", duration: 10 }, { id: "b", duration: 5 }], [fs("a", "b")], { finish: "2026-11-13" });
  assert.equal(r.tasks.get("a").totalFloat, -5);
  assert.ok(r.tasks.get("a").critical);

  const r2 = run(
    [{ id: "a", duration: 5 }, { id: "b", duration: 2, constraint: "locked", start: "2026-11-04", end: "2026-11-05" }],
    [fs("a", "b")],
  );
  assert.equal(r2.tasks.get("b").start, "2026-11-04", "locked stays put");
  assert.ok(r2.tasks.get("a").totalFloat < 0, "its predecessor shows the conflict");
});

test("actuals hold, a complete task isn't critical", () => {
  const r = run(
    [{ id: "a", duration: 3, actualStart: "2026-11-03", actualFinish: "2026-11-09" }, { id: "b", duration: 2 }],
    [fs("a", "b")],
  );
  assert.equal(r.tasks.get("a").finish, "2026-11-09");
  assert.equal(r.tasks.get("a").critical, false);
  assert.equal(r.tasks.get("b").start, "2026-11-10");
});

test("loops are reported and left out; dangling links too", () => {
  const r = run(
    [{ id: "a", duration: 1 }, { id: "b", duration: 1 }, { id: "c", duration: 1 }],
    [fs("a", "b"), fs("b", "c"), fs("c", "a"), fs("a", "zz")],
  );
  assert.equal(r.loops.length, 1);
  assert.equal(r.danglingLinks.length, 1);
  assert.equal(r.tasks.get("c").start, "2026-11-04");
});

test("manual mode keeps dated tasks where they are and reports float", () => {
  const r = run(
    [{ id: "a", duration: 2, start: "2026-11-02", end: "2026-11-03" }, { id: "b", duration: 2, start: "2026-11-16", end: "2026-11-17" }],
    [fs("a", "b")],
    { mode: "manual" },
  );
  assert.equal(r.tasks.get("b").start, "2026-11-16");
  assert.equal(r.tasks.get("a").totalFloat, 8);
});

// The template's offsets come from a real 2025 BuilderTrend job, which has a
// few unexplained days between linked tasks (holidays, real delays). The
// engine closes those gaps, so it may finish a little earlier, never later.
test("New Construction: the engine never runs later than the template, and finishes close to it", () => {
  const start = "2026-11-02";
  const keys = new Map(T.items.map((i) => [i.key, i]));
  const tasks = T.items.map((i) => ({
    id: i.key,
    duration: i.kind === "milestone" ? 0 : i.duration ?? 1,
    // What switching over does: unlinked tasks keep their place.
    ...(i.deps?.length ? {} : { constraint: "snet", constraintDate: isoOf(addW(WEEK, dayNum(start), i.offset)) }),
  }));
  const links = T.items.flatMap((i) => (i.deps ?? []).map((d) => ({ from: d.on, to: i.key, type: d.type ?? "finish_to_start", lag: d.lag ?? 0 })));
  const r = run(tasks, links, { start });
  assert.equal(r.loops.length, 0);
  for (const [k, res] of r.tasks) {
    const planned = isoOf(addW(WEEK, dayNum(start), keys.get(k).offset));
    assert.ok(res.start <= planned, `${keys.get(k).title}: engine ${res.start} vs template ${planned}`);
  }
  const finish = workDiff(WEEK, dayNum(start), dayNum(r.tasks.get("t76").start));
  assert.ok(finish >= 196 && finish <= 206, `finish at working day ${finish}, template 206`);
  assert.ok(r.criticalPath.includes("t76") && r.criticalPath.includes("t75"));
  assert.ok(r.tasks.get("t47").totalFloat >= 0);
});

test("predecessor shorthand", () => {
  const { links, errors } = parseLinks("120, 120FS+2, 150ss, 180FF-1, 90SF+3d, x12");
  assert.equal(errors.length, 1);
  assert.deepEqual(links[1], { id: 120, type: "finish_to_start", lag: 2 });
  assert.deepEqual(links[2], { id: 150, type: "start_to_start", lag: 0 });
  assert.equal(formatLinks(links), "90SF+3, 120, 120FS+2, 150SS, 180FF-1");
  assert.deepEqual(validateLinks(150, links, new Set([90, 120, 180])), ["A task can't depend on itself (150)."]);
  const succ = successorsOf(new Map([[130, [{ id: 120, type: "start_to_start", lag: 2 }]], [140, [{ id: 120, type: "finish_to_start", lag: 0 }]]]));
  assert.equal(formatLinks(succ.get(120)), "130SS+2, 140");
  assert.deepEqual(parseDuration("7cd"), { days: 7, unit: "calendar" });
  assert.deepEqual(parseDuration(" 12 "), { days: 12, unit: "workdays" });
  assert.equal(parseDuration("abc"), null);
  assert.equal(idBetween(20, 30), 25);
  assert.equal(idBetween(20, 25), 22);
  assert.equal(idBetween(20, 21), null);
  assert.equal(idBetween(120, null), 130);
});
