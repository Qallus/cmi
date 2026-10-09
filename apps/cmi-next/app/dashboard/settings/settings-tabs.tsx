"use client";

// Settings is split into tabs so each area stays short. ?tab= keeps the choice
// in the URL, so a link can open straight to Sidebar Navigation or Credentials.
import * as React from "react";
import { KeyRound, PanelLeft, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "general", label: "General", icon: SlidersHorizontal },
  { key: "sidebar", label: "Sidebar Navigation", icon: PanelLeft },
  { key: "credentials", label: "Credentials", icon: KeyRound },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function SettingsTabs({ initialTab, panels }: { initialTab?: string; panels: Record<TabKey, React.ReactNode> }) {
  const [tab, setTab] = React.useState<TabKey>(TABS.some((t) => t.key === initialTab) ? (initialTab as TabKey) : "general");

  function choose(key: TabKey) {
    setTab(key);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", key);
    window.history.replaceState(null, "", url);
  }

  return (
    <div>
      <div role="tablist" className="mb-5 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => choose(t.key)}
            className={cn("-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.key ? "border-accent text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      {panels[tab]}
    </div>
  );
}
