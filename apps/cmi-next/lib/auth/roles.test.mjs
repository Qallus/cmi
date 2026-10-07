import { strict as assert } from "node:assert";
import { test } from "node:test";
import { NON_STAFF_ROLES, STAFF_ROLES, isStaffRole } from "./roles.ts";

// These tests exist because the absence of this check was a live privilege
// escalation: a `client` row with status 'active' and a password could trade
// it for a full staff session at /api/auth/signin and reach every route
// behind requireAdmin. Adding an external role to STAFF_ROLES would reopen it.

test("external roles are never staff", () => {
  for (const role of NON_STAFF_ROLES) {
    assert.equal(isStaffRole(role), false, `${role} must not hold a staff session`);
  }
});

test("client, vendor and subcontractor are specifically rejected", () => {
  assert.equal(isStaffRole("client"), false);
  assert.equal(isStaffRole("vendor"), false);
  assert.equal(isStaffRole("subcontractor"), false);
  // DashboardNav falls back to "viewer" for an unresolved session, so it must
  // not be a way in either.
  assert.equal(isStaffRole("viewer"), false);
});

test("internal roles are staff", () => {
  for (const role of STAFF_ROLES) {
    assert.equal(isStaffRole(role), true, `${role} should hold a staff session`);
  }
  assert.equal(isStaffRole("super_admin"), true);
  assert.equal(isStaffRole("admin"), true);
});

test("the two sets never overlap", () => {
  const staff = new Set(STAFF_ROLES);
  for (const role of NON_STAFF_ROLES) {
    assert.equal(staff.has(role), false, `${role} is in both lists`);
  }
});

test("absent, empty and unknown roles are rejected", () => {
  assert.equal(isStaffRole(null), false);
  assert.equal(isStaffRole(undefined), false);
  assert.equal(isStaffRole(""), false);
  assert.equal(isStaffRole("Super_Admin"), false, "matching is case-sensitive");
  assert.equal(isStaffRole("owner"), false, "organizations.type value, not a staff role");
  assert.equal(isStaffRole("marketing"), false, "a nav category, not a staff role");
});
