"use client";

import * as React from "react";
import Link from "next/link";
import type { ClientNotification } from "@/lib/client-portal/notifications";

function ago(iso: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

export function NotificationsClient({ initial }: { initial: ClientNotification[] }) {
  const [rows, setRows] = React.useState<ClientNotification[]>(initial);

  // Mark everything read when the client opens this page.
  React.useEffect(() => {
    if (initial.some((n) => !n.read_at)) {
      fetch("/api/client/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-semibold tracking-tight">Notifications</h1>
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">You&apos;re all caught up.</div>
      ) : (
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((n) => {
            const inner = (
              <div className={`flex items-start gap-3 px-4 py-3 ${!n.read_at ? "bg-accent/5" : ""}`}>
                {!n.read_at && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" />}
                <div className={n.read_at ? "pl-5" : ""}>
                  <div className="text-sm font-medium">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{ago(n.created_at)}</div>
                </div>
              </div>
            );
            return n.link ? <Link key={n.id} href={n.link} className="block transition hover:bg-muted/30">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
