import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  RETIRED_SECTION, SECTIONS, answersToCompany, contactsByRole, isDisplayOnly, isVisible,
  missingRequired, progressOf, relevantDocuments,
} from "./form.ts";

const field = (key) => SECTIONS.flatMap((s) => s.fields).find((f) => f.key === key);

test("'Same as primary' hides a secondary contact's fields, and an unanswered box shows them", () => {
  const name = field("accounting_name");
  assert.equal(isVisible(name, {}), true);
  assert.equal(isVisible(name, { accounting_same: false }), true);
  assert.equal(isVisible(name, { accounting_same: true }), false);
});

test("'Other' opens a free-text follow-up", () => {
  assert.equal(isVisible(field("partner_type_other"), { partner_type: "Other" }), true);
  assert.equal(isVisible(field("partner_type_other"), { partner_type: "Subcontractor" }), false);
  assert.equal(isVisible(field("trades_other"), { trades: ["Framing", "Other"] }), true);
  assert.equal(isVisible(field("trades_other"), { trades: ["Framing"] }), false);
});

test("only the four primary contact fields block submission; the COI doesn't", () => {
  const missing = missingRequired({});
  assert.deepEqual(missing.map((m) => m.field.key).sort(), ["contact_email", "contact_first_name", "contact_last_name", "contact_phone"]);
  assert.equal(missingRequired({ contact_first_name: "A", contact_last_name: "B", contact_email: "a@b.co", contact_phone: "1" }).length, 0);
});

test("headings, notices and the MSA step don't count toward progress", () => {
  const all = SECTIONS.flatMap((s) => s.fields);
  assert.ok(all.some((f) => f.type === "heading") && all.some((f) => f.type === "msa"));
  assert.ok(all.filter(isDisplayOnly).every((f) => ["heading", "content", "msa"].includes(f.type)));
  assert.equal(progressOf({}), 0);
});

test("removed questions are gone from the form but still map for old drafts", () => {
  const live = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));
  for (const gone of ["accelerated_schedules", "pricing_methods", "equipment", "similar_projects", "gl_expires"]) assert.equal(live.has(gone), false, gone);
  const patch = answersToCompany({ pricing_methods: ["Lump sum"], years_in_business: "12", years_in_business_range: "11–20 years", meets_gl_minimum: true });
  assert.deepEqual(patch.pricing_methods, ["Lump sum"]);
  assert.equal(patch.years_in_business, 12);
  assert.equal(patch.years_in_business_range, "11–20 years");
  assert.equal(patch.meets_gl_minimum, true);
  assert.ok(RETIRED_SECTION.fields.length > 10);
});

test("contacts by role: same-as-primary copies the primary, blanks are skipped", () => {
  const roles = contactsByRole({
    contact_first_name: "Ana", contact_last_name: "Ruiz", contact_email: "ana@x.co", contact_phone: "480",
    accounting_same: true,
    estimating_name: "Bo Lee", estimating_email: "bo@x.co",
  });
  assert.deepEqual(roles.map((r) => r.role), ["accounting", "estimating"]);
  assert.equal(roles[0].name, "Ana Ruiz");
  assert.equal(roles[0].samePrimary, true);
  assert.equal(roles[1].email, "bo@x.co");
});

test("W-9 and COI are always tracked; the license only when licensed", () => {
  const docs = (a) => relevantDocuments(a).filter((d) => d.required).map((d) => d.docType).sort();
  assert.deepEqual(docs({}), ["coi", "w9"]);
  assert.deepEqual(docs({ is_licensed: true }), ["coi", "license", "w9"]);
});
