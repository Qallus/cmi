"use client";

import * as React from "react";
import {
  Archive, ArchiveRestore, CheckCircle2, Loader2, Mail, MessageSquare,
  Smartphone, Trash2, UserRound, Workflow, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, Select } from "@/components/ui/input";
import { DEAL_STAGE_META, DEAL_STAGES } from "@/lib/deals/stages";
import type { DealStage } from "@/lib/deals/types";

export type OwnerOption = { id: string; name: string };

type Panel = "owner" | "stage" | "next_action" | null;

/**
 * Acts on everything ticked.
 *
 * A floating bar rather than a toolbar row: it only exists while something is
 * selected, and anchoring it to the bottom keeps it reachable however far down
 * the list you have scrolled.
 */
export function BulkBar({
  ids, owners, canWrite, isSuperAdmin, showingArchived, onClear, onDone, onShare,
}: {
  ids: string[];
  owners: OwnerOption[];
  canWrite: boolean;
  isSuperAdmin: boolean;
  showingArchived: boolean;
  onClear: () => void;
  onDone: () => void;
  /** Opens the existing share dialog, which already handles email/SMS/DM. */
  onShare: (channel: "email" | "sms" | "dm") => void;
}) {
  const [panel, setPanel] = React.useState<Panel>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  if (ids.length === 0) return null;
  const n = ids.length;
  const noun = `${n} deal${n === 1 ? "" : "s"}`;

  async function run(action: string, value?: unknown, due?: string | null) {
    setBusy(true);
    try {
      const res = await fetch("/api/deals/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value, due }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      const failed = (json.failed as { id: string; error: string }[]) ?? [];
      // Say what did not work rather than reporting a clean success for a
      // partial one.
      setToast(failed.length
        ? `${json.done} of ${n} updated. ${failed.length} failed: ${failed[0].error}`
        : `${json.done} updated.`);
      setPanel(null);
      onDone();
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
          {panel === "owner" && (
            <Row label="Assign to">
              <Select
                autoFocus className="w-52"
                defaultValue=""
                onChange={(e) => { if (e.target.value) void run("owner", e.target.value === "__none" ? null : e.target.value); }}
              >
                <option value="" disabled>Choose an owner…</option>
                <option value="__none">Unassigned</option>
                {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </Row>
          )}
          {panel === "stage" && (
            <Row label="Move to stage">
              <div className="flex flex-wrap gap-1">
                {DEAL_STAGES.map((st: DealStage) => (
                  <button
                    key={st} type="button" disabled={busy}
                    onClick={() => void run("stage", st)}
                    className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted disabled:opacity-50"
                  >
                    {DEAL_STAGE_META[st]?.label ?? st}
                  </button>
                ))}
              </div>
            </Row>
          )}
          {panel === "next_action" && <NextActionPanel busy={busy} onApply={(text, due) => void run("next_action", text, due)} />}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="px-2 text-sm font-medium">{noun} selected</span>
            <span className="mx-1 h-5 w-px bg-border" />

            {canWrite && (
              <>
                <Action icon={UserRound} label="Owner" active={panel === "owner"} onClick={() => setPanel(panel === "owner" ? null : "owner")} />
                <Action icon={Workflow} label="Stage" active={panel === "stage"} onClick={() => setPanel(panel === "stage" ? null : "stage")} />
                <Action icon={CheckCircle2} label="Next action" active={panel === "next_action"} onClick={() => setPanel(panel === "next_action" ? null : "next_action")} />
                <span className="mx-1 h-5 w-px bg-border" />
              </>
            )}

            <Action icon={Mail} label="Email" onClick={() => onShare("email")} />
            <Action icon={Smartphone} label="SMS" onClick={() => onShare("sms")} />
            <Action icon={MessageSquare} label="Message" onClick={() => onShare("dm")} />

            {canWrite && (
              <>
                <span className="mx-1 h-5 w-px bg-border" />
                {showingArchived ? (
                  <Action icon={ArchiveRestore} label="Restore" disabled={busy} onClick={() => void run("restore")} />
                ) : (
                  <Action
                    icon={Archive} label="Archive" disabled={busy}
                    onClick={() => {
                      if (window.confirm(`Archive ${noun}?\n\nThey leave the active board but keep their notes, tasks and stage history, and can be restored.`)) void run("archive");
                    }}
                  />
                )}
              </>
            )}
            {isSuperAdmin && (
              <Action
                icon={Trash2} label="Delete" danger disabled={busy}
                onClick={() => {
                  if (window.confirm(`Permanently delete ${noun}?\n\nNotes, tasks and stage history go with them and cannot be recovered. Archive instead if you may need them later.`)) void run("delete");
                }}
              />
            )}

            <span className="mx-1 h-5 w-px bg-border" />
            {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <button type="button" onClick={onClear} aria-label="Clear selection" className="rounded p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}

function Action({
  icon: Icon, label, onClick, active, danger, disabled,
}: {
  icon: typeof Mail; label: string; onClick: () => void;
  active?: boolean; danger?: boolean; disabled?: boolean;
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-accent bg-accent/10 text-accent" : "border-border hover:bg-muted",
        danger && "border-destructive/30 text-destructive hover:bg-destructive/10",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-2 pb-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function NextActionPanel({ busy, onApply }: { busy: boolean; onApply: (text: string, due: string | null) => void }) {
  const [text, setText] = React.useState("");
  const [due, setDue] = React.useState("");
  return (
    <Row label="Next action">
      <Input
        autoFocus className="w-64" placeholder="Call to confirm scope"
        value={text} onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) onApply(text.trim(), due || null); }}
      />
      <Input className="w-auto" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
      <button
        type="button" disabled={busy || !text.trim()}
        onClick={() => onApply(text.trim(), due || null)}
        className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        Apply
      </button>
    </Row>
  );
}
