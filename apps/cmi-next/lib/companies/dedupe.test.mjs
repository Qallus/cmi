import { strict as assert } from "node:assert";
import { test } from "node:test";
import { findDuplicatePairs, mergePatch, normalizeCompanyName, similarity } from "./dedupe.ts";

test("legal suffixes and punctuation don't make two companies different", () => {
  assert.equal(normalizeCompanyName("Acme Framing, LLC"), "acme framing");
  assert.equal(normalizeCompanyName("ACME FRAMING"), "acme framing");
  assert.equal(normalizeCompanyName("Smith & Sons Plumbing Inc."), "smith and sons plumbing");
});

test("similarity behaves like pg_trgm on close and distant names", () => {
  assert.equal(similarity("acme framing", "acme framing"), 1);
  assert.ok(similarity("desert sun electric", "desert sun electrical") > 0.6);
  assert.ok(similarity("desert sun electric", "valley pools") < 0.2);
});

test("pairs: exact normalized matches first, unrelated names excluded", () => {
  const pairs = findDuplicatePairs([
    { id: "1", name: "Acme Framing LLC" }, { id: "2", name: "ACME Framing" },
    { id: "3", name: "Desert Sun Electric" }, { id: "4", name: "Desert Sun Electrical" },
    { id: "5", name: "Valley Pools" },
  ]);
  assert.equal(pairs[0].exact, true);
  assert.deepEqual(new Set([pairs[0].a.id, pairs[0].b.id]), new Set(["1", "2"]));
  assert.ok(pairs.some((p) => new Set([p.a.id, p.b.id]).has("3") && new Set([p.a.id, p.b.id]).has("4")));
  assert.ok(!pairs.some((p) => p.a.id === "5" || p.b.id === "5"));
});

test("merge patch fills gaps, unions lists, keeps the survivor's values", () => {
  const survivor = { id: "s", name: "Acme Framing", phone: "480-555-0100", email: null, trades: ["Framing"], notes: "Good crew", qualification_status: "approved" };
  const dup = { id: "d", name: "ACME Framing LLC", phone: "602-555-0199", email: "office@acme.test", trades: ["Framing", "Trusses / Lumber Supply"], notes: "Slow on bids", qualification_status: "prospect" };
  const patch = mergePatch(survivor, dup);
  assert.equal(patch.phone, undefined, "survivor phone wins");
  assert.equal(patch.email, "office@acme.test");
  assert.deepEqual(patch.trades, ["Framing", "Trusses / Lumber Supply"]);
  assert.match(String(patch.notes), /Good crew[\s\S]*Merged from ACME Framing LLC[\s\S]*Slow on bids/);
  assert.equal(patch.qualification_status, undefined);
  assert.equal(patch.id, undefined);
});
