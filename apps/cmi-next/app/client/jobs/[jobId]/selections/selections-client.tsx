"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { ProjectSelection } from "@/lib/selections/types";
import { SelectionCardModal } from "@/components/selections/selection-card-modal";
import { ClientResponse, type ClientAction } from "@/components/selections/client-response";
import { money, humanize } from "../../../portal-ui";
import type { ClientThreadEntry } from "@/lib/selection-comments/data";

const APPROVAL_TONE: Record<string, "default" | "info" | "warning" | "success" | "danger"> = {
  not_required: "default", pending: "warning", approved: "success", rejected: "danger", revision_requested: "danger", approved_with_changes: "success",
};
const APPROVAL_LABEL: Record<string, string> = { pending: "Needs your approval", rejected: "Not approved", revision_requested: "Change requested" };

export function SelectionsClient({ jobId, initial, threads: initialThreads = null }: {
  jobId: string; initial: ProjectSelection[];
  /** Each selection's conversation with the team; null before the comments update (then the old notes show). */
  threads?: Record<string, ClientThreadEntry[]> | null;
}) {
  const [threads, setThreads] = React.useState(initialThreads);
  const [rows, setRows] = React.useState<ProjectSelection[]>(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [viewingId, setViewingId] = React.useState<string | null>(null);
  const viewing = viewingId ? rows.find((r) => r.id === viewingId) ?? null : null;

  // Approve / Not approved / Comment. Resolves true when it saved.
  async function respond(sel: ProjectSelection, action: ClientAction, comment: string): Promise<boolean> {
    setBusy(sel.id);
    setErrors((e) => ({ ...e, [sel.id]: "" }));
    try {
      const res = await fetch(`/api/client/jobs/${jobId}/selections/${sel.id}/decision`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: action, comment: comment || null }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "That didn't save. Please try again.");
      setRows((r) => r.map((x) => (x.id === sel.id ? j : x)));
      setThreads((t) => (t ? { ...t, [sel.id]: [...(t[sel.id] ?? []), { author_kind: "client", author_name: "You", action, body: comment || null, created_at: new Date().toISOString() }] } : t));
      return true;
    } catch (e) {
      setErrors((x) => ({ ...x, [sel.id]: e instanceof Error ? e.message : "That didn't save. Please try again." }));
      return false;
    } finally { setBusy(null); }
  }

  if (rows.length === 0) return <Empty>No selections have been shared yet.</Empty>;

  // Group by room/area.
  const groups = new Map<string, ProjectSelection[]>();
  for (const s of rows) { const k = s.room_area_name || "General"; groups.set(k, [...(groups.get(k) ?? []), s]); }

  return (
    <div className="space-y-8">
      {[...groups.entries()].map(([room, items]) => (
        <div key={room}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">{room}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((s) => (
              <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {s.image_url && (
                  <button type="button" onClick={() => setViewingId(s.id)} className="block h-48 w-full bg-white dark:bg-muted" title="View selection">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={s.image_url} alt={s.name} className="h-full w-full object-contain p-2" />
                  </button>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button type="button" onClick={() => setViewingId(s.id)} className="text-left font-medium hover:text-accent hover:underline">{s.name}</button>
                      <div className="text-xs text-muted-foreground">{[s.category, s.custom_product_name !== s.name ? s.custom_product_name : null].filter(Boolean).join(" · ")}</div>
                    </div>
                    <Badge tone={APPROVAL_TONE[s.approval_status] ?? "default"}>{APPROVAL_LABEL[s.approval_status] ?? humanize(s.approval_status)}</Badge>
                  </div>
                  {s.description && <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-sm">
                    {s.client_price != null && <span>{money(s.client_price)}</span>}
                    {s.allowance_amount != null && <span className="text-muted-foreground">Allowance: {money(s.allowance_amount)}</span>}
                    {s.product_url && <a href={s.product_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">View product</a>}
                  </div>
                  {threads ? <Conversation entries={threads[s.id] ?? []} /> : s.client_comments && (
                    <div className="mt-3 rounded-md bg-muted/50 px-3 py-2 text-xs">
                      <div className="mb-0.5 font-medium">Your notes</div>
                      <p className="whitespace-pre-line text-muted-foreground">{s.client_comments}</p>
                    </div>
                  )}
                  <div className="mt-3">
                    <ClientResponse selection={s} busy={busy === s.id} error={errors[s.id] || null} onSubmit={(action, comment) => respond(s, action, comment)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {viewing && (
        <SelectionCardModal
          selection={viewing}
          onClose={() => setViewingId(null)}
          decision={{ busy: busy === viewing.id, error: errors[viewing.id] || null, onSubmit: (action, comment) => respond(viewing, action, comment) }}
        />
      )}
    </div>
  );
}

const ACTION_WORD: Record<string, string> = { approved: "Approved", rejected: "Not approved", revision_requested: "Asked for a change" };

// Your notes and the team's replies, oldest first.
function Conversation({ entries }: { entries: ClientThreadEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="mt-3 space-y-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs">
      <div className="font-medium">Conversation</div>
      {entries.map((e, i) => (
        <div key={i} className={e.author_kind === "staff" ? "border-l-2 border-accent pl-2" : ""}>
          <div className="text-[11px] text-muted-foreground">
            <span className="font-semibold text-foreground">{e.author_kind === "staff" ? ` · CMI` : "You"}</span>
            {ACTION_WORD[e.action] ? ` · ${ACTION_WORD[e.action]}` : ""} · {new Date(e.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </div>
          {e.body && <p className="whitespace-pre-line break-words text-muted-foreground">{e.body}</p>}
        </div>
      ))}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{children}</div>;
}
