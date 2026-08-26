"use client";

import * as React from "react";
import { Loader2, Chrome } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Member = { id: string; name: string; email: string; role: string; enabled: boolean };

// Admin roster with a per-staff enable/disable toggle for the Selection Card
// Builder Chrome extension. Optimistic flip with rollback on error; PATCH is
// role-guarded server-side. Grant-per-row: off = no extension access.
export function ExtensionAccessPanel() {
  const [members, setMembers] = React.useState<Member[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/admin/extension-access")
      .then((r) => r.json())
      .then((d: { members?: Member[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setMembers(d.members ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load."));
  }, []);

  async function toggle(id: string, enabled: boolean) {
    setBusy(id);
    setError(null);
    setMembers((prev) => prev?.map((m) => (m.id === id ? { ...m, enabled } : m)) ?? prev);
    try {
      const res = await fetch("/api/admin/extension-access", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staff_user_id: id, enabled }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
    } catch (err) {
      setMembers((prev) => prev?.map((m) => (m.id === id ? { ...m, enabled: !enabled } : m)) ?? prev);
      setError(err instanceof Error ? err.message : "Failed to update access.");
    } finally {
      setBusy(null);
    }
  }

  if (error && !members) return <p className="text-sm text-destructive">{error}</p>;
  if (!members) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading staff…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Chrome className="h-4 w-4 text-accent" />
        Grant staff access to the Selection Card Builder extension. Turning it off is an instant kill switch.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="divide-y divide-border">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{m.name}</span>
                <Badge tone={m.enabled ? "success" : "default"}>{m.enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{m.email} · {m.role}</div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={m.enabled}
              aria-label={`Toggle extension access for ${m.name}`}
              disabled={busy === m.id}
              onClick={() => toggle(m.id, !m.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${m.enabled ? "bg-accent" : "bg-muted"} ${busy === m.id ? "opacity-60" : ""}`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${m.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
