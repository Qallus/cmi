"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Archive, ArchiveRestore, Loader2, Mail, MoreHorizontal, Smartphone,
  SquarePen, Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { InterviewRow } from "@/lib/interviews/data";

type Channel = "email" | "sms";

/**
 * Row actions for an interview — the same set in every view.
 *
 * Email and SMS go to the partner: the invitation before, or the chase after.
 * They are composed here rather than dropped into Communications because the
 * interview supplies the context.
 */
export function InterviewActions({
  row, isSuperAdmin, onChanged,
}: {
  row: InterviewRow;
  isSuperAdmin: boolean;
  onChanged: () => void;
}) {
  const router = useRouter();
  const [menuAt, setMenuAt] = React.useState<{ top: number; left: number } | null>(null);
  const [channel, setChannel] = React.useState<Channel | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [toast, setToast] = React.useState<string | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const open = menuAt !== null;

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // Fixed to the viewport, so a scrolling table or card grid cannot clip it.
  React.useEffect(() => {
    if (!open) return;
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
  }, [open]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation();
    if (menuAt) { setMenuAt(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const width = 180, height = 6 * 34 + 8;
    const top = r.bottom + 4 + height > window.innerHeight ? Math.max(8, r.top - 4 - height) : r.bottom + 4;
    setMenuAt({ top, left: Math.max(8, Math.min(window.innerWidth - width - 8, r.right - width)) });
  }

  async function call(url: string, init: RequestInit) {
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

  async function archive() {
    if (!window.confirm(`Archive “${row.title}”?\n\nIt leaves the list but keeps every answer, note and follow-up, and can be restored.`)) return;
    if (await call(`/api/interviews/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived_at: new Date().toISOString() }),
    })) { onChanged(); setToast("Archived."); }
  }

  async function restore() {
    if (await call(`/api/interviews/${row.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived_at: null }),
    })) { onChanged(); setToast("Back in the list."); }
  }

  async function destroy() {
    if (!window.confirm(`Permanently delete “${row.title}”?\n\nThe answers, notes and timeline go with it and cannot be recovered. Archive instead if you may need it later.`)) return;
    if (await call(`/api/interviews/${row.id}`, { method: "DELETE" })) { onChanged(); setToast("Deleted."); }
  }

  const archived = !!row.archived_at;
  const items: { key: string; label: string; icon: typeof Mail; run: () => void; danger?: boolean; hidden?: boolean }[] = [
    { key: "edit", label: "Open", icon: SquarePen, run: () => router.push(`/dashboard/interviews/${row.id}`) },
    { key: "email", label: "Email partner", icon: Mail, run: () => setChannel("email") },
    { key: "sms", label: "Text partner", icon: Smartphone, run: () => setChannel("sms") },
    archived
      ? { key: "restore", label: "Restore", icon: ArchiveRestore, run: () => void restore() }
      : { key: "archive", label: "Archive", icon: Archive, run: () => void archive() },
    { key: "delete", label: "Delete", icon: Trash2, run: () => void destroy(), danger: true, hidden: !isSuperAdmin },
  ];
  const visible = items.filter((i) => !i.hidden);

  return (
    <>
      <div ref={menuRef} className="relative" onClick={(e) => e.stopPropagation()}>
        <button
          type="button" aria-label={`Actions for ${row.title}`} aria-haspopup="menu" aria-expanded={open}
          onClick={toggle}
          className="rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuAt && (
          <div role="menu" style={{ top: menuAt.top, left: menuAt.left }} className="fixed z-[65] w-44 rounded-md border border-border bg-card p-1 text-sm shadow-lg">
            {visible.map((i) => (
              <button
                key={i.key} type="button" role="menuitem" disabled={busy}
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
        <MessageDialog
          row={row} channel={channel}
          onClose={() => setChannel(null)}
          onSent={(msg) => { setChannel(null); setToast(msg); onChanged(); }}
        />
      )}
      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 z-[80] max-w-[90vw] -translate-x-1/2 rounded-md border border-border bg-card px-4 py-2 text-sm shadow-lg">{toast}</div>
      )}
    </>
  );
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";

function MessageDialog({
  row, channel, onClose, onSent,
}: {
  row: InterviewRow; channel: Channel; onClose: () => void; onSent: (msg: string) => void;
}) {
  // Seeded from the interview, because that is the message you almost always
  // want — confirm the time, or chase what is still outstanding.
  const initial = React.useMemo(() => {
    const who = row.contact_name?.split(" ")[0] ?? "there";
    if (row.completed_at) {
      return `Hi ${who}, thank you for your time. We will follow up shortly with anything still outstanding.`;
    }
    if (row.scheduled_at) {
      return `Hi ${who}, confirming your interview with Constructed Matter on ${when(row.scheduled_at)}. Reply here if you need to reschedule.`;
    }
    return `Hi ${who}, we would like to set up a short interview to learn more about your company and the work that fits you best. When suits?`;
  }, [row]);

  const [body, setBody] = React.useState(initial);
  const [subject, setSubject] = React.useState(
    row.completed_at ? "Thank you for your time" : "Constructed Matter — trade partner interview",
  );
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); onClose(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  async function send() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/interviews/${row.id}/message`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, subject, body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setError(json.error ?? "Could not send."); setBusy(false); return; }
    onSent(`${channel === "sms" ? "Text" : "Email"} sent to ${json.to}.`);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px]" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Message ${row.title}`} className="relative z-10 w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h3 className="truncate font-semibold">{channel === "sms" ? "Text" : "Email"} {row.company_name || row.contact_name || "partner"}</h3>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded p-1 text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          {channel === "email" && (
            <label className="block space-y-1 text-xs">
              <span className="font-medium">Subject</span>
              <input
                value={subject} onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none transition focus:border-accent"
              />
            </label>
          )}
          <label className="block space-y-1 text-xs">
            <span className="font-medium">Message</span>
            <textarea
              value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={2000}
              className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none transition focus:border-accent"
            />
          </label>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Goes to the partner on this interview. Opt-outs are honoured — if they have replied STOP
            or unsubscribed, this will not send.
          </p>
          {error && <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-sm transition hover:bg-muted">Cancel</button>
          <button
            type="button" disabled={busy || !body.trim()} onClick={() => void send()}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
