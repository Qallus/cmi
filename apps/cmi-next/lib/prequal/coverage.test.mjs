import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkMinimums, earliestExpiration, redFlags, reminderStage } from "./coverage.ts";

const MIN = {
  gl: { perOccurrence: 1_000_000, aggregate: 2_000_000 }, auto: { perOccurrence: 1_000_000 },
  wc: { perOccurrence: 1_000_000 }, umbrella: { perOccurrence: 1_000_000 },
};
const line = (o) => ({ carrier: "Acme Mutual", policy_number: "P1", effective_date: "2026-03-01", expiration_date: "2027-03-01",
  each_occurrence: null, aggregate: null, combined_single_limit: null, employers_liability_each_accident: null, ...o });

test("a certificate meeting every minimum has no flags", () => {
  const r = checkMinimums([
    line({ line: "general_liability", each_occurrence: 1_000_000, aggregate: 2_000_000 }),
    line({ line: "auto", combined_single_limit: 1_000_000 }),
    line({ line: "workers_comp", employers_liability_each_accident: 1_000_000 }),
  ], MIN);
  assert.deepEqual(r.flags, []);
  assert.ok(r.coverages.every((c) => c.meets_minimum === true));
});

test("short limits and missing lines are flagged in plain English", () => {
  const r = checkMinimums([line({ line: "general_liability", each_occurrence: 500_000, aggregate: 1_000_000 })], MIN);
  assert.ok(r.flags.some((f) => /\$500,000 per occurrence is below the \$1,000,000 minimum/.test(f)));
  assert.ok(r.flags.some((f) => /aggregate is below/.test(f)));
  assert.ok(r.flags.some((f) => /No workers' compensation/.test(f)));
  assert.ok(r.flags.some((f) => /No commercial auto/.test(f)));
  assert.equal(r.coverages[0].meets_minimum, false);
});

test("unreadable limits ask a person to look rather than pass", () => {
  const r = checkMinimums([line({ line: "general_liability" })], MIN);
  assert.ok(r.flags.some((f) => /couldn't be read/.test(f)));
  assert.equal(r.coverages[0].meets_minimum, null);
});

test("the document expires when its first line does", () => {
  assert.equal(earliestExpiration([line({ expiration_date: "2027-03-01" }), line({ expiration_date: "2026-12-15" }), line({ expiration_date: null })]), "2026-12-15");
  assert.equal(earliestExpiration([]), null);
});

test("reminders: none before 45 days, weekly to 8, urgent with CC for the last week, none after expiry", () => {
  assert.equal(reminderStage(46), null);
  const weekly = [45, 44, 43, 37, 36, 30, 15, 8].map((d) => reminderStage(d));
  assert.ok(weekly.every((s) => s && s.kind === "notice" && !s.urgent));
  const buckets = new Set([45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, 30, 20, 10, 8].map((d) => reminderStage(d).bucket));
  assert.ok(buckets.size >= 6 && buckets.size <= 7, `one bucket per week, got ${buckets.size}`);
  assert.deepEqual(reminderStage(7), { kind: "notice", bucket: "final", urgent: true });
  assert.deepEqual(reminderStage(0), { kind: "notice", bucket: "final", urgent: true });
  assert.deepEqual(reminderStage(-1), { kind: "expired" });
});

test("redFlags: only working partners, W-9/COI mandatory, expiry and minimums", () => {
  const today = "2026-10-28";
  const w9 = { doc_type: "w9", status: "verified", expires_on: null, has_file: true };
  const coi = { doc_type: "coi", status: "verified", expires_on: "2027-01-01", has_file: true };
  assert.deepEqual(redFlags("applicant", [], today), []);
  assert.deepEqual(redFlags("approved", [], today), ["No W-9", "No COI"]);
  assert.deepEqual(redFlags("approved", [w9, coi], today), []);
  assert.deepEqual(redFlags("approved", [w9, { ...coi, expires_on: "2026-10-01" }], today), ["Insurance expired"]);
  assert.deepEqual(redFlags("preferred", [{ ...w9, status: "rejected" }, coi], today), ["No W-9"]);
  assert.deepEqual(
    redFlags("approved", [w9, { ...coi, ai_flags: ["General liability $500,000 per occurrence is below the $1,000,000 minimum."] }], today),
    ["Coverage below minimum"],
  );
});
