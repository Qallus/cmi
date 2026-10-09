"use client";

// Settings → Sidebar navigation: show or hide any sidebar item for everyone.
// Hiding a parent hides its whole group. Settings itself is always shown, so
// there's always a way back.
import * as React from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/dashboard/nav";

const LOCKED = new Set(["/dashboard/settings"]);

export function NavVisibilityPanel({ canEdit }: { canEdit: boolean }) {
  const [hidden, setHidden] = React.useState<Set<string> | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let live = true;
    fetch("/api/nav-settings").then((r) => r.json())
      .then((d: { hidden?: string[] }) => { if (live) setHidden(new Set(d.hidden ?? [])); })
      .catch(() => { if (live) setHidden(new Set()); });
    return () => { live = false; };
  }, []);

  async function toggle(href: string) {
    if (!hidden || !canEdit || LOCKED.has(href)) return;
    const next = new Set(hidden);
    if (next.has(href)) next.delete(href); else next.add(href);
    setHidden(next); setSaving(href); setError(null); setSaved(false);
    const res = await fetch("/api/nav-settings", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hidden: [...next] }),
    });
    setSaving(null);
    if (!res.ok) {
      setHidden(hidden);
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save.");
      return;
    }
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
    window.dispatchEvent(new Event("cmi:nav-settings"));
  }

  if (!hidden) return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>;

  const rows: { href: string; label: string; icon: React.ElementType; child?: boolean; parentHidden?: boolean }[] = [];
  for (const item of NAV_ITEMS) {
    if ("section" in item) continue;
    rows.push({ href: item.href, label: item.label, icon: item.icon });
    for (const c of item.children ?? []) rows.push({ href: c.href, label: c.label, icon: c.icon, child: true, parentHidden: hidden.has(item.href) });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Hidden items are removed from everyone&apos;s sidebar. The pages still work from a direct link, with the same access rules.
          {!canEdit && " Only a Super Admin can change these."}
        </p>
        {saved && <span className="flex shrink-0 items-center gap-1 text-xs text-[#2e7d5b]"><Check className="h-3.5 w-3.5" /> Saved</span>}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((r) => {
          const on = !hidden.has(r.href) && !r.parentHidden;
          const locked = LOCKED.has(r.href);
          return (
            <li key={r.href} className={cn("flex items-center justify-between gap-3 px-3 py-2", r.child && "pl-9")}>
              <span className={cn("flex items-center gap-2 text-sm", !on && "text-muted-foreground")}>
                <r.icon className="h-3.5 w-3.5" /> {r.label}
                {locked && <span className="text-[11px] text-muted-foreground">· always shown</span>}
                {r.parentHidden && <span className="text-[11px] text-muted-foreground">· hidden with its group</span>}
              </span>
              <span className="flex items-center gap-2">
                {saving === r.href && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${on ? "Hide" : "Show"} ${r.label}`}
                  disabled={!canEdit || locked || r.parentHidden}
                  onClick={() => void toggle(r.href)}
                  className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50", on ? "bg-accent" : "bg-muted-foreground/30")}
                >
                  <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", on ? "left-[18px]" : "left-0.5")} />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
