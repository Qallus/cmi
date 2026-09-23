import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  caretForDigits, digitsBeforeCaret, formatMoney, formatPhone, moneyDigits, phoneDigits,
} from "./fields.ts";

test("phone formats as far as it has been typed", () => {
  assert.equal(formatPhone(""), "");
  assert.equal(formatPhone("4"), "4");
  assert.equal(formatPhone("480"), "480");
  assert.equal(formatPhone("4803"), "(480) 3");
  assert.equal(formatPhone("480352"), "(480) 352");
  assert.equal(formatPhone("4803527"), "(480) 352-7");
  assert.equal(formatPhone("4803527598"), "(480) 352-7598");
});

test("phone accepts what people actually paste", () => {
  assert.equal(formatPhone("480-352-7598"), "(480) 352-7598");
  assert.equal(formatPhone("+1 (480) 352-7598"), "(480) 352-7598");
  assert.equal(formatPhone("1 480 352 7598"), "(480) 352-7598");
  assert.equal(formatPhone("480.352.7598 ext 2"), "(480) 352-7598");
});

test("phone stops at ten digits", () => {
  assert.equal(phoneDigits("48035275981234"), "4803527598");
  assert.equal(formatPhone("48035275981234"), "(480) 352-7598");
});

test("money groups the whole part only", () => {
  assert.equal(formatMoney(""), "");
  assert.equal(formatMoney("1"), "1");
  assert.equal(formatMoney("1250"), "1,250");
  assert.equal(formatMoney("1250000"), "1,250,000");
  assert.equal(formatMoney("1250.5"), "1,250.5");
  assert.equal(formatMoney("1250.50"), "1,250.50");
});

test("money does not complete the decimals under someone mid-entry", () => {
  // A trailing dot survives, so typing "1250." doesn't have the dot eaten.
  assert.equal(formatMoney("1250."), "1,250.");
  assert.equal(formatMoney(".5"), ".5");
});

test("money keeps one dot and two places", () => {
  assert.equal(moneyDigits("1,250.50"), "1250.50");
  assert.equal(moneyDigits("12.34.56"), "12.34");
  assert.equal(moneyDigits("$1,250.999"), "1250.99");
  assert.equal(moneyDigits("abc"), "");
});

test("caret follows the digit it was behind, not the offset", () => {
  // "1250|" -> "1,250|": four digits precede the caret, which lands at 5.
  assert.equal(digitsBeforeCaret("1250", 4), 4);
  assert.equal(caretForDigits("1,250", 4), 5);

  // Seven digits typed: "(480) 3527|" becomes "(480) 352-7|". The hyphen the
  // formatter inserts pushes the caret from 10 to 11 — the point of counting
  // digits rather than trusting the offset.
  assert.equal(digitsBeforeCaret("(480) 3527", 10), 7);
  assert.equal(caretForDigits("(480) 352-7598", 7), 11);
});

test("caret with no digits before it stays at the start", () => {
  assert.equal(caretForDigits("(480) 352-7598", 0), 0);
  assert.equal(digitsBeforeCaret("(480) 352-7598", 1), 0);
});
