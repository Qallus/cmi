"use client";

import * as React from "react";
import {
  Archive, Copy, Link2, Mail, MessageSquare, MoreHorizontal, Pencil, Plug, Send, Smartphone, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectionRow } from "@/lib/projections/types";
import type { ConnectKind, ConnectTarget } from "@/lib/projections/data";
import type { ShareChannel, ShareRecipient } from "@/lib/projections/notify";

type ActionRow = Pick<ProjectionRow, "id" | "name" | "job_id" | "links">;
type Handlers = {
  isSuperAdmin: boolean;
  onChanged: () => void;              // data changed; refresh views
  onRemoved: () => void;              // archived / deleted
  onOpen?: (id: string) => void;      // open another projection (duplicate)
  onEdit?: () => void;                // switch to the editor
};

type Dialog = null | { kind: "connect" } | { kind: "share"; channel: ShareChannel };

// "Quick Features" for a projection — the same actions everywhere (Quick View,
// expanded view, full page, and the ⋯ menu on list / table / card items).
export function ProjectionActions({ row, variant, ...h }: { row: ActionRow; variant: "bar" | "menu" } & Handlers) {
  const [dialog, setDialog] = React.useState<Dialog>(null);
  // Menu position is fixed to the viewport so scrolling tables can't clip it.
  const [menuAt, setMenuAt] = React.useState<{ top: number; left: number } | null>(null);
  const menuOpen = menuAt !== null;
  const setMenuOpen = (open: boolean) => setMenuAt(open ? menuAt : null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

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
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("scroll", dismiss, true); window.removeEventListener("resize", dismiss); };
  }, [menuOpen]);

  function toggleMenu(e: React.MouseEvent<HTMLButtonElement>) {
    if (menuAt) { setMenuAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const width = 176, height = 9 * 34 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
    setMenuAt({ top, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) });
  }

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      return json;
    } catch (e) {
      setToast((e as Error).message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function duplicate() {
    const json = await call(`/api/projections/${row.id}/duplicate`, { method: "POST" });
    if (json?.id) { h.onChanged(); setToast("Duplicated."); h.onOpen?.(String(json.id)); }
  }
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/dashboard/projections/${row.id}`);
      setToast("Link copied — only Admins can open it.");
    } catch {
      setToast("Couldn't copy the link.");
    }
  }
  async function archive() {
    if (!window.confirm(`Archive “${row.name}”? It leaves Projections; adding it again restores its forecast history. The job or deal isn't changed.`)) return;
    if (await call(`/api/projections/${row.id}`, { method: "DELETE" })) { h.onChanged(); h.onRemoved(); }
  }
  async function destroy() {
    if (!window.confirm(`Permanently delete “${row.name}”?\n\nIts forecast months, billing entries and history are removed and can't be restored. The job or deal isn't changed.`)) return;
    if (await call(`/api/projections/${row.id}?permanent=1`, { method: "DELETE" })) { h.onChanged(); h.onRemoved(); }
  }

  const duplicateDisabled = !!row.job_id;
  const items: { key: string; label: string; icon: typeof Pencil; run: () => void; disabled?: boolean; title?: string; danger?: boolean; hidden?: boolean }[] = [
    { key: "edit", label: "Edit", icon: Pencil, run: () => h.onEdit?.(), hidden: !h.onEdit },
    { key: "connect", label: "Connect", icon: Plug, run: () => setDialog({ kind: "connect" }) },
    { key: "duplicate", label: "Duplicate", icon: Copy, run: () => void duplicate(), disabled: duplicateDisabled, title: duplicateDisabled ? "A job has one projection — duplicate anticipated projects only" : undefined },
    { key: "share", label: "Share", icon: Link2, run: () => void copyLink() },
    { key: "email", label: "Email", icon: Mail, run: () => setDialog({ kind: "share", channel: "email" }) },
    { key: "sms", label: "SMS", icon: Smartphone, run: () => setDialog({ kind: "share", channel: "sms" }) },
    { key: "dm", label: "Message", icon: MessageSquare, run: () => setDialog({ kind: "share", channel: "dm" }) },
    { key: "archive", label: "Archive", icon: Archive, run: () => void archive() },
    { key: "delete", label: "Delete", icon: Trash2, run: () => void destroy(), danger: true, hidden: !h.isSuperAdmin },
  ];
  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      {variant === "bar" ? (
        <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Projection actions">
          {visible.map((i) => (
            <button key={i.key} type="button" disabled={busy || i.disabled} title={i.title ?? i.label} onClick={i.run}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-medium transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
                i.danger && "border-destructive/30 text-destructive hover:bg-destructive/10")}>
              <i.icon className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{i.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label={`Actions for ${row.name}`} aria-haspopup="menu" aria-expanded={menuOpen} onClick={toggleMenu}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"><MoreHorizontal className="h-4 w-4" /></button>
          {menuAt && (
            <div role="menu" style={{ top: menuAt.top, left: menuAt.left }} className="fixed z-[65] w-44 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
              {visible.map((i) => (
                <button key={i.key} type="button" role="menuitem" disabled={busy || i.disabled} title={i.title}
                  onClick={() => { setMenuOpen(false); i.run(); }}
                  className={cn("flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40", i.danger && "text-destructive")}>
                  <i.icon className="h-3.5 w-3.5" /> {i.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {dialog?.kind === "connect" && (
        <ConnectDialog row={row} onClose={() => setDialog(null)} onDone={(msg) => { setDialog(null); setToast(msg); h.onChanged(); }} />
      )}
      {dialog?.kind === "share" && (
        <ShareDialog id={row.id} name={row.name} channel={dialog.channel} onClose={() => setDialog(null)} onDone={(msg) => { setDialog(null); setToast(msg); h.onChanged(); }} />
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}

function DialogShell({ title, onClose, children, footer }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative z-10 flex max-h-[85vh] w-full max-w-[32rem] flex-col rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="font-semibold">{title}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

const CONNECT_TABS: { key: string; label: string; kind: ConnectKind; future?: boolean }[] = [
  { key: "job", label: "Job", kind: "job" },
  { key: "deal", label: "Pipeline", kind: "deal", future: false },
  { key: "opportunity", label: "Pre-Con", kind: "opportunity" },
  { key: "future", label: "Future Deal", kind: "deal", future: true },
];

function ConnectDialog({ row, onClose, onDone }: { row: ActionRow; onClose: () => void; onDone: (msg: string) => void }) {
  const [tab, setTab] = React.useState(CONNECT_TABS[0]);
  const [targets, setTargets] = React.useState<ConnectTarget[] | null>(null);
  const [q, setQ] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    fetch(`/api/projections/connect-targets?kind=${tab.kind}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error ?? "Could not load."); return j as ConnectTarget[]; })
      .then((t) => { if (alive) setTargets(t); })
      .catch((e) => { if (alive) { setTargets([]); setError((e as Error).message); } });
    return () => { alive = false; };
  }, [tab]);

  const current = tab.kind === "job" ? row.links.job : tab.kind === "deal" ? row.links.deal : row.links.opportunity;
  const list = (targets ?? [])
    .filter((t) => tab.kind !== "deal" || !!t.future === !!tab.future)
    .filter((t) => !q || `${t.label} ${t.sub}`.toLowerCase().includes(q.toLowerCase()));

  async function run(init: RequestInit, url: string, msg: string) {
    setBusy(true); setError(null);
    const res = await fetch(url, init);
    const json = await res.json().catch(() => ({}));
    if (res.ok) onDone(msg); else { setError(json.error ?? "Could not update."); setBusy(false); }
  }

  return (
    <DialogShell title={`Connect “${row.name}”`} onClose={onClose}>
      <div className="mb-3 flex overflow-hidden rounded-md border border-border text-xs">
        {CONNECT_TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => { if (t.key !== tab.key) { setTab(t); setTargets(null); setQ(""); } }}
            className={cn("flex-1 px-2 py-1.5 font-medium", tab.key === t.key ? "bg-accent/15 text-accent" : "text-muted-foreground hover:text-foreground")}>{t.label}</button>
        ))}
      </div>
      {error && <div role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {current && (tab.kind !== "deal" || !!tab.future === ["new_working", "contacted"].includes((current as { stage?: string }).stage ?? "")) && (
        <div className="mb-3 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
          <span>Connected: <span className="font-medium">{current.label}</span></span>
          <button type="button" disabled={busy} className="text-destructive hover:underline"
            onClick={() => void run({ method: "DELETE" }, `/api/projections/${row.id}/connect?kind=${tab.kind}`, "Disconnected.")}>Disconnect</button>
        </div>
      )}
      {tab.kind === "job" && <p className="mb-2 text-[11px] text-muted-foreground">Connecting a job hands revenue and status to the job, like Promote to Job.</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" aria-label="Search"
        className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-accent" />
      {targets === null ? (
        <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs text-muted-foreground">Nothing to connect here.</div>
      ) : (
        <div className="space-y-1">
          {list.map((t) => {
            const isCurrent = current?.id === t.id;
            return (
              <button key={t.id} type="button" disabled={busy || t.taken || isCurrent}
                onClick={() => void run({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: tab.kind, target_id: t.id }) }, `/api/projections/${row.id}/connect`, `Connected to ${t.label}.`)}
                className="flex w-full items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{t.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{t.sub}</span>
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{isCurrent ? "Connected" : t.taken ? "In Projections" : "Connect"}</span>
              </button>
            );
          })}
        </div>
      )}
    </DialogShell>
  );
}

const CHANNEL_LABEL: Record<ShareChannel, string> = { email: "Email", sms: "SMS", dm: "Message" };

function ShareDialog({ id, name, channel, onClose, onDone }: { id: string; name: string; channel: ShareChannel; onClose: () => void; onDone: (msg: string) => void }) {
  const [data, setData] = React.useState<{ me: string; recipients: ShareRecipient[] } | null>(null);
  const [picked, setPicked] = React.useState<Set<string>>(new Set());
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch("/api/projections/recipients").then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); setData(j); }).catch((e) => setError((e as Error).message || "Could not load recipients."));
  }, []);

  const usable = (r: ShareRecipient) => (channel === "email" ? !!r.email : channel === "sms" ? r.has_phone : r.id !== data?.me);
  const why = (r: ShareRecipient) => (channel === "email" ? "no email" : channel === "sms" ? "no phone" : "you");

  async function send() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/projections/${id}/share`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel, recipient_ids: [...picked], note }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not send."); setBusy(false); return; }
    const sent = (json.sent as string[]) ?? [];
    const skipped = (json.skipped as { name: string; reason: string }[]) ?? [];
    onDone(`${CHANNEL_LABEL[channel]} sent to ${sent.length ? sent.join(", ") : "no one"}${skipped.length ? `; skipped ${skipped.map((s) => `${s.name} (${s.reason})`).join(", ")}` : ""}.`);
  }

  return (
    <DialogShell title={`${CHANNEL_LABEL[channel]} “${name}”`} onClose={onClose}
      footer={<>
        <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
        <Button size="sm" variant="accent" disabled={busy || picked.size === 0} onClick={() => void send()}><Send className="h-3.5 w-3.5" /> {busy ? "Sending…" : "Send"}</Button>
      </>}>
      <p className="mb-3 text-xs text-muted-foreground">Sends a summary and a link. Projections hold revenue figures, so only Super Admins and Admins can receive them.</p>
      {error && <div role="alert" className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
      {!data ? (
        !error && <div className="py-6 text-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="space-y-1">
          {data.recipients.map((r) => {
            const ok = usable(r);
            return (
              <label key={r.id} className={cn("flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm", ok ? "cursor-pointer hover:bg-muted/50" : "opacity-50")}>
                <input type="checkbox" disabled={!ok} checked={picked.has(r.id)}
                  onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} />
                <span className="min-w-0 flex-1 truncate">{r.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground">{ok ? (r.role === "super_admin" ? "Super Admin" : "Admin") : why(r)}</span>
              </label>
            );
          })}
        </div>
      )}
      <label className="mt-3 block space-y-1 text-xs">
        <span className="font-medium">Note (optional)</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={3}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent" />
      </label>
    </DialogShell>
  );
}
