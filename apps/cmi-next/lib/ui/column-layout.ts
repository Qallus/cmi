// Column widths for a resizable, fill-the-width table. Pure, so
// lib/ui/column-layout.test.mjs can run it directly.
//
// Rules:
// - A column someone resized ("custom") keeps exactly that width.
// - Every other visible column starts at its default and grows in proportion
//   to it, so together they fill the space that's left. Hiding a column
//   spreads its space across all the rest, instead of one column taking it.
// - When every visible column has been resized, all of them scale up
//   together to fill the width, except the one being dragged (`pinned`), so
//   it follows the mouse.
// - Columns never shrink below their width: if they don't fit, the table
//   grows wider than the box and scrolls sideways.

export type ColumnLayoutInput = {
  /** Visible resizable columns, in order. */
  keys: string[];
  defaults: Record<string, number>;
  custom: Record<string, number>;
  /** Width available for the resizable columns (the box minus fixed columns). 0 = unknown. */
  available: number;
  /** The column being dragged, if any: it never flexes. */
  pinned?: string | null;
  /** Used when a column has no default. */
  fallback?: number;
};

export function layoutColumns({ keys, defaults, custom, available, pinned = null, fallback = 160 }: ColumnLayoutInput): {
  widths: Record<string, number>;
  total: number;
} {
  const base = (k: string) => custom[k] ?? defaults[k] ?? fallback;
  let flex = keys.filter((k) => custom[k] == null && k !== pinned);
  if (flex.length === 0) flex = keys.filter((k) => k !== pinned);
  const flexSet = new Set(flex);

  const fixedSum = keys.filter((k) => !flexSet.has(k)).reduce((s, k) => s + base(k), 0);
  const flexBase = flex.reduce((s, k) => s + base(k), 0);
  const scale = available > 0 && flexBase > 0 ? Math.max(1, (available - fixedSum) / flexBase) : 1;

  const widths: Record<string, number> = {};
  for (const k of keys) widths[k] = flexSet.has(k) ? Math.floor(base(k) * scale) : base(k);
  let total = keys.reduce((s, k) => s + widths[k], 0);
  // Flooring leaves a few pixels: give them to the last flexing column.
  if (scale > 1 && flex.length && total < available) {
    widths[flex[flex.length - 1]] += available - total;
    total = available;
  }
  return { widths, total };
}
