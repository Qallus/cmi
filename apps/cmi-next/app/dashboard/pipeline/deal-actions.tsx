"use client";

import * as React from "react";
import {
  Archive, ArchiveRestore, Copy, ExternalLink, Link2, Mail, MessageSquare,
  MoreHorizontal, Send, Smartphone, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Deal } from "@/lib/deals/types";
import type { ShareChannel, ShareRecipient } from "@/lib/deals/notify";

export type DealActionRow = Pick<Deal, "id" | "title" | "job_number" | "archived_at">;

type Handlers = {
  canWrite: boolean;
  isSuperAdmin: boolean;
  onChanged: () => void;            // data changed; refresh the views
  onRemoved?: () => void;           // archived / deleted; close any open panel
  onOpen?: (id: string) => void;    // open a deal (used after Duplicate)
};

const label = (row: DealActionRow) => [row.job_number, row.title].filter(Boolean).join("_");

/**
 * Quick actions for a deal — the same set everywhere: every Pipeline view's ⋯
 * menu and the deal page's toolbar. Mirrors ProjectionActions so the two
 * modules behave identically.
 */
export function DealActions({ row, variant, ...h }: { row: DealActionRow; variant: "bar" | "menu" } & Handlers) {
  const [channel, setChannel] = React.useState<ShareChannel | null>(null);
  // Fixed to the viewport so a scrolling table or kanban column can't clip it.
  const [menuAt, setMenuAt] = React.useState<{ top: number; left: number } | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuOpen = menuAt !== null;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

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
    const width = 176, height = 8 * 34 + 8;
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

  async function duplicate() {
    const json = await call(`/api/deals/${row.id}/duplicate`, { method: "POST" });
    if (json?.id) { h.onChanged(); setToast("Duplicated."); h.onOpen?.(String(json.id)); }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard/pipeline/${row.id}`);
      setToast("Link copied — only Pipeline staff can open it.");
    } catch {
      setToast("Couldn't copy the link.");
    }
  }

  async function archive() {
    if (!window.confirm(`Archive “${label(row)}”? It leaves the active pipeline but keeps its notes, tasks and stage history, and can be restored.`)) return;
    if (await call(`/api/deals/${row.id}/archive`, { method: "POST" })) { h.onChanged(); h.onRemoved?.(); setToast("Archived."); }
  }

  async function restore() {
    if (await call(`/api/deals/${row.id}/archive`, { method: "DELETE" })) { h.onChanged(); setToast("Restored to the pipeline."); }
  }

  async function destroy() {
    if (!window.confirm(`Permanently delete “${label(row)}”?\n\nIts notes, tasks and stage history go with it and can't be restored. Archive instead if you may need it later.`)) return;
    if (await call(`/api/deals/${row.id}`, { method: "DELETE" })) { h.onChanged(); h.onRemoved?.(); setToast("Deleted."); }
  }

  const archived = !!row.archived_at;
  const items: { key: string; label: string; icon: typeof Copy; run: () => void; danger?: boolean; hidden?: boolean }[] = [
    { key: "open", label: "Open", icon: ExternalLink, run: () => h.onOpen?.(row.id), hidden: !h.onOpen },
    { key: "share", label: "Copy link", icon: Link2, run: () => void copyLink() },
    { key: "email", label: "Email", icon: Mail, run: () => setChannel("email") },
    { key: "sms", label: "SMS", icon: Smartphone, run: () => setChannel("sms") },
    { key: "dm", label: "Message", icon: MessageSquare, run: () => setChannel("dm") },
    { key: "duplicate", label: "Duplicate", icon: Copy, run: () => void duplicate(), hidden: !h.canWrite },
    archived
      ? { key: "restore", label: "Restore", icon: ArchiveRestore, run: () => void restore(), hidden: !h.canWrite }
      : { key: "archive", label: "Archive", icon: Archive, run: () => void archive(), hidden: !h.canWrite },
    { key: "delete", label: "Delete", icon: Trash2, run: () => void destroy(), danger: true, hidden: !h.isSuperAdmin },
  ];
  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      {variant === "bar" ? (
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Deal actions">
          {visible.map((i) => (
            <button
              key={i.key} type="button" disabled={busy} title={i.label} onClick={i.run}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                i.danger && "border-destructive/30 text-destructive hover:bg-destructive/10",
              )}
            >
              <i.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{i.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div ref={menuRef} className="relative" onClick={(e) => { e.stopPropagation(); }}>
          <button
            type="button" aria-label={`Actions for ${label(row)}`} aria-haspopup="menu" aria-expanded={menuOpen}
            onClick={toggleMenu}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuAt && (
            <div role="menu" style={{ top: menuAt.top, left: menuAt.left }} className="fixed z-[65] w-44 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
              {visible.map((i) => (
                <button
                  key={i.key} type="button" role="menuitem" disabled={busy}
                  onClick={() => { setMenuAt(null); i.run(); }}
                  className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40", i.danger && "text-destructive")}
                >
                  <i.icon className="h-3.5 w-3.5" /> {i.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {channel && (
        <ShareDialog
          id={row.id} name={label(row)} channel={channel}
          onClose={() => setChannel(null)}
          onDone={(msg) => { setChannel(null); setToast(msg); h.onChanged(); }}
        />
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}

const CHANNEL_LABEL: Record<ShareChannel, string> = { email: "Email", sms: "SMS", dm: "Message" };

function ShareDialog({
  id, name, channel, onClose, onDone,
}: {
  id: string; name: string; channel: ShareChannel; onClose: () => void; onDone: (msg: string) => void;
}) {
  const [data, setData] = React.useState<{ me: string; recipients: ShareRecipient[] } | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/deals/recipients")
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); })
      .catch((e) => setError((e as Error).message || "Could not load recipients."));
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const usable = (r: ShareRecipient) => (channel === "email" ? !!r.email : channel === "sms" ? r.has_phone : r.id !== data?.me);
  const why = (r: ShareRecipient) => (channel === "email" ? "no email" : channel === "sms" ? "no phone" : "you");

  async function send() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/deals/${id}/share`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, recipient_ids: [...picked], note }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not send."); setBusy(false); return; }
    const sent = (json.sent as string[]) ?? [];
    const skipped = (json.skipped as { name: string; reason: string }[]) ?? [];
    onDone(`${CHANNEL_LABEL[channel]} sent to ${sent.length ? sent.join(", ") : "no one"}${skipped.length ? `; skipped ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : ""}.`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`${CHANNEL_LABEL[channel]} ${name}`} className="relative z-10 flex max-h-[85vh] w-full max-w-[32rem] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="truncate font-semibold">{CHANNEL_LABEL[channel]} “{name}”</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <p className="mb-3 text-xs text-muted-foreground">
            Sends a summary and a link to the deal. Deals hold client and budget details, so only staff who can open the Pipeline can receive them.
          </p>
          {error && <div role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
          {!data ? (
            !error && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <div className="space-y-1">
              {data.recipients.map((r) => {
                const ok = usable(r);
                return (
                  <label key={r.id} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm", ok ? "cursor-pointer hover:bg-muted/50" : "opacity-50")}>
                    <input
                      type="checkbox" disabled={!ok} checked={picked.has(r.id)}
                      onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })}
                    />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{ok ? r.role.replace(/_/g, " ") : why(r)}</span>
                  </label>
                );
              })}
            </div>
          )}
          <label className="mt-3 block space-y-1 text-xs">
            <span className="font-medium">Note (optional)</span>
            <textarea
              value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="accent" disabled={busy || picked.size === 0} onClick={() => void send()}>
            <Send className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </div>
  );
}
