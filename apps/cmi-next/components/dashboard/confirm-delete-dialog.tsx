"use client";

import * as React from "react";
import { AlertTriangle, Archive, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Verified hard-delete dialog. Deleting is permanent; Archive is offered as the
 * safer alternative that removes the item from the lists without destroying it.
 */
export function ConfirmDeleteDialog({
  itemName = "this request",
  onConfirm,
  onArchive,
  onCancel,
}: {
  itemName?: string;
  onConfirm: () => void | Promise<void>;
  onArchive?: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = React.useState<null | "delete" | "archive">(null);

  async function run(kind: "delete" | "archive", fn: () => void | Promise<void>) {
    setBusy(kind);
    try { await fn(); } finally { setBusy(null); }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => busy || onCancel()} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold">Delete {itemName}?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This permanently deletes {itemName} and everything attached to it (notes, replies, screenshots). <strong className="text-foreground">This can&apos;t be undone.</strong>
            </p>
            {onArchive && (
              <p className="mt-2 rounded-md bg-muted/60 px-3 py-2 text-[13px] text-muted-foreground">
                Prefer to keep a record? <strong className="text-foreground">Archive</strong> instead — it removes the item from your lists but keeps the data.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={busy !== null}>Cancel</Button>
          {onArchive && (
            <Button size="sm" variant="outline" onClick={() => void run("archive", onArchive)} disabled={busy !== null}>
              {busy === "archive" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />} Archive instead
            </Button>
          )}
          <Button size="sm" variant="destructive" onClick={() => void run("delete", onConfirm)} disabled={busy !== null}>
            {busy === "delete" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Confirm delete
          </Button>
        </div>
      </div>
    </div>
  );
}
