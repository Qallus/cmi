"use client";

// Checkbox quick actions for Pre-Con and Jobs: the same floating bar the
// Pipeline uses (app/dashboard/pipeline/bulk-bar.tsx), pointed at
// /api/pipeline/bulk or /api/jobs/bulk. It only shows while something is
// checked, anchored to the bottom so it stays reachable however far you scroll.
import * as React from "react";
import {
  Archive, ArchiveRestore, CheckCircle2, Loader2, Mail, MessageSquare, Pencil,
  Smartphone, Trash2, Workflow, X,
} from "lucide-react";
import { Action, NextActionPanel, Row } from "@/app/dashboard/pipeline/bulk-bar";
import { ShareDialog } from "@/app/dashboard/pipeline/deal-actions";
import type { RecordTarget } from "@/lib/records-io/fields";

const NOUN: Record<RecordTarget, string> = { precon: "opportunity", jobs: "job" };
const PLURAL: Record<RecordTarget, string> = { precon: "opportunities", jobs: "jobs" };
const ENDPOINT: Record<RecordTarget, string> = { precon: "/api/pipeline/bulk", jobs: "/api/jobs/bulk" };
const SHARE_URL: Record<RecordTarget, (id: string) => string> = {
  precon: (id) => `/api/pipeline/${id}/share`,
  jobs: (id) => `/api/jobs/${id}/share`,
};

export function QuickActionBar({
  target, ids, stages, canWrite, canDelete, showingArchived, onEdit, onClear, onDone,
}: {
  target: RecordTarget;
  ids: string[];
  stages: { value: string; label: string }[];
  canWrite: boolean;
  canDelete: boolean;
  showingArchived: boolean;
  /** Opens the edit form for a single checked record. */
  onEdit: (id: string) => void;
  onClear: () => void;
  onDone: () => void;
}) {
  const [panel, setPanel] = React.useState<"stage" | "next_action" | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const [share, setShare] = React.useState<"email" | "sms" | "dm" | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  if (ids.length === 0 && !toast) return null;
  const n = ids.length;
  const label = `${n} ${n === 1 ? NOUN[target] : PLURAL[target]}`;
  const stageWord = target === "jobs" ? "Status" : "Stage";

  async function run(action: string, value?: unknown, due?: string | null) {
    setBusy(true);
    try {
      const res = await fetch(ENDPOINT[target], {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value, due }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      const failed = (json.failed as { id: string; error: string }[]) ?? [];
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
      {n > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-full flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
            {panel === "stage" && (
              <Row label={`Move to ${stageWord.toLowerCase()}`}>
                <div className="flex flex-wrap gap-1">
                  {stages.map((st) => (
                    <button
                      key={st.value} type="button" disabled={busy}
                      onClick={() => void run("stage", st.value)}
                      className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted disabled:opacity-50"
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </Row>
            )}
            {panel === "next_action" && <NextActionPanel busy={busy} onApply={(text, due) => void run("next_action", text, due)} />}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-2 text-sm font-medium">{label} selected</span>
              <span className="mx-1 h-5 w-px bg-border" />

              {canWrite && (
                <>
                  <Action icon={Workflow} label={stageWord} active={panel === "stage"} onClick={() => setPanel(panel === "stage" ? null : "stage")} />
                  <Action icon={CheckCircle2} label="Next action" active={panel === "next_action"} onClick={() => setPanel(panel === "next_action" ? null : "next_action")} />
                  <span className="mx-1 h-5 w-px bg-border" />
                </>
              )}

              <Action icon={Mail} label="Email" onClick={() => setShare("email")} />
              <Action icon={Smartphone} label="SMS" onClick={() => setShare("sms")} />
              <Action icon={MessageSquare} label="Message" onClick={() => setShare("dm")} />

              {canWrite && (
                <>
                  <span className="mx-1 h-5 w-px bg-border" />
                  {showingArchived ? (
                    <Action icon={ArchiveRestore} label="Restore" disabled={busy} onClick={() => void run("restore")} />
                  ) : (
                    <Action
                      icon={Archive} label="Archive" disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Archive ${label}?\n\nThey leave the list but keep all their details, and can be restored from "Show archived".`)) void run("archive");
                      }}
                    />
                  )}
                  <Action
                    icon={Pencil} label="Edit" disabled={n !== 1}
                    onClick={() => onEdit(ids[0])}
                  />
                </>
              )}
              {canDelete && (
                <Action
                  icon={Trash2} label="Delete" danger disabled={busy}
                  onClick={() => {
                    const extra = target === "jobs"
                      ? "Its logs, files, invoices, schedules and client links go with it"
                      : "Its stage history goes with it";
                    if (window.confirm(`Permanently delete ${label}?\n\n${extra} and cannot be recovered. Archive instead if you may need it later.`)) void run("delete");
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
      )}

      {share && (
        <ShareDialog
          ids={ids}
          name={label}
          channel={share}
          noun={{ one: NOUN[target], many: PLURAL[target] }}
          shareUrl={SHARE_URL[target]}
          blurb={`Sends a summary and a link to each ${NOUN[target]}. These hold client and budget details, so only internal staff can receive them.`}
          onClose={() => setShare(null)}
          onDone={(msg) => { setShare(null); setToast(msg); }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-24 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}
