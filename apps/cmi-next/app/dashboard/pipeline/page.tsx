import { redirect } from "next/navigation";

// The pipeline (Opportunities) is now the "Opportunities" tab of the unified
// Sales hub. Kept as a redirect so existing links/bookmarks continue to work.
export default function PipelineRedirect() {
  redirect("/dashboard/sales?tab=opportunities");
}
