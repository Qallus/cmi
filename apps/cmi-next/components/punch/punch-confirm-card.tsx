"use client";

// The confirmation card Bolt shows after "add a punch list to …": the record,
// the list, and every item. Untick anything misheard, then Save — nothing is
// written until then. Used by the Agent page and the Bolt pop-up.
import * as React from "react";
import Link from "next/link";
import { Check, ClipboardCheck, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PendingAction } from "@/lib/agent/types";
import { PARENT_LABEL } from "@/lib/punch/types";

function hrefFor(type: string, id: string) {
  if (type === "job") return `/dashboard/jobs/${id}/punch-list`;
  if (type === "precon") return `/dashboard/sales/${id}?tab=punch`;
  return `/dashboard/pipeline/${id}`;
}

export function PunchConfirmCard({ action }: { action: PendingAction }) {
  const p = action.punch;
  const [keep, setKeep] = React.useState<boolean[]>(() => (p?.items ?? []).map(() => true));
  const [state, setState] = React.useState<"idle" | "running" | "done" | "dismissed" | "error">("idle");
  const [note, setNote] = React.useState("");
  if (!p) return null;

  const chosen = p.items.filter((_, i) => keep[i]);
  async function save() {
    setState("running");
    try {
      const res = await fetch("/api/agent/execute", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: { ...action, punch: { ...p!, items: chosen } } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.error) throw new Error(json.error ?? "Couldn't save the punch list.");
      setState("done");
      setNote(`Saved ${chosen.length} item${chosen.length === 1 ? "" : "s"}.`);
    } catch (e) {
      setState("error");
      setNote((e as Error).message);
    }
  }

  return (
    <div className="rounded-lg border border-accent/40 bg-accent/5 p-3">
      <div className="flex items-start gap-2 text-sm font-medium">
        <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
        <span>
          {p.list_id ? "Add to" : "New"} punch list “{p.list_title}”
          <span className="block text-xs font-normal text-muted-foreground">{PARENT_LABEL[p.parent_type]} · {p.parent_label}{p.client_visible ? " · visible to client" : ""}</span>
        </span>
      </div>
      <ul className="mt-2 space-y-1 rounded-md border border-border bg-card p-2">
        {p.items.map((item, i) => (
          <li key={i}>
            <label className={cn("flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm", !keep[i] && "opacity-50")}>
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={keep[i]} disabled={state === "running" || state === "done"}
                onChange={(e) => setKeep((k) => k.map((v, j) => (j === i ? e.target.checked : v)))} />
              <span className="min-w-0">
                {item.title}
                {(item.location || item.trade || (item.priority && item.priority !== "normal")) && (
                  <span className="block text-[11px] text-muted-foreground">{[item.location, item.trade, item.priority !== "normal" ? item.priority : null].filter(Boolean).join(" · ")}</span>
                )}
              </span>
            </label>
          </li>
        ))}
      </ul>
      {state === "done" ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <Check className="h-3.5 w-3.5" /> {note} <Link href={hrefFor(p.parent_type, p.parent_id)} className="font-medium text-accent hover:underline">Open list →</Link>
        </div>
      ) : state === "dismissed" ? (
        <div className="mt-2 text-xs text-muted-foreground">Dismissed — nothing was saved.</div>
      ) : (
        <>
          {state === "error" && <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive"><X className="h-3.5 w-3.5" />{note}</div>}
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="accent" disabled={state === "running" || !chosen.length} onClick={() => void save()}>
              {state === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save {chosen.length} item{chosen.length === 1 ? "" : "s"}
            </Button>
            <Button size="sm" variant="outline" disabled={state === "running"} onClick={() => setState("dismissed")}>Dismiss</Button>
          </div>
        </>
      )}
    </div>
  );
}
