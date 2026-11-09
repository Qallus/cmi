import { strict as assert } from "node:assert";
import { test } from "node:test";
import { selectionPatchFromInput, extensionFieldsFromInput } from "./normalize.ts";

test("form strings become typed values; blanks become null", () => {
  const out = selectionPatchFromInput({
    name: " Oak plank ", custom_product_name: "", quantity: "", allowance_amount: "", estimated_cost: "33.9",
    gallery_urls: "https://a.jpg\nhttps://b.jpg, https://c.jpg", client_visible: true, target_delivery_date: "2026-12-01",
  });
  assert.equal(out.name, "Oak plank");
  assert.equal(out.custom_product_name, "Oak plank");
  assert.equal(out.quantity, 1);
  assert.equal(out.allowance_amount, null);
  assert.equal(out.estimated_cost, 33.9);
  assert.equal(out.price, 33.9);
  assert.deepEqual(out.gallery_urls, ["https://a.jpg", "https://b.jpg", "https://c.jpg"]);
  assert.equal(out.client_visible, true);
  assert.equal(out.delivery_date, "2026-12-01");
});

test("only fields that were sent are written", () => {
  const out = selectionPatchFromInput({ approval_status: "pending" });
  assert.deepEqual(Object.keys(out).sort(), ["approval_status", "client_approval_status"]);
  assert.equal(out.client_approval_status, "pending");
  assert.ok(!("quote_id" in out) && !("job_id" in out) && !("name" in out));
});

test("statuses keep the legacy status column in step", () => {
  const out = selectionPatchFromInput({ selection_status: "client_approved", procurement_status: "not_ordered", approval_status: "not_required" });
  assert.equal(out.status, "approved");
  assert.equal(out.client_approval_status, "not_sent");
});

test("the task link is stored in both columns", () => {
  const out = selectionPatchFromInput({ related_task_id: "t1" });
  assert.equal(out.related_task_id, "t1");
  assert.equal(out.project_schedule_item_id, "t1");
});

test("extension fields: features one per line, visibility flags, only what was sent", () => {
  const out = extensionFieldsFromInput({ name: "x", eyebrow: "Kitchen", sku: "", features: "Solid brass, lead-free\nLifetime warranty\n", visible_to_vendor: true });
  assert.deepEqual(out, { eyebrow: "Kitchen", sku: null, features: ["Solid brass, lead-free", "Lifetime warranty"], visible_to_vendor: true });
});
