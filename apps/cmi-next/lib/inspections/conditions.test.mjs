import { strict as assert } from "node:assert";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { scopeRule, scopeCell, cleanConditions, suggestJurisdiction, CONDITION_KEYS } from "./conditions.ts";

test("scope cells: Y includes, dash excludes, If … waits on a condition, the rest the PM confirms", () => {
  assert.deepEqual(scopeRule("Y"), { kind: "include" });
  assert.deepEqual(scopeRule("—"), { kind: "exclude" });
  assert.deepEqual(scopeRule(""), { kind: "exclude" });
  assert.deepEqual(scopeRule("If pool"), { kind: "condition", key: "pool" });
  assert.deepEqual(scopeRule("If walls/ceilings opened"), { kind: "condition", key: "walls_opened" });
  assert.deepEqual(scopeRule("As needed"), { kind: "confirm", text: "As needed" });
  assert.deepEqual(scopeRule("If listed on permit"), { kind: "confirm", text: "If listed on permit" });
});

test("scopeCell picks the job's scope column", () => {
  const row = { scope_new: "Y", scope_add: "If CMU", scope_ren: "—" };
  assert.equal(scopeCell(row, "NEW"), "Y");
  assert.equal(scopeCell(row, "ADD"), "If CMU");
  assert.equal(scopeCell(row, "REN"), "—");
});

test("every scope cell in the seeded library is understood", () => {
  // Pull the three scope values out of each seeded row (positions 12–14 in the VALUES tuple).
  const sql = readFileSync(new URL("../../supabase/migrations/2026-11-11_inspection_milestones_seed.sql", import.meta.url), "utf8");
  const lib = sql.split("insert into public.inspection_library")[1].split("on conflict")[0];
  const cells = new Set();
  for (const line of lib.split("\n").filter((l) => l.startsWith("  ('"))) {
    // Values in order: quoted strings ('' = escaped quote), null, numbers, booleans.
    const parts = [...line.matchAll(/'((?:[^']|'')*)'|\bnull\b|\btrue\b|\bfalse\b|-?\d+/g)].map((x) => (x[1] !== undefined ? x[1].replace(/''/g, "'") : x[0]));
    for (const i of [11, 12, 13]) cells.add(parts[i] === "null" ? "" : parts[i]);
  }
  assert.ok(cells.size > 10, "found scope cells");
  const confirm = [...cells].filter((c) => scopeRule(c).kind === "confirm").sort();
  // Only the deliberate "PM decides" phrases are left unmapped.
  assert.deepEqual(confirm, ["As needed", "As required", "Completion letter", "If applicable", "If listed on permit", "If permit type", "If required"]);
});

test("cleanConditions keeps known keys in list order", () => {
  assert.deepEqual(cleanConditions(["pool", "nope", "gas", "pool"]), CONDITION_KEYS.filter((k) => k === "gas" || k === "pool"));
  assert.deepEqual(cleanConditions(null), []);
});

test("jurisdiction suggestion from the city", () => {
  assert.equal(suggestJurisdiction(" Paradise Valley "), "PV");
  assert.equal(suggestJurisdiction("Chandler"), "CHD");
  assert.equal(suggestJurisdiction("Gilbert"), null);
});
