import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BOLT_FINANCIAL_ROLES, BOLT_ROLES, canReadFinancials, canUseBolt } from "./access.ts";
import { NON_STAFF_ROLES } from "../auth/roles.ts";

test("external roles can never use Bolt", () => {
  for (const role of NON_STAFF_ROLES) {
    assert.equal(canUseBolt(role), false, `${role} must not reach the agent`);
    assert.equal(canReadFinancials(role), false, `${role} must not see money`);
  }
});

test("the Bolt roles match what the sidebar advertises", () => {
  // components/dashboard/nav.tsx offers "Bolt AI Agent" to exactly these six.
  // If the nav changes, this should change with it — deliberately.
  assert.deepEqual([...BOLT_ROLES], [
    "super_admin", "admin", "project_manager", "designer", "estimator", "superintendent",
  ]);
});

test("staff who are not offered Bolt are refused", () => {
  // `staff` is an internal role, but the sidebar does not offer it Bolt.
  assert.equal(canUseBolt("staff"), false);
});

test("financial access is narrower than Bolt access", () => {
  for (const role of BOLT_FINANCIAL_ROLES) {
    assert.equal(canUseBolt(role), true, `${role} should be able to use Bolt at all`);
  }
  // A designer has a real reason to ask about a job and none to learn its
  // contract price.
  assert.equal(canUseBolt("designer"), true);
  assert.equal(canReadFinancials("designer"), false);
  assert.equal(canReadFinancials("superintendent"), false);
  assert.equal(canReadFinancials("estimator"), false);
});

test("absent and unknown roles are refused", () => {
  for (const value of [null, undefined, "", "Super_Admin", "owner"]) {
    assert.equal(canUseBolt(value), false);
    assert.equal(canReadFinancials(value), false);
  }
});
