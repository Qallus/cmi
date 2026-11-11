import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parsePmField, matchPmStaff, clientAlertPlan } from "./client-alert.ts";

const staff = [
  { id: "ben", display_name: "Ben Carter", email: "ben@cmi.com", role_slug: "project_manager", status: "active" },
  { id: "joe", display_name: "Joe Ballard", email: "joe@cmi.com", role_slug: "project_manager", status: "active" },
  { id: "jw", display_name: "Jeremy Waters", email: "jw@cmi.com", role_slug: "super_admin", status: "active" },
  { id: "bb", display_name: "Brandon B", email: "bb@cmi.com", role_slug: "admin", status: "active" },
  { id: "old", display_name: "Old Admin", email: "old@cmi.com", role_slug: "admin", status: "inactive" },
];

test("reads the free-text PM field", () => {
  assert.deepEqual(parsePmField("Ben Carter — ben@cmi.com · 602-555-1212"), { email: "ben@cmi.com", name: "Ben Carter" });
  assert.deepEqual(parsePmField("Joe Ballard"), { email: null, name: "Joe Ballard" });
  assert.deepEqual(parsePmField(""), { email: null, name: null });
});

test("matches the PM by email, then by name; a lone first name only when unique", () => {
  assert.equal(matchPmStaff("Someone Else — BEN@cmi.com", staff)?.id, "ben");
  assert.equal(matchPmStaff("joe ballard", staff)?.id, "joe");
  assert.equal(matchPmStaff("Ben", staff)?.id, "ben");
  assert.equal(matchPmStaff("Nobody Here", staff), null);
});

test("team with notifications on, plus the PM even when their box is off", () => {
  const plan = clientAlertPlan([
    { staff_user_id: "joe", role: "Superintendent", notifications_enabled: true },
    { staff_user_id: "ben", role: "Project Manager", notifications_enabled: false },
  ], null, staff);
  assert.deepEqual(plan.ids.sort(), ["ben", "joe"]);
  assert.equal(plan.fallback, false);
});

test("PM named only in the job's PM field still hears about it", () => {
  const plan = clientAlertPlan([], "Ben Carter — ben@cmi.com", staff);
  assert.deepEqual(plan.ids, ["ben"]);
});

test("nobody on the job: active admins and super admins", () => {
  const plan = clientAlertPlan([{ staff_user_id: "joe", role: "Estimator", notifications_enabled: false }], "", staff);
  assert.deepEqual(plan.ids.sort(), ["bb", "jw"]);
  assert.equal(plan.fallback, true);
});
