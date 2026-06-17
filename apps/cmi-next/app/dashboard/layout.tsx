"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { ArrowLeft, Bell, PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { DashboardNav } from "@/components/dashboard/nav";
import { cn } from "@/lib/utils";

type SessionUser = {
  display_name: string;
  initials: string;
  title: string;
  avatar_url: string | null;
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [dashboardSearch, setDashboardSearch] = React.useState("");
  const [sessionUser, setSessionUser] = React.useState<SessionUser | null>(null);

  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user?: SessionUser | null }) => { if (data.user) setSessionUser(data.user); })
      .catch(() => {});
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/signout", { method: "POST" });
    router.push("/login");
  }

  React.useEffect(() => {
    setDashboardSearch("");
    window.dispatchEvent(new CustomEvent("cmi-dashboard-search", { detail: { value: "" } }));
  }, [pathname]);

  function updateDashboardSearch(value: string) {
    setDashboardSearch(value);
    window.dispatchEvent(new CustomEvent("cmi-dashboard-search", { detail: { value } }));
  }

  return (
    <div className={cn("min-h-screen bg-background text-foreground lg:grid", collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[232px_1fr]")}>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-all lg:flex", collapsed ? "w-[76px]" : "w-[232px]")}>
        <div className={cn("flex h-[104px] items-start border-b border-border pt-4", collapsed ? "justify-center px-2" : "px-4")}>
          {collapsed ? (
            <>
              <img src="/brand/cmi-favicon-black.png" alt="CMI" className="h-10 w-10 object-contain dark:hidden" />
              <img src="/brand/cmi-favicon-white.png" alt="CMI" className="hidden h-10 w-10 object-contain dark:block" />
            </>
          ) : (
            <a href="/" className="block">
              <img src="/brand/CMI_Line_Logo_Black.svg" alt="Constructed Matter, Inc." className="h-[3.2rem] w-auto object-contain dark:hidden" />
              <img src="/brand/CMI_Line_Logo_White.svg" alt="Constructed Matter, Inc." className="hidden h-[3.2rem] w-auto object-contain dark:block" />
            </a>
          )}
        </div>
        <DashboardNav collapsed={collapsed} />
        <div className="border-t border-border p-3">
          <div className={cn("flex items-center rounded-md py-2", collapsed ? "justify-center px-0" : "justify-between gap-2 px-1")}>
            <div className={cn("flex items-center gap-2", collapsed && "hidden")}>
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {sessionUser?.initials ?? "…"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold">{sessionUser?.display_name ?? ""}</div>
                <div className="truncate text-[11px] text-muted-foreground">{sessionUser?.title ?? ""}</div>
              </div>
            </div>
            <button className="rounded-md border border-border p-1.5 text-muted-foreground" type="button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={() => setCollapsed((v) => !v)}>
              {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </aside>
      <main className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/92 px-5 backdrop-blur">
          <div className="text-sm font-semibold">CMI Dashboard</div>
          <div className="flex items-center gap-2">
            <label className="hidden h-8 w-56 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground md:flex">
              <Search className="h-3.5 w-3.5" />
              <input
                value={dashboardSearch}
                onChange={event => updateDashboardSearch(event.target.value)}
                placeholder="Search"
                className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <ThemeToggle />
            <button className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground" type="button" title="Notifications">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
            </button>
            <button
              className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:border-red-400 hover:text-red-500"
              type="button"
              title="Sign out"
              onClick={handleSignOut}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
        <div className="min-h-[calc(100vh-56px)]">{children}</div>
      </main>
    </div>
  );
}
