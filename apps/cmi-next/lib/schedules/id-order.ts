// Activity IDs order the schedule (Spec R2 §4.3): give a task a number and it
// sits where that number sorts within its phase. The grid does this as you type;
// this is the same rule for everything else (the task drawer, + Item, Claude).
// Pure, so it's tested.

export type OrderRow = { id: string; activity_id: number | null; sort_order: number };

/**
 * New sort_order values that put `itemId` where its activity ID sorts among the
 * rows of its group (same schedule and phase). The group's own sort_order values
 * are reused in the new order, so rows in other phases keep their places.
 * Returns only the rows whose sort_order changes.
 */
export function placeByActivityId(rows: OrderRow[], itemId: string): { id: string; sort_order: number }[] {
  const item = rows.find((r) => r.id === itemId);
  if (!item || item.activity_id == null) return [];
  const byOrder = (a: OrderRow, b: OrderRow) => a.sort_order - b.sort_order || (a.activity_id ?? Infinity) - (b.activity_id ?? Infinity);
  const others = rows.filter((r) => r.id !== itemId).sort(byOrder);
  let at = others.findIndex((r) => r.activity_id != null && r.activity_id > item.activity_id!);
  if (at < 0) at = others.length;
  const order = [...others.slice(0, at), item, ...others.slice(at)];
  const slots = rows.map((r) => r.sort_order).sort((a, b) => a - b);
  const out: { id: string; sort_order: number }[] = [];
  order.forEach((r, i) => { if (r.sort_order !== slots[i]) out.push({ id: r.id, sort_order: slots[i] }); });
  return out;
}

export type DocRow = { id: string; activity_id: number | null; phaseId: string | null };

/**
 * The phase a task joins when its ID is changed by hand (Grid Addendum §1.4):
 * it's re-inserted just before the first task (in schedule order, phases
 * passed over) whose ID is greater, so it joins the phase of the task above
 * that spot, or the one below when it lands at the very top. `order` is every
 * task in schedule order.
 */
export function landingPhase(order: DocRow[], itemId: string, newId: number): string | null {
  const rest = order.filter((r) => r.id !== itemId);
  let at = rest.findIndex((r) => (r.activity_id ?? Infinity) > newId);
  if (at < 0) at = rest.length;
  const own = order.find((r) => r.id === itemId);
  return (rest[at - 1] ?? rest[at])?.phaseId ?? own?.phaseId ?? null;
}

export type RenumberRow = { id: string; title: string; activity_id?: number | null };
export type RenumberChange = { id: string; title: string; from: number | null; to: number };

/** Renumber by tens (§1.6): every task in schedule order gets 10, 20, 30…
 *  Returns every task's old → new ID (the preview and the audit map). */
export function renumberPlan(order: RenumberRow[]): RenumberChange[] {
  return order.map((r, i) => ({ id: r.id, title: r.title, from: r.activity_id ?? null, to: (i + 1) * 10 }));
}
