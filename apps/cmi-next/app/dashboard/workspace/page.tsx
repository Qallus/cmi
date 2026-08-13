import { redirect } from "next/navigation";

// The Workspace home is surfaced as the "Workspace" tab inside /dashboard/documents.
// This index simply forwards there (preserving the selected space), so any direct
// hit or legacy link lands on the integrated surface.
export default async function WorkspaceIndex({ searchParams }: { searchParams: Promise<{ ws?: string }> }) {
  const { ws } = await searchParams;
  redirect(ws ? `/dashboard/documents?ws=${ws}` : "/dashboard/documents");
}
