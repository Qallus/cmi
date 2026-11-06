import type { ReactNode } from "react";
import { ClientShell } from "./jobs/client-shell";
import { getClientSession } from "@/lib/client-portal/auth";

// The portal frame for every signed-in client page. It works out whether this
// is a staff "Preview as client" so the amber bar (and no Sign out) shows on
// every page, not just a project's.
export async function PortalShell({ children }: { children: ReactNode }) {
  const session = await getClientSession();
  const preview = session?.preview ? { name: `${session.contact.first_name ?? ""} ${session.contact.last_name ?? ""}`.trim() || "this client" } : null;
  return <ClientShell preview={preview}>{children}</ClientShell>;
}
