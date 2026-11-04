// A deal's estimate: the estimated amount (estimated_value) and, optionally, a
// range (estimated_low_value – estimated_high_value). Pure, shared by the
// Pipeline views, the deal page, notifications and the Pre-Con hand-off.
type Valued = { estimated_value?: number | null; estimated_low_value?: number | null; estimated_high_value?: number | null };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "$850,000 – $950,000", one end ("from $850,000" / "up to $950,000"), or null. */
export function formatDealRange(d: Valued, fmt: (n: number) => string = usd): string | null {
  const lo = d.estimated_low_value ?? null, hi = d.estimated_high_value ?? null;
  if (lo != null && hi != null) return lo === hi ? fmt(lo) : `${fmt(lo)} – ${fmt(hi)}`;
  if (lo != null) return `from ${fmt(lo)}`;
  if (hi != null) return `up to ${fmt(hi)}`;
  return null;
}

/** The amount, else the range: what a list cell or card shows on one line. */
export function formatDealValue(d: Valued, fmt: (n: number) => string = usd): string | null {
  return d.estimated_value != null ? fmt(d.estimated_value) : formatDealRange(d, fmt);
}

/** The number a deal counts as in totals and sorting: the amount, else the
 *  range's midpoint, else whichever end is set. */
export function dealValueMid(d: Valued): number | null {
  if (d.estimated_value != null) return d.estimated_value;
  const lo = d.estimated_low_value ?? null, hi = d.estimated_high_value ?? null;
  if (lo != null && hi != null) return (lo + hi) / 2;
  return lo ?? hi;
}

export const hasRange = (d: Valued) => d.estimated_low_value != null || d.estimated_high_value != null;

/** The high end can't be under the low end. */
export function rangeError(low: number | null, high: number | null): string | null {
  if (low != null && high != null && high < low) return "Estimated high can’t be less than estimated low.";
  return null;
}
