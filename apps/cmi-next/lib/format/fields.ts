// Display formatting for money and phone fields.
//
// These run on every keystroke, so they have to format a half-typed value
// sensibly — "(480) 35" while someone is partway through a number, "1,250"
// while they're partway through a figure. Pure functions, no React, so the
// behaviour can be tested directly.

/** Digits only, capped at 10 and with a leading US country code dropped. */
export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * "(480) 352-7598", formatting only as far as has been typed.
 *
 * The brackets don't appear until the area code is complete — an input that
 * shows "(4" after one keystroke feels like it's fighting you, and makes
 * backspacing over the bracket strange.
 */
export function formatPhone(value: string): string {
  const d = phoneDigits(value);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Digits and at most one decimal point with at most two places after it. */
export function moneyDigits(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return `${cleaned.slice(0, dot)}.${cleaned.slice(dot + 1, dot + 3)}`;
}

/**
 * "1,250,000" / "1,250.50" — commas in the whole part, the decimals left as
 * typed so the field doesn't add ".00" under someone mid-entry.
 */
export function formatMoney(value: string): string {
  const raw = moneyDigits(value);
  if (raw === "") return "";
  const dot = raw.indexOf(".");
  const whole = dot === -1 ? raw : raw.slice(0, dot);
  const grouped = whole === "" ? "" : Number(whole).toLocaleString("en-US");
  return dot === -1 ? grouped : `${grouped}.${raw.slice(dot + 1)}`;
}

/**
 * Where the caret belongs after reformatting.
 *
 * Inserting a comma or a bracket shifts everything after it, so a caret
 * restored by character offset drifts. Count the significant characters —
 * the digits — before the caret instead, and find that same position in the
 * new string.
 */
export function caretForDigits(formatted: string, digitsBefore: number): number {
  let seen = 0;
  let i = 0;
  for (; i < formatted.length && seen < digitsBefore; i++) {
    if (/\d/.test(formatted[i])) seen++;
  }
  return i;
}

/** How many digits precede `caret` in `value`. */
export function digitsBeforeCaret(value: string, caret: number): number {
  return (value.slice(0, caret).match(/\d/g) ?? []).length;
}
