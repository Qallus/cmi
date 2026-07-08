"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

// Authenticated client-portal chrome: brand bar + sign out. Wraps all
// /client/jobs pages.
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await fetch("/api/client/auth/signout", { method: "POST" });
    router.push("/client/login");
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-8">
        <Link href="/client/jobs" className="flex items-center gap-3">
          <img src="/brand/cmi-logo-dark.png" alt="Constructed Matter, Inc." className="h-7 object-contain dark:hidden" />
          <img src="/brand/cmi-logo-light.png" alt="Constructed Matter, Inc." className="hidden h-7 object-contain dark:block" />
          <span className="hidden text-xs uppercase tracking-[0.16em] text-muted-foreground sm:inline">Project Portal</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/client/jobs" className="text-sm font-medium text-muted-foreground hover:text-foreground">My Projects</Link>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
