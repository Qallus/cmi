"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = { key: string; label: string; description: string };

const ROWS: Row[] = [
  {
    key: "project_canvas_public",
    label: "Public website",
    description: "Show Project Canvas in the site nav, footer, and the public /project-canvas page.",
  },
  {
    key: "project_canvas",
    label: "Staff & client dashboard",
    description: "Enable the Project Canvas feature inside the dashboard and client portal.",
  },
];

export function ProjectCanvasVisibility() {
  const [flags, setFlags] = React.useState<Record<string, boolean>>({});
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/flags")
      .then((r) => r.json())
      .then((d: { flags?: Record<string, boolean> }) => setFlags(d.flags ?? {}))
      .catch(() => setError("Could not load current settings."))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: string) {
    const next = !flags[key];
    setBusy(key);
    setError(null);
    setFlags((prev) => ({ ...prev, [key]: next }));
    try {
      const res = await fetch("/api/dashboard/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled: next }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setFlags((prev) => ({ ...prev, [key]: !next }));
      setError(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="pt-0">
      {error && <p className="pb-2 text-sm text-destructive">{error}</p>}
      <div className="divide-y divide-border">
        {ROWS.map((row) => {
          const on = flags[row.key] === true;
          return (
            <div key={row.key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{row.label}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{row.description}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                aria-label={`Toggle ${row.label}`}
                disabled={busy === row.key}
                onClick={() => void toggle(row.key)}
                className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-muted", busy === row.key && "opacity-60")}
              >
                <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
