// The Overview dashboard's layout: sections (rows that slide sideways, or
// grids) holding cards. Saved per person (dashboard_layouts). Pure, so the
// page, the save route and the tests share it. Unknown card types are dropped
// when a layout is read. Ported from Echo (src/lib/dashboard/layout.ts).

export const CARD_TYPES = [
  // Info
  "get_started", "whats_new",
  // Tools
  "search", "all_features", "clock", "weather", "dialpad", "recorder", "notepad", "ask_bolt", "quick_links", "task_list",
  // Activity
  "notifications", "next_up", "agent_alert", "job_alert",
  // Tasks
  "my_tasks",
  // Schedule
  "mini_calendar", "upcoming",
  // Stats
  "stat_calls", "stat_outbound", "stat_inbound", "stat_missed", "stat_sms", "stat_bookings", "stat_calendar",
  "stat_notifications", "stat_messages", "stat_alerts", "stat_emails", "stat_files",
  "stat_jobs", "stat_pipeline", "stat_precon", "stat_punch", "stat_daily_logs", "stat_contacts",
  // Company (the original Overview)
  "company_counts", "recent_activity", "quick_actions", "revenue_outlook",
  // Projects
  "schedules_look",
  // Charts
  "chart_calls", "chart_texts", "chart_pipeline", "chart_jobs",
  // AI
  "paperclip_agents",
  // Files
  "recent_files",
  // Admin
  "admin_shortcuts",
] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const SIZES = ["xs", "sm", "md", "lg", "xl"] as const;
export type Size = (typeof SIZES)[number];

export type Card = { id: string; type: CardType; size: Size; hidden?: boolean; settings?: Record<string, unknown> };
export type Section = { id: string; title: string; hidden?: boolean; collapsed?: boolean; style: "row" | "grid"; cards: Card[] };
export type Layout = { v: 1; template: "standard" | "blank"; sections: Section[] };

let n = 0;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${(n++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const card = (type: CardType, size: Size, settings?: Record<string, unknown>): Card => ({ id: `${type}-1`, type, size, ...(settings ? { settings } : {}) });

/** Standard: Jeremy's default rows, then the original Overview below. */
export const STANDARD: Layout = {
  v: 1, template: "standard", sections: [
    { id: "start", title: "Get started", style: "row", cards: [card("get_started", "xl")] },
    { id: "status", title: "Search and status", style: "row", cards: [card("search", "lg"), card("all_features", "xs"), card("clock", "sm"), card("weather", "sm")] },
    { id: "activity", title: "Notifications", style: "row", cards: [card("agent_alert", "md"), card("next_up", "md"), card("job_alert", "md"), card("notifications", "md")] },
    { id: "tasks", title: "My Tasks", style: "row", cards: [card("my_tasks", "xl")] },
    { id: "stats", title: "Stats", style: "row", cards: [
      card("stat_calls", "sm"), card("stat_outbound", "xs"), card("stat_inbound", "xs"), card("stat_missed", "xs"), card("stat_sms", "sm"),
      card("stat_bookings", "xs"), card("stat_calendar", "xs"), card("stat_notifications", "xs"), card("stat_messages", "xs"),
      card("stat_alerts", "xs"), card("stat_emails", "xs"), card("stat_files", "sm"),
    ] },
    { id: "news", title: "What's new", style: "row", cards: [card("whats_new", "xl")] },
    { id: "company", title: "Company", style: "grid", cards: [
      card("company_counts", "xl"), card("recent_activity", "lg"), card("revenue_outlook", "lg"), card("quick_actions", "md"), card("upcoming", "md"),
    ] },
  ],
};

export const BLANK: Layout = {
  v: 1, template: "blank", sections: [
    { id: "start", title: "Get started", style: "row", cards: [card("get_started", "xl")] },
    { id: "mine", title: "My dashboard", style: "grid", cards: [] },
  ],
};

export const isCardType = (t: unknown): t is CardType => (CARD_TYPES as readonly string[]).includes(t as string);
const isSize = (s: unknown): s is Size => (SIZES as readonly string[]).includes(s as string);
const text = (v: unknown, d: string, max = 60) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : d);

/**
 * A clean layout from anything saved (or null for "never set up"). `allowed`
 * drops cards this person can't use (their role or a flag), so a layout
 * copied between people never shows something they can't open.
 */
export function normalize(value: unknown, allowed: (t: CardType) => boolean = () => true): Layout | null {
  const v = value as Partial<Layout> | null;
  if (!v || typeof v !== "object" || !Array.isArray(v.sections)) return null;
  const seen = new Set<string>();
  const sections: Section[] = v.sections.slice(0, 40).flatMap((s) => {
    if (!s || typeof s !== "object") return [];
    const id = text(s.id, newId("s"), 80);
    if (seen.has(id)) return [];
    seen.add(id);
    const cards: Card[] = (Array.isArray(s.cards) ? s.cards : []).slice(0, 60).flatMap((c) => {
      if (!c || !isCardType(c.type) || !allowed(c.type)) return [];
      const cid = text(c.id, newId(c.type), 80);
      if (seen.has(cid)) return [];
      seen.add(cid);
      const settings = c.settings && typeof c.settings === "object" && !Array.isArray(c.settings) ? c.settings : undefined;
      return [{ id: cid, type: c.type, size: isSize(c.size) ? c.size : "sm", ...(c.hidden ? { hidden: true } : {}), ...(settings ? { settings } : {}) }];
    });
    return [{ id, title: text(s.title, "Section"), style: s.style === "grid" ? ("grid" as const) : ("row" as const), cards,
      ...(s.hidden ? { hidden: true } : {}), ...(s.collapsed ? { collapsed: true } : {}) }];
  });
  return { v: 1, template: v.template === "blank" ? "blank" : "standard", sections };
}

export const copy = (l: Layout): Layout => JSON.parse(JSON.stringify(l)) as Layout;

/** Every card type a layout uses (to load only the data it needs). */
export function typesIn(l: Layout | null): Set<CardType> {
  return new Set((l?.sections ?? []).flatMap((s) => (s.hidden ? [] : s.cards.filter((c) => !c.hidden).map((c) => c.type))));
}
