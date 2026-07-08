import { redirect } from "next/navigation";

// Quotes & Leads is now the "Leads" tab of the unified Sales hub.
// Kept as a redirect so existing links/bookmarks continue to work.
export default function QuotesLeadsRedirect() {
  redirect("/dashboard/sales?tab=leads");
}
