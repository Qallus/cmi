// A deal's estimated value: one number, or a range (estimated_value = low,
// estimated_max_value = high). Pure, shared by the Pipeline views, the deal
// page, notifications and Pre-Con hand-off.
type Valued = { estimated_value?: number | null; estimated_max_value?: number | null };

const usd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** "$850,000 – $950,000", "$895,000", or null when there's no estimate. */
export function formatDealValue(d: Valued, fmt: (n: number) => string = usd): string | null {
  const lo = d.estimated_value ?? null, hi = d.estimated_max_value ?? null;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi !== lo) return `${fmt(lo)} – ${fmt(hi)}`;
  return fmt((lo ?? hi)!);
}

/** The number a range counts as in totals and sorting: its midpoint. */
export function dealValueMid(d: Valued): number | null {
  const lo = d.estimated_value ?? null, hi = d.estimated_max_value ?? null;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null) return (lo + hi) / 2;
  return (lo ?? hi)!;
}

export const isRange = (d: Valued) => d.estimated_value != null && d.estimated_max_value != null && d.estimated_max_value !== d.estimated_value;

/** Check a typed range: the high end can't be under the low end. */
export function rangeError(low: number | null, high: number | null): string | null {
  if (high != null && low == null) return "Enter the low end too (or leave “to” empty for one number).";
  if (low != null && high != null && high < low) return "The high end can’t be less than the low end.";
  return null;
}
