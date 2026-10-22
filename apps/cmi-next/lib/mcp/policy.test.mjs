import { strict as assert } from "node:assert";
import { test } from "node:test";
import { ScopeError, entityAllowed, redactArgs, redactFinancial, scopeUserEmail } from "./policy.ts";
import { verifyPkce } from "./pkce.ts";

const designer = { role: "designer", isAdmin: false };
const pm = { role: "project_manager", isAdmin: true };
const admin = { role: "admin", isAdmin: true };

test("financial entities are hidden from roles that can't read money", () => {
  assert.equal(entityAllowed("invoice", designer), false);
  assert.equal(entityAllowed("change_order", designer), false);
  assert.equal(entityAllowed("invoice", pm), true);
  assert.equal(entityAllowed("job", designer), true);
});

test("staff accounts are admin-only and review notes are never exposed", () => {
  assert.equal(entityAllowed("user", pm), false);
  assert.equal(entityAllowed("user", admin), true);
  assert.equal(entityAllowed("page_review_note", admin), false);
});

test("money fields are stripped at any depth", () => {
  const job = {
    job: { job_name: "Smith ADU", contract_price: 250000, status: "active" },
    invoices: [{ amount: 1 }],
    change_orders: [{ amount: 2 }],
    selections: [{ name: "Tile", client_price: 12, approval_status: "approved" }],
    open_balance: 5,
  };
  const out = redactFinancial(job);
  assert.deepEqual(out, { job: { job_name: "Smith ADU", status: "active" }, selections: [{ name: "Tile", approval_status: "approved" }] });
  assert.equal(job.job.contract_price, 250000, "input is not mutated");
});

test("people read only their own data unless company-wide", () => {
  const me = { email: "Joe@constructedmatter.com", companyWide: false };
  assert.equal(scopeUserEmail(undefined, me), "joe@constructedmatter.com");
  assert.equal(scopeUserEmail("joe@constructedmatter.com", me), "joe@constructedmatter.com");
  assert.throws(() => scopeUserEmail("ben@constructedmatter.com", me), ScopeError);
  assert.equal(scopeUserEmail("ben@constructedmatter.com", { ...me, companyWide: true }), "ben@constructedmatter.com");
});

test("audit args drop secrets and long text", () => {
  const out = redactArgs({ api_key: "abc", query: "x".repeat(300), limit: 5 });
  assert.equal(out.api_key, "[redacted]");
  assert.equal(String(out.query).length, 201);
  assert.equal(out.limit, 5);
});

test("PKCE S256 matches the RFC 7636 example", () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  assert.equal(verifyPkce(verifier, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"), true);
  assert.equal(verifyPkce(verifier, "wrong"), false);
  assert.equal(verifyPkce("short", "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"), false);
});
