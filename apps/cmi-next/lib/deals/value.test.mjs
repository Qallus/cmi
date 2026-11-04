import { strict as assert } from "node:assert";
import { test } from "node:test";
import { formatDealValue, dealValueMid, isRange, rangeError } from "./value.ts";

test("one number or a range", () => {
  assert.equal(formatDealValue({ estimated_value: 895000 }), "$895,000");
  assert.equal(formatDealValue({ estimated_value: 850000, estimated_max_value: 950000 }), "$850,000 – $950,000");
  assert.equal(formatDealValue({ estimated_value: 900000, estimated_max_value: 900000 }), "$900,000");
  assert.equal(formatDealValue({}), null);
  assert.equal(formatDealValue({ estimated_value: 5, estimated_max_value: 9 }, (n) => `${n}k`), "5k – 9k");
});

test("ranges count at their midpoint", () => {
  assert.equal(dealValueMid({ estimated_value: 850000, estimated_max_value: 950000 }), 900000);
  assert.equal(dealValueMid({ estimated_value: 65000 }), 65000);
  assert.equal(dealValueMid({}), null);
  assert.equal(isRange({ estimated_value: 1, estimated_max_value: 2 }), true);
  assert.equal(isRange({ estimated_value: 1 }), false);
});

test("range checks", () => {
  assert.equal(rangeError(850000, 950000), null);
  assert.equal(rangeError(850000, null), null);
  assert.match(rangeError(950000, 850000), /less than/);
  assert.match(rangeError(null, 950000), /low end/);
});
