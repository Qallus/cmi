import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatDealValue, formatDealRange, dealValueMid, hasRange, rangeError } from "./value.ts";

test("amount first, then the range", () => {
  assert.equal(formatDealValue({ estimated_value: 895000 }), "$895,000");
  assert.equal(formatDealValue({ estimated_value: 895000, estimated_low_value: 850000, estimated_high_value: 950000 }), "$895,000");
  assert.equal(formatDealValue({ estimated_low_value: 850000, estimated_high_value: 950000 }), "$850,000 – $950,000");
  assert.equal(formatDealValue({}), null);
});

test("range wording", () => {
  assert.equal(formatDealRange({ estimated_low_value: 850000, estimated_high_value: 950000 }), "$850,000 – $950,000");
  assert.equal(formatDealRange({ estimated_low_value: 850000 }), "from $850,000");
  assert.equal(formatDealRange({ estimated_high_value: 950000 }), "up to $950,000");
  assert.equal(formatDealRange({ estimated_low_value: 900000, estimated_high_value: 900000 }), "$900,000");
  assert.equal(formatDealRange({ estimated_value: 1 }), null);
  assert.equal(hasRange({ estimated_high_value: 1 }), true);
  assert.equal(hasRange({ estimated_value: 1 }), false);
});

test("totals use the amount, else the midpoint", () => {
  assert.equal(dealValueMid({ estimated_value: 895000, estimated_low_value: 1, estimated_high_value: 2 }), 895000);
  assert.equal(dealValueMid({ estimated_low_value: 850000, estimated_high_value: 950000 }), 900000);
  assert.equal(dealValueMid({ estimated_high_value: 950000 }), 950000);
  assert.equal(dealValueMid({}), null);
});

test("range checks", () => {
  assert.equal(rangeError(850000, 950000), null);
  assert.equal(rangeError(850000, null), null);
  assert.match(rangeError(950000, 850000), /less than/);
});
