"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { ArrowLeft, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { DashboardNav, type UserRole } from "@/components/dashboard/nav";
import { NotificationBell } from "@/components/dashboard/notification-bell";
import { ReviewFab } from "@/components/dashboard/review-fab";
import { MobileBottomNav } from "@/components/dashboard/mobile-bottom-nav";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { InstallAppButton } from "@/components/pwa/install-app-button";
import { SidebarContext } from "@/components/dashboard/sidebar-context";
import { cn } from "@/lib/utils";

// A single job's detail pages (…/jobs/<id>/…), excluding the list/new/map routes.
function isJobDetailPath(pathname: string): boolean {
  return /^\/dashboard\/jobs\/[^/]+/.test(pathname) && !/^\/dashboard\/jobs\/(new|map|new-from-template|client-engagement)(\/|$)/.test(pathname);
}

type SessionUser = {
  display_name: string;
  initials: string;
  title: string;
  role: UserRole;
  avatar_url: string | null;
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);
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

  // Clear any in-place list filter (e.g. Contacts) when navigating between pages,
  // and close the mobile nav on navigation.
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("cmi-dashboard-search", { detail: { value: "" } }));
    setMobileNavOpen(false);
  }, [pathname]);

  // On a job's pages, auto-collapse the main sidebar (which flips the job sub-nav
  // to vertical); restore it when leaving. Fires only on that transition, so the
  // user can still expand/collapse manually while staying on the page.
  const onJobPage = isJobDetailPath(pathname);
  React.useEffect(() => {
    setCollapsed(onJobPage);
  }, [onJobPage]);

  return (
    <SidebarContext.Provider value={{ collapsed }}>
    <div className={cn("min-h-screen bg-background text-foreground lg:grid print:!block", collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[232px_1fr]")}>
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card transition-all lg:flex print:hidden", collapsed ? "w-[76px]" : "w-[232px]")}>
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
        <DashboardNav collapsed={collapsed} role={sessionUser?.role ?? "viewer"} />
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
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/92 px-5 backdrop-blur print:hidden">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-foreground lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <img src="/brand/cmi-mark.svg" alt="Constructed Matter, Inc." className="h-7 w-7 object-contain lg:hidden dark:invert" />
            <span className="hidden text-sm font-semibold lg:block">CMI Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <GlobalSearch />
            <InstallAppButton variant="outline" size="sm" label="Get the App" className="hidden sm:inline-flex" />
            <ThemeToggle />
            <NotificationBell />
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
        <div className={cn("min-h-[calc(100vh-56px)] pb-24 lg:pb-0 print:pb-0", onJobPage && collapsed && "lg:pl-52")}>{children}</div>
      </main>
      {/* Leadership review FAB — Super Admin only, on every dashboard page. */}
      {sessionUser?.role === "super_admin" && <ReviewFab />}
      {/* Fixed quick-nav on mobile/tablet. */}
      <MobileBottomNav />

      {/* Full-screen mobile navigation (hamburger). */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden print:hidden">
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
            <div className="flex items-center gap-2.5">
              <img src="/brand/cmi-mark.svg" alt="Constructed Matter, Inc." className="h-8 w-8 object-contain dark:invert" />
              <span className="text-sm font-semibold">Menu</span>
            </div>
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <DashboardNav role={sessionUser?.role ?? "viewer"} />
          </div>
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{sessionUser?.initials ?? "…"}</div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold">{sessionUser?.display_name ?? ""}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{sessionUser?.title ?? ""}</div>
                </div>
              </div>
              <button type="button" onClick={handleSignOut} className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:border-red-400 hover:text-red-500" title="Sign out">
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </SidebarContext.Provider>
  );
}
