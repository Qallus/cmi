import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  annotationsFor, canTrash, capProblem, pendingProblem, phoenixDayStart, recordLabel, tierAllowed, trashRuleFor, TRASH_POLICY,
} from "./safety.ts";
import { moneyKeysIn } from "./policy.ts";

test("tiers: a client only sees the risk levels it was allowed", () => {
  assert.equal(tierAllowed("read", ["read"]), true);
  assert.equal(tierAllowed("write", ["read"]), false);
  assert.equal(tierAllowed("high", ["read", "write"]), false);
  assert.equal(tierAllowed("high", ["read", "write", "high"]), true);
});

test("annotations follow the risk", () => {
  assert.deepEqual(
    annotationsFor("read", { title: "x" }),
    { title: "x", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  );
  const high = annotationsFor("high", { title: "send", openWorld: true });
  assert.equal(high.readOnlyHint, false);
  assert.equal(high.destructiveHint, true);
  assert.equal(high.openWorldHint, true);
  assert.equal(annotationsFor("write", { title: "w" }).destructiveHint, false);
});

test("pending actions: only the same person and app, once, within 15 minutes", () => {
  const now = Date.parse("2026-10-29T12:00:00Z");
  const row = { staff_user_id: "jeremy", status: "pending", expires_at: "2026-10-29T12:10:00Z", client_id: "claude-1" };
  const me = { staffId: "jeremy", clientId: "claude-1" };
  assert.equal(pendingProblem(row, me, now), null);
  assert.match(pendingProblem(null, me, now), /doesn't exist/);
  assert.match(pendingProblem(row, { staffId: "brandon", clientId: "claude-1" }, now), /someone else/);
  assert.match(pendingProblem(row, { staffId: "jeremy", clientId: "chatgpt-1" }, now), /different app/);
  assert.match(pendingProblem({ ...row, status: "confirmed" }, me, now), /already confirmed/);
  assert.match(pendingProblem({ ...row, status: "cancelled" }, me, now), /cancelled/);
  assert.match(pendingProblem({ ...row, expires_at: "2026-10-29T11:59:59Z" }, me, now), /expired/);
});

test("daily caps count from Arizona midnight and stop at the limit", () => {
  // 2026-10-29 03:00 UTC is still Oct 28 in Phoenix (UTC-7).
  assert.equal(phoenixDayStart(new Date("2026-10-29T03:00:00Z")).toISOString(), "2026-10-28T07:00:00.000Z");
  assert.equal(phoenixDayStart(new Date("2026-10-29T08:00:00Z")).toISOString(), "2026-10-29T07:00:00.000Z");
  assert.equal(capProblem("sms", 24, 25), null);
  assert.match(capProblem("sms", 25, 25), /Daily limit reached: 25 of 25 sms/);
  assert.equal(capProblem("sms", 999, undefined), null);
  assert.match(capProblem("trash", 0, 0), /switched off/);
});

test("trash: archive where the table archives, snapshot only leaf rows, refuse the rest", () => {
  assert.deepEqual(trashRuleFor("job"), { method: "archive", table: "jobs", column: "archived_at" });
  assert.equal(trashRuleFor("contact").method, "status");
  assert.equal(trashRuleFor("daily_log").method, "snapshot");
  for (const parent of ["quote", "invoice", "selection", "project_item", "booking", "user", "change_order", "document"]) {
    assert.equal(trashRuleFor(parent), null, `${parent} must not be trashable`);
  }
  // Every rule names a table.
  for (const [k, r] of Object.entries(TRASH_POLICY)) assert.ok(r.table, k);
});

test("only Super Admin and Admin may trash through AI", () => {
  assert.equal(canTrash("super_admin"), true);
  assert.equal(canTrash("admin"), true);
  assert.equal(canTrash("project_manager"), false);
  assert.equal(canTrash("designer"), false);
});

test("money fields in a write are caught", () => {
  assert.deepEqual(moneyKeysIn({ name: "Kitchen", contract_value: 100, notes: "x" }), ["contract_value"]);
  assert.deepEqual(moneyKeysIn({ estimated_value: 1, labor_cost: 2, title: "t" }), ["estimated_value", "labor_cost"]);
  assert.deepEqual(moneyKeysIn({ title: "t" }), []);
  assert.deepEqual(moneyKeysIn(null), []);
});

test("record labels read naturally", () => {
  assert.equal(recordLabel({ first_name: "Joe", last_name: "Smith" }, "x"), "Joe Smith");
  assert.equal(recordLabel({ title: "Pour footings" }, "x"), "Pour footings");
  assert.equal(recordLabel({}, "job_note 1"), "job_note 1");
  assert.equal(recordLabel({ body: "  Framing   inspection passed today " }, "x"), "Framing inspection passed today");
});
