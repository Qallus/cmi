import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BLANK, CARD_TYPES, copy, normalize, STANDARD, typesIn } from "./layout.ts";
import { cardAllowed, canSetDashboardDefault } from "./access.ts";
import { featureVisible } from "../features/visibility.ts";
import { previousMonth, summarizeCalls } from "../communications/call-stats-core.ts";

test("normalize: null for nothing saved, drops unknown cards and duplicates", () => {
  assert.equal(normalize(null), null);
  assert.equal(normalize({}), null);
  const l = normalize({ template: "weird", sections: [
    { id: "a", title: "A", style: "row", cards: [{ id: "x", type: "stat_calls", size: "sm" }, { id: "y", type: "nope", size: "sm" }, { id: "x", type: "clock", size: "zz" }] },
    { id: "a", title: "dup", cards: [] },
  ] });
  assert.equal(l.template, "standard");
  assert.equal(l.sections.length, 1);
  assert.deepEqual(l.sections[0].cards.map((c) => c.type), ["stat_calls"]);
});

test("normalize: role filter removes cards the person can't use", () => {
  const allow = (t) => cardAllowed(t, "staff", {});
  const l = normalize(copy(STANDARD), allow);
  const types = l.sections.flatMap((s) => s.cards.map((c) => c.type));
  assert.equal(types.includes("stat_calls"), false, "staff can't see the office call stats");
  assert.equal(types.includes("revenue_outlook"), false);
  assert.equal(types.includes("my_tasks"), true);
  assert.equal(types.includes("weather"), true);
});

test("presets only use real card types; Standard has Jeremy's rows in order", () => {
  for (const l of [STANDARD, BLANK]) for (const s of l.sections) for (const c of s.cards) assert.ok(CARD_TYPES.includes(c.type), c.type);
  assert.deepEqual(STANDARD.sections.map((s) => s.id), ["start", "status", "activity", "tasks", "stats", "news", "company"]);
  assert.deepEqual(STANDARD.sections[1].cards.map((c) => c.type), ["search", "all_features", "clock", "weather"]);
  assert.deepEqual(STANDARD.sections[2].cards.map((c) => c.type), ["agent_alert", "next_up", "job_alert", "notifications"]);
  assert.deepEqual(STANDARD.sections[4].cards.map((c) => c.type), [
    "stat_calls", "stat_outbound", "stat_inbound", "stat_missed", "stat_sms", "stat_bookings", "stat_calendar",
    "stat_notifications", "stat_messages", "stat_alerts", "stat_emails", "stat_files",
  ]);
});

test("typesIn ignores hidden cards and sections", () => {
  const l = copy(BLANK);
  l.sections[1].cards.push({ id: "a", type: "weather", size: "sm" }, { id: "b", type: "notepad", size: "md", hidden: true });
  const t = typesIn(l);
  assert.equal(t.has("weather"), true);
  assert.equal(t.has("notepad"), false);
});

test("card access follows roles and flags", () => {
  assert.equal(cardAllowed("stat_calls", "admin"), true);
  assert.equal(cardAllowed("stat_calls", "superintendent"), false);
  assert.equal(cardAllowed("revenue_outlook", "admin", {}), false);
  assert.equal(cardAllowed("revenue_outlook", "admin", { projections: true }), true);
  assert.equal(cardAllowed("revenue_outlook", "project_manager", { projections: true }), false);
  assert.equal(cardAllowed("weather", "staff"), true);
  assert.equal(canSetDashboardDefault("admin"), false);
  assert.equal(canSetDashboardDefault("super_admin"), true);
});

test("feature visibility: roles and flags like the sidebar", () => {
  assert.equal(featureVisible({}, "staff", {}), true);
  assert.equal(featureVisible({ roles: ["admin"] }, "staff", {}), false);
  assert.equal(featureVisible({ flag: "x" }, "admin", {}), false);
  assert.equal(featureVisible({ flag: "x" }, "admin", { x: true }), true);
});

test("call stats: months, direction, missed and series (Arizona days)", () => {
  assert.equal(previousMonth("2026-01"), "2025-12");
  assert.equal(previousMonth("2026-11"), "2026-10");
  const now = new Date("2026-11-25T20:00:00Z");
  const s = summarizeCalls([
    { direction: "inbound", status: "completed", dateCreated: "2026-11-24T18:00:00Z" },
    { direction: "inbound", status: "no-answer", dateCreated: "2026-11-25T16:00:00Z" },
    { direction: "outbound-dial", status: "completed", dateCreated: "2026-11-02T18:00:00Z" },
    { direction: "outbound-api", status: "busy", dateCreated: "2026-11-03T18:00:00Z" },
    { direction: "inbound", status: "busy", dateCreated: "2026-10-15T18:00:00Z" },
    // 11 PM Oct 31 Arizona = Nov 1 06:00 UTC: still October in Phoenix.
    { direction: "inbound", status: "completed", dateCreated: "2026-11-01T06:00:00Z" },
  ], now);
  assert.deepEqual(s.total, { now: 4, last: 2 });
  assert.deepEqual(s.inbound, { now: 2, last: 2 });
  assert.deepEqual(s.outbound, { now: 2, last: 0 });
  assert.deepEqual(s.missed, { now: 1, last: 1 }, "outbound busy isn't a missed call");
  assert.equal(s.series.length, 30);
  assert.equal(s.series.at(-1).day, "2026-11-25");
  assert.equal(s.series.at(-1).a, 1);
});
