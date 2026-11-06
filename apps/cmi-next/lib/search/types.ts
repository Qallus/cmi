// Shared by the search API and the top-bar search box (safe in the browser).
export type SearchGroup =
  | "Contacts" | "Jobs" | "Pipeline" | "Pre-Con" | "Trade Partners" | "Selections" | "Change Orders"
  | "Invoices" | "Schedule" | "Daily Logs" | "Punch Lists" | "Cloud" | "Documents";
export type SearchHit = { id: string; group: SearchGroup | "Go to"; title: string; subtitle: string | null; href: string };

/** The order groups are shown in ("Go to" = dashboard pages, matched in the browser). */
export const SEARCH_GROUPS: (SearchGroup | "Go to")[] = [
  "Go to", "Jobs", "Contacts", "Pipeline", "Pre-Con", "Trade Partners", "Selections", "Change Orders",
  "Invoices", "Schedule", "Daily Logs", "Punch Lists", "Cloud", "Documents",
];
