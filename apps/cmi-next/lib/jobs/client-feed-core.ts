// The job's client feed: everything a client sent, newest first, with what's
// still waiting on the team. Pure, so the ordering and "needs reply" rules are tested.

export type FeedKind = "selection" | "message" | "sms" | "email" | "warranty" | "action_item" | "canvas";

export type FeedItem = {
  id: string;
  kind: FeedKind;
  at: string;
  who: string;
  title: string;
  body: string | null;
  /** Where it lives in the dashboard. */
  href: string;
  /** Still waiting on the team. */
  open: boolean;
};

export const FEED_LABEL: Record<FeedKind, string> = {
  selection: "Selection", message: "Message", sms: "Text", email: "Email", warranty: "Warranty", action_item: "Action item", canvas: "Project Canvas",
};

/** Newest first; open items are counted per kind for the badges. */
export function buildFeed(items: FeedItem[]): { items: FeedItem[]; open: number; openBy: Partial<Record<FeedKind, number>> } {
  const sorted = [...items].sort((a, b) => b.at.localeCompare(a.at));
  const openBy: Partial<Record<FeedKind, number>> = {};
  for (const i of sorted) if (i.open) openBy[i.kind] = (openBy[i.kind] ?? 0) + 1;
  return { items: sorted, open: sorted.filter((i) => i.open).length, openBy };
}

export type CommRow = { id: string; direction: string; channel: string; contact_id: string | null; created_at: string };

/**
 * Inbound texts / emails that nobody has answered: an inbound message is open
 * when no outbound message on the same channel went to that contact after it.
 */
export function unansweredInbound(rows: CommRow[]): Set<string> {
  const lastOut = new Map<string, string>();
  for (const r of rows) {
    if (r.direction !== "outbound" || !r.contact_id) continue;
    const k = `${r.contact_id}|${r.channel}`;
    if (!lastOut.has(k) || r.created_at > lastOut.get(k)!) lastOut.set(k, r.created_at);
  }
  const open = new Set<string>();
  for (const r of rows) {
    if (r.direction !== "inbound") continue;
    const out = r.contact_id ? lastOut.get(`${r.contact_id}|${r.channel}`) : undefined;
    if (!out || out < r.created_at) open.add(r.id);
  }
  return open;
}
