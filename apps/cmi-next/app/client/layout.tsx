import type { ReactNode } from "react";

export const metadata = { title: "Project Portal — Constructed Matter, Inc." };

// The client portal is a separate surface from the staff dashboard. This layout
// is intentionally minimal; the authenticated chrome lives in /client/jobs.
export default function ClientPortalLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background text-foreground">{children}</div>;
}
