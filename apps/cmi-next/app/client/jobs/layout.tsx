import type { ReactNode } from "react";
import { ClientShell } from "./client-shell";
import { getClientSession } from "@/lib/client-portal/auth";

export const dynamic = "force-dynamic";

export default async function ClientJobsLayout({ children }: { children: ReactNode }) {
  const session = await getClientSession();
  const preview = session?.preview ? { name: `${session.contact.first_name ?? ""} ${session.contact.last_name ?? ""}`.trim() || "this client" } : null;
  return <ClientShell preview={preview}>{children}</ClientShell>;
}
