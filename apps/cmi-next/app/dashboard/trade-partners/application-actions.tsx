"use client";

import * as React from "react";
import {
  Archive, ArchiveRestore, ExternalLink, Link2, Loader2, Mail,
  MoreHorizontal, Smartphone, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ApplicationActionRow = {
  id: string;
  token: string;
  label: string;
  contact_email: string | null;
  contact_phone: string | null;
  archived_at: string | null;
};

type Handlers = {
  isSuperAdmin: boolean;
  onChanged: () => void;         // list needs refreshing
  onRemoved?: () => void;        // archived or deleted; close any open drawer
  onOpen?: (id: string) => void; // open the review drawer
};

type Channel = "email" | "sms";

/**
 * Row actions for an application — the ⋯ menu in the queue.
 *
 * Share/email/SMS all send the applicant the link back to their own draft,
 * which is the only thing worth sending them. That's different from the
 * Pipeline's share, which circulates a deal among staff.
 */
export function ApplicationActions({ row, ...h }: { row: ApplicationActionRow } & Handlers) {
  const [menuAt, setMenuAt] = React.useState<{ top: number; left: number } | null>(null);
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuOpen = menuAt !== null;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fixed to the viewport, so a scrolling table can't clip the menu.
  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuAt(null); };
    const dismiss = () => setMenuAt(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [menuOpen]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (menuAt) { setMenuAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const width = 184, height = 6 * 34 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
    setMenuAt({ top, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) });
  }

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Something went wrong.");
      return json as Record<string, unknown>;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/prequalification?t=${encodeURIComponent(row.token)}`);
      setToast("Link copied. It reopens this applicant's own answers — treat it like a password.");
    } catch {
      setToast("Couldn't copy the link.");
    }
  }

  async function archive() {
    if (!window.confirm(`Archive “${row.label}”?\n\nIt leaves the queue but keeps every answer and document, and can be restored.`)) return;
    if (await call(`/api/trade-partners/applications/${row.id}/archive`, { method: "POST" })) {
      h.onChanged(); h.onRemoved?.(); setToast("Archived.");
    }
  }

  async function restore() {
    if (await call(`/api/trade-partners/applications/${row.id}/archive`, { method: "DELETE" })) {
      h.onChanged(); setToast("Back in the queue.");
    }
  }

  async function destroy() {
    if (!window.confirm(`Permanently delete “${row.label}”?\n\nThe answers and any uploaded insurance or licence files go with it and can't be recovered. Archive instead if you may need it later.`)) return;
    const json = await call(`/api/trade-partners/applications/${row.id}`, { method: "DELETE" });
    if (json) {
      h.onChanged(); h.onRemoved?.();
      const n = Number(json.documents_removed ?? 0);
      setToast(`Deleted${n ? `, with ${n} document${n === 1 ? "" : "s"}` : ""}.`);
    }
  }

  const archived = !!row.archived_at;
  const items: { key: string; label: string; icon: typeof Mail; run: () => void; danger?: boolean; hidden?: boolean; disabled?: boolean }[] = [
    { key: "open", label: "Open", icon: ExternalLink, run: () => h.onOpen?.(row.id), hidden: !h.onOpen },
    { key: "share", label: "Copy link", icon: Link2, run: () => void copyLink() },
    { key: "email", label: "Email applicant", icon: Mail, run: () => setChannel("email"), disabled: !row.contact_email },
    { key: "sms", label: "Text applicant", icon: Smartphone, run: () => setChannel("sms"), disabled: !row.contact_phone },
    archived
      ? { key: "restore", label: "Restore", icon: ArchiveRestore, run: () => void restore() }
      : { key: "archive", label: "Archive", icon: Archive, run: () => void archive() },
    { key: "delete", label: "Delete", icon: Trash2, run: () => void destroy(), danger: true, hidden: !h.isSuperAdmin },
  ];
  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button" aria-label={`Actions for ${row.label}`} aria-haspopup="menu" aria-expanded={menuOpen}
          onClick={toggleMenu}
          className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuAt && (
          <div role="menu" style={{ top: menuAt.top, left: menuAt.left }} className="fixed z-[65] w-46 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
            {visible.map((i) => (
              <button
                key={i.key} type="button" role="menuitem" disabled={busy || i.disabled}
                title={i.disabled ? `No ${i.key === "email" ? "email address" : "phone number"} on this application` : undefined}
                onClick={() => { setMenuAt(null); i.run(); }}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                  i.danger && "text-destructive",
                )}
              >
                <i.icon className="h-3.5 w-3.5" /> {i.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {channel && (
        <SendDialog
          row={row} channel={channel}
          onClose={() => setChannel(null)}
          onDone={(msg) => { setChannel(null); setToast(msg); h.onChanged(); }}
        />
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}

function SendDialog({
  row, channel, onClose, onDone,
}: {
  row: ApplicationActionRow; channel: Channel; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const to = channel === "sms" ? row.contact_phone : row.contact_email;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function send() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/trade-partners/applications/${row.id}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, note }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not send."); setBusy(false); return; }
    onDone(`${channel === "sms" ? "Text" : "Email"} sent to ${json.to}.`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Send to ${row.label}`} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="truncate font-semibold">{channel === "sms" ? "Text" : "Email"} {row.label}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 p-5">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sends <span className="font-medium text-foreground">{to}</span> the link back to their own application,
            so they can pick it up where they left off. Opt-outs are honoured — if they&apos;ve replied STOP or
            unsubscribed, this won&apos;t send.
          </p>
          {error && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          <label className="block space-y-1 text-xs">
            <span className="font-medium">Note (optional)</span>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
              placeholder="We still need your current COI before we can add you to the bid list."
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none transition focus:border-accent"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted">Cancel</button>
          <button
            type="button" disabled={busy} onClick={() => void send()}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Send {channel === "sms" ? "text" : "email"}
          </button>
        </div>
      </div>
    </div>
  );
}
