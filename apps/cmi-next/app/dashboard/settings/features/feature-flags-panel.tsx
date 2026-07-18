"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { FeatureFlag } from "@/lib/flags";

// Admin toggle list for DB-backed feature flags. Optimistic flip with rollback
// on error. PATCH is role-guarded server-side.
export function FeatureFlagsPanel({ initial }: { initial: FeatureFlag[] }) {
  const [flags, setFlags] = React.useState<FeatureFlag[]>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function toggle(key: string, enabled: boolean) {
    setBusy(key);
    setError(null);
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled } : f)));
    try {
      const res = await fetch("/api/dashboard/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, enabled: !enabled } : f)));
      setError(err instanceof Error ? err.message : "Failed to update flag.");
    } finally {
      setBusy(null);
    }
  }

  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No feature flags yet. Run the Project Canvas migration to seed them.</p>;
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="divide-y divide-border">
        {flags.map((f) => (
          <div key={f.key} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <code className="text-xs text-muted-foreground">{f.key}</code>
                <Badge tone={f.enabled ? "success" : "default"}>{f.enabled ? "On" : "Off"}</Badge>
              </div>
              {f.description && <div className="mt-0.5 text-sm">{f.description}</div>}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={f.enabled}
              aria-label={`Toggle ${f.key}`}
              disabled={busy === f.key}
              onClick={() => toggle(f.key, !f.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${f.enabled ? "bg-accent" : "bg-muted"} ${busy === f.key ? "opacity-60" : ""}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${f.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
              {busy === f.key && <Loader2 className="absolute -right-6 h-3.5 w-3.5 animate-spin text-muted-foreground" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
