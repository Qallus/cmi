"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";

// Self-contained broadcast opt-in/out switch. Works on both surfaces by pointing
// at the matching prefs endpoint (staff: /api/me/notification-prefs, client:
// /api/client/notification-prefs).
export function BroadcastToggle({ endpoint }: { endpoint: string }) {
  const [enabled, setEnabled] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    fetch(endpoint).then((r) => r.json()).then((d: { broadcasts_enabled?: boolean }) => setEnabled(d.broadcasts_enabled ?? true)).catch(() => setEnabled(true));
  }, [endpoint]);

  async function toggle(v: boolean) {
    setEnabled(v);
    await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ broadcasts_enabled: v }) }).catch(() => {});
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent"><Megaphone className="h-4 w-4" /></span>
        <div>
          <div className="text-sm font-medium">Announcements</div>
          <div className="text-xs text-muted-foreground">Get broadcast notifications from the Constructed Matter team.</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled ?? true}
        aria-label="Toggle announcements"
        disabled={enabled === null}
        onClick={() => toggle(!enabled)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${enabled ? "bg-accent" : "bg-muted"}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>
    </div>
  );
}
