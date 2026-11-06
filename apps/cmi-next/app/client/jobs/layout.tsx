import type { ReactNode } from "react";
import { PortalShell } from "@/app/client/portal-shell";

export const dynamic = "force-dynamic";

export default function ClientJobsLayout({ children }: { children: ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
