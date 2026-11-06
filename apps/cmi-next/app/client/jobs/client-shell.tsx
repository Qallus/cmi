"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Eye, LogOut, Menu, Settings, SquarePen } from "lucide-react";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { PortalFooterNav, PortalMobileMenu, PortalNavProvider, PortalSidebar } from "../portal-nav";

// Authenticated client-portal chrome, wrapping every signed-in /client page:
// the brand bar (logo, notifications, theme, settings, sign out), the phone
// menu and footer, and the content column. The bar's contents sit in the same
// column as the content below, so the logo lines up with the left edge of the
// page and the icons with the right.
export const PORTAL_COLUMN = "mx-auto w-full max-w-6xl px-4 md:px-8";

export function ClientShell({ children, preview = null, contactId = null }: { children: React.ReactNode; preview?: { name: string } | null; contactId?: string | null }) {
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);
  const [canvasOn, setCanvasOn] = React.useState(false);
  const [menu, setMenu] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const load = () => fetch("/api/client/notifications/unread-count").then((r) => r.json()).then((d) => { if (active) setUnread(d.count ?? 0); }).catch(() => {});
    load();
    fetch("/api/flags").then((r) => r.json()).then((d: { flags?: Record<string, boolean> }) => { if (active) setCanvasOn(d.flags?.project_canvas === true); }).catch(() => {});
    const t = setInterval(load, 60_000);
    return () => { active = false; clearInterval(t); };
  }, []);

  async function signOut() {
    await fetch("/api/client/auth/signout", { method: "POST" });
    router.push("/client/login");
  }
  const signOutButton = preview ? null : (
    <button type="button" onClick={signOut} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-xs font-medium text-muted-foreground hover:border-red-400 hover:text-red-500">
      <LogOut className="h-3.5 w-3.5" /> Sign out
    </button>
  );
  const iconBtn = "relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition hover:text-foreground";

  return (
    <PortalNavProvider canvas={canvasOn} contactId={contactId}>
      <div className="min-h-screen bg-background text-foreground">
        <div className="sticky top-0 z-30">
          {preview ? (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-1.5 text-center text-xs font-medium text-black">
              <Eye className="h-3.5 w-3.5" />
              <span>Preview: you&apos;re seeing the portal as {preview.name}. Nothing can be changed or sent.</span>
              <a href="/api/client/auth/preview-exit" className="rounded bg-black/80 px-2 py-0.5 text-white hover:bg-black">Exit preview</a>
            </div>
          ) : null}
          <header className="border-b border-border bg-background/92 backdrop-blur">
            <div className={`${PORTAL_COLUMN} flex h-14 items-center justify-between gap-3`}>
              <div className="flex min-w-0 items-center gap-2.5">
                <button type="button" onClick={() => setMenu(true)} aria-label="Open navigation menu" className={`${iconBtn} lg:hidden`}><Menu className="h-4 w-4" /></button>
                <Link href="/client/jobs" className="flex min-w-0 items-center gap-3">
                  {/* Phone / tablet: the app icon. Desktop: the full logo. Each in a light and a dark version. */}
                  {/* eslint-disable-next-line @next/next/no-img-element -- static brand images, same as the dashboard */}
                  <img src="/brand/cmi_app_icon_black.png" alt="Constructed Matter, Inc." className="h-8 w-8 object-contain lg:hidden dark:hidden" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/cmi_app_icon_white.png" alt="" aria-hidden className="hidden h-8 w-8 object-contain dark:block lg:dark:hidden" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/CMI_Line_Logo_Black.svg" alt="Constructed Matter, Inc." className="hidden h-7 w-auto object-contain lg:block lg:dark:hidden" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/CMI_Line_Logo_White.svg" alt="" aria-hidden className="hidden h-7 w-auto object-contain lg:dark:block" />
                </Link>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link href="/client/jobs" className="hidden px-1 text-sm font-medium text-muted-foreground hover:text-foreground lg:inline">My Projects</Link>
                {canvasOn && (
                  <Link href="/client/canvas" className="hidden items-center gap-1.5 px-1 text-sm font-medium text-muted-foreground hover:text-foreground lg:inline-flex" title="Project Canvas">
                    <SquarePen className="h-4 w-4" /> Canvas
                  </Link>
                )}
                <ThemeToggle />
                <Link href="/client/notifications" className={iconBtn} title="Notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
                  <Bell className="h-4 w-4" />
                  {unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">{unread > 9 ? "9+" : unread}</span>}
                </Link>
                <Link href="/client/settings" className={iconBtn} title="Settings" aria-label="Settings"><Settings className="h-4 w-4" /></Link>
                {/* Only when there is a Sign out (not in a preview), so no empty gap shifts the right edge. */}
                {signOutButton ? <span className="hidden lg:inline-flex">{signOutButton}</span> : null}
              </div>
            </div>
          </header>
        </div>
        {/* Bottom padding on phones leaves room for the footer bar. */}
        {/* Desktop: the menu down the left on every page, lined up with the logo. */}
        <main className={`${PORTAL_COLUMN} pb-28 pt-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:pb-10`}>
          <PortalSidebar />
          <div className="min-w-0">{children}</div>
        </main>
        <PortalFooterNav />
        <PortalMobileMenu open={menu} onClose={() => setMenu(false)} footer={signOutButton ?? <span className="text-xs text-muted-foreground">Preview: nothing can be changed or sent.</span>} />
      </div>
    </PortalNavProvider>
  );
}
