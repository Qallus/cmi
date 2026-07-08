import type { ReactNode } from "react";
import { ClientShell } from "./client-shell";

export const dynamic = "force-dynamic";

export default function ClientJobsLayout({ children }: { children: ReactNode }) {
  return <ClientShell>{children}</ClientShell>;
}
