"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Settings } from "lucide-react";

// Authenticated client-portal chrome: brand bar + notifications + sign out.
// Wraps all authenticated /client pages.
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    const load = () => fetch("/api/client/notifications/unread-count").then((r) => r.json()).then((d) => { if (active) setUnread(d.count ?? 0); }).catch(() => {});
    load();
    const t = setInterval(load, 60_000);
    return () => { active = false; clearInterval(t); };
  }, []);

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
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/client/jobs" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground sm:inline">My Projects</Link>
          <Link href="/client/notifications" className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground" title="Notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <Link href="/client/settings" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:text-foreground" title="Settings"><Settings className="h-4 w-4" /></Link>
          <button type="button" onClick={signOut} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
            <LogOut className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">{children}</main>
    </div>
  );
}
