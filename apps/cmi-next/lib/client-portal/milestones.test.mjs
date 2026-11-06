import { strict as assert } from "node:assert";
import { test } from "node:test";
import { orderMilestones, standing } from "./milestones.ts";

const m = (id, extra = {}) => ({ id, title: id, type: "contract", forecast: null, contract: null, done: false, doneOn: null, variance: null, schedule: "S", note: null, ...extra });

test("client wording for each standing", () => {
  assert.deepEqual(standing(m("a", { variance: 0 })), { tone: "good", label: "On the contract date" });
  assert.deepEqual(standing(m("a", { variance: -3 })), { tone: "good", label: "3 working days ahead" });
  assert.deepEqual(standing(m("a", { variance: 1 })), { tone: "late", label: "1 working day after the contract date" });
  assert.equal(standing(m("a", { type: "client_decision" })).label, "Decision needed");
  assert.equal(standing(m("a", { done: true, variance: 4 })).tone, "done");
});

test("upcoming first by forecast, reached last (newest first)", () => {
  const out = orderMilestones([
    m("done-old", { done: true, doneOn: "2026-09-01" }), m("later", { forecast: "2027-03-01" }),
    m("soon", { forecast: "2026-12-01" }), m("done-new", { done: true, doneOn: "2026-10-15" }),
  ]);
  assert.deepEqual(out.map((x) => x.id), ["soon", "later", "done-new", "done-old"]);
});
