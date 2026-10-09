"use client";

// Notifications has one tab per kind of outbound message Super Admins control.
// ?tab= keeps the choice in the URL so a link can open straight to one.
import * as React from "react";
import { Megaphone, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { NotificationsClient } from "./notifications-client";
import { BriefingPanel } from "./briefing-panel";

const TABS = [
  { key: "broadcasts", label: "Broadcasts", icon: Megaphone, blurb: "Send an announcement to everyone, all staff, all clients or one role. It goes to the in-app bell and web push; people who opted out are skipped." },
  { key: "briefing", label: "Morning Briefing", icon: Sun, blurb: "Each person's day in their inbox at 6 AM: meetings, tasks, what's waiting on them and overnight changes to their jobs and deals." },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function NotificationsTabs({ initialTab }: { initialTab?: string }) {
  const [tab, setTab] = React.useState<TabKey>(TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "broadcasts");
  const current = TABS.find((t) => t.key === tab) ?? TABS[0];

  function choose(key: TabKey) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div role="tablist" className="mb-2 flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => choose(t.key)}
            className={cn("-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      <p className="mb-5 text-sm text-muted-foreground">{current.blurb}</p>
      {tab === "broadcasts" ? <NotificationsClient /> : <BriefingPanel />}
    </div>
  );
}
