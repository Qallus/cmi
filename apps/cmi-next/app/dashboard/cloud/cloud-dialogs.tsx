"use client";

import * as React from "react";
import { AlertTriangle, FolderPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Centered, brand-styled modal shell. Colours come from theme tokens, so it
// follows light and dark mode. Replaces window.prompt / window.confirm.
export function Modal({ title, icon: Icon, onClose, children, footer, width = "max-w-md" }: {
  title: string;
  icon?: typeof FolderPlus;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title}
        className={cn("relative z-10 flex w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xl", width)}>
        <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 font-semibold">
            {Icon && <Icon className="h-4 w-4 text-accent" />}{title}
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// Single-field prompt (new folder, rename).
export function PromptDialog({ title, label, initial = "", placeholder, submitLabel = "Save", icon, onSubmit, onClose }: {
  title: string;
  label: string;
  initial?: string;
  placeholder?: string;
  submitLabel?: string;
  icon?: typeof FolderPlus;
  onSubmit: (value: string) => void | Promise<void>;
  onClose: () => void;
}) {
  const [value, setValue] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    const v = value.trim();
    if (!v || busy) return;
    setBusy(true);
    try { await onSubmit(v); } finally { setBusy(false); }
  }

  return (
    <Modal title={title} icon={icon} onClose={onClose}
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" disabled={!value.trim() || busy} onClick={() => void submit()}>{busy ? "Saving…" : submitLabel}</Button>
      </>}>
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Input autoFocus value={value} placeholder={placeholder} onChange={(e) => setValue(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} />
      </label>
    </Modal>
  );
}

// Destructive confirmation (delete forever, empty trash…).
export function ConfirmDialog({ title, message, confirmLabel = "Delete", onConfirm, onClose }: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  return (
    <Modal title={title} icon={AlertTriangle} onClose={onClose}
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="destructive" disabled={busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>
          {busy ? "Working…" : confirmLabel}
        </Button>
      </>}>
      <div className="text-sm text-muted-foreground">{message}</div>
    </Modal>
  );
}

// Pick a destination folder for "Move to…".
export function MoveDialog({ folders, currentFolderId, count, onMove, onClose }: {
  folders: { id: string; name: string }[];
  currentFolderId: string | null;
  count: number;
  onMove: (folderId: string | null) => void | Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const go = async (id: string | null) => { setBusy(true); try { await onMove(id); } finally { setBusy(false); } };
  return (
    <Modal title={`Move ${count} item${count === 1 ? "" : "s"}`} icon={FolderPlus} onClose={onClose}>
      <div className="space-y-1">
        <button type="button" disabled={busy || currentFolderId === null} onClick={() => void go(null)}
          className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40">
          <FolderPlus className="h-4 w-4 text-muted-foreground" /> Top level
        </button>
        {folders.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">No folders here yet. Create one first.</p>
        ) : folders.map((f) => (
          <button key={f.id} type="button" disabled={busy || f.id === currentFolderId} onClick={() => void go(f.id)}
            className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40">
            <FolderPlus className="h-4 w-4 text-muted-foreground" /> <span className="truncate">{f.name}</span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
