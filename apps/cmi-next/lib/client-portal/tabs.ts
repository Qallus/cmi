// The project pages a client sees, from their per-project permissions and the
// project's status. Shared by the project layout and My Projects (which keeps
// a client's only project in the menu). Order here doesn't matter: the menu
// groups them (app/client/portal-nav.tsx).
import { clientCan, clientCanSubmitWarranty } from "./permissions";

export type ClientTab = { slug: string; label: string };

export function clientTabsFor(job: { status: string; permissions: Record<string, boolean> }, hasPunch: boolean): ClientTab[] {
  const p = job.permissions;
  const tabs: ClientTab[] = [
    { slug: "overview", label: "Overview" },
    { slug: "updates", label: "Updates" },
    { slug: "progress", label: "Progress" },
  ];
  if (clientCan(p, "schedule_items")) tabs.push({ slug: "schedule", label: "Schedule" }, { slug: "milestones", label: "Milestones" });
  if (clientCan(p, "photos")) tabs.push({ slug: "photos", label: "Photos" });
  if (clientCan(p, "files")) tabs.push({ slug: "documents", label: "Documents" });
  if (clientCan(p, "locked_selections")) tabs.push({ slug: "selections", label: "Selections" });
  tabs.push({ slug: "action-items", label: "Action Items" });
  // Only when staff have shared at least one punch list on this project.
  if (hasPunch) tabs.push({ slug: "punch-list", label: "Punch List" });
  if (clientCan(p, "price_summary") || clientCan(p, "invoices")) tabs.push({ slug: "financials", label: "Financials" });
  tabs.push({ slug: "change-orders", label: "Change Orders" });
  if (clientCan(p, "messages")) tabs.push({ slug: "messages", label: "Messages" });
  if (clientCanSubmitWarranty(p, job.status)) tabs.push({ slug: "warranty", label: "Warranty" });
  return tabs;
}
