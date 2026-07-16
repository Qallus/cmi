"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import {
  Camera, Check, Inbox, Loader2, Maximize2, MessageSquarePlus, MessagesSquare, Minimize2, PenLine, Sparkles, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { DmInbox } from "@/components/direct-messages/dm-inbox";
import { BoltModal } from "./bolt-modal";
import { NoteDetailModal } from "./note-detail-modal";
import { ScreenshotEditor } from "./screenshot-editor";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import {
  NOTE_PRIORITIES, NOTE_STATUS_LABELS, NOTE_STATUSES, NOTE_TYPES, NOTE_TYPE_LABELS,
  type DashboardNote, type DashboardNoteStatus, type NotePriority, type NoteType,
} from "@/lib/dashboard-notes/types";

type StaffOption = { id: string; label: string; email: string; role: string };
type Tab = "note" | "shared" | "messages";

const PRIORITY_TONE: Record<NotePriority, string> = {
  low: "bg-muted text-muted-foreground", medium: "bg-info/15 text-info",
  high: "bg-warning/15 text-warning", urgent: "bg-destructive/15 text-destructive",
};
const STATUS_TONE: Record<string, string> = {
  open: "bg-info/15 text-info", in_progress: "bg-warning/15 text-warning",
  done: "bg-success/15 text-success", archived: "bg-muted text-muted-foreground",
};

function prettyRoute(path: string): string {
  const seg = path.split("/").filter(Boolean);
  const last = seg[seg.length - 1] ?? "overview";
  return last.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReviewFab() {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("note");
  const [boltOpen, setBoltOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<DashboardNote | null>(null);
  const [unread, setUnread] = React.useState(0);
  const [dmUnread, setDmUnread] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);

  const pageTitle = prettyRoute(pathname);
  // When on a specific job page (/dashboard/jobs/<uuid>/…), hand Bolt the job id
  // so "this job" resolves to a get_job_overview call.
  const boltJobId = React.useMemo(() => {
    const m = pathname.match(/\/dashboard\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i);
    return m ? m[1] : null;
  }, [pathname]);

  // Composer state
  const [note, setNote] = React.useState("");
  const [type, setType] = React.useState<NoteType>("edit");
  const [priority, setPriority] = React.useState<NotePriority>("medium");
  const [recipients, setRecipients] = React.useState<string[]>([]);
  const [staff, setStaff] = React.useState<StaffOption[]>([]);
  const [shot, setShot] = React.useState<string | null>(null); // dataURL preview
  const [editing, setEditing] = React.useState<string | null>(null); // dataURL open in the editor
  const [capturing, setCapturing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Shared inbox
  const [shared, setShared] = React.useState<DashboardNote[]>([]);
  const [loadingShared, setLoadingShared] = React.useState(false);

  const loadUnread = React.useCallback(() => {
    fetch("/api/dashboard-notes?scope=shared")
      .then((r) => r.json()).then((d: { unread?: number }) => setUnread(d.unread ?? 0)).catch(() => {});
  }, []);

  const loadDmUnread = React.useCallback(() => {
    fetch("/api/direct-messages/unread")
      .then((r) => r.json()).then((d: { count?: number }) => setDmUnread(d.count ?? 0)).catch(() => {});
  }, []);

  React.useEffect(() => {
    loadUnread();
    loadDmUnread();
    const interval = setInterval(loadDmUnread, 30000);
    fetch("/api/staff-options").then((r) => r.json())
      .then((d: { staff?: StaffOption[] }) => setStaff((d.staff ?? []).filter((s) => ["super_admin", "admin"].includes(s.role) && s.email)))
      .catch(() => {});
    return () => clearInterval(interval);
  }, [loadUnread, loadDmUnread]);

  const loadShared = React.useCallback(async () => {
    setLoadingShared(true);
    try {
      const res = await fetch("/api/dashboard-notes?scope=inbox");
      const json = await res.json() as { notes?: DashboardNote[]; me?: string };
      const notes = json.notes ?? [];
      setShared(notes);
      // Mark unread ones as read now that they're on screen.
      const me = json.me ?? "";
      const unreadIds = notes.filter((n) => !n.read_by.map((e) => e.toLowerCase()).includes(me)).map((n) => n.id);
      await Promise.allSettled(unreadIds.map((id) =>
        fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "mark_read", id }) })));
      if (unreadIds.length) setUnread(0);
    } finally { setLoadingShared(false); }
  }, []);

  React.useEffect(() => { if (!open) setFullscreen(false); }, [open]);

  function openPanel(t: Tab) { setOpen(true); setTab(t); if (t === "shared") void loadShared(); }

  async function captureScreenshot() {
    setCapturing(true); setError(null);
    try {
      // html-to-image renders via the browser (SVG foreignObject), so modern CSS
      // colors (oklch/color-mix) that html2canvas can't parse work fine here.
      const { toJpeg } = await import("html-to-image");
      const bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
      const dataUrl = await toJpeg(document.body, {
        quality: 0.85,
        backgroundColor: bg,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        // Keep everything except the FAB itself out of the shot.
        filter: (node) => !(node instanceof HTMLElement && node.hasAttribute?.("data-fab-ignore")),
        cacheBust: true,
      });
      setEditing(dataUrl); // open the crop/annotate editor
    } catch { setError("Couldn't capture the screen on this page."); }
    finally { setCapturing(false); }
  }

  async function uploadShot(dataUrl: string): Promise<string | null> {
    const blob = await (await fetch(dataUrl)).blob();
    const form = new FormData();
    form.append("file", new File([blob], `dashboard-${Date.now()}.jpg`, { type: "image/jpeg" }));
    form.append("folder", "dashboard-notes");
    const res = await fetch("/api/admin/uploads", { method: "POST", body: form });
    if (!res.ok) return null;
    const json = await res.json() as { url?: string };
    return json.url ?? null;
  }

  async function submit() {
    if (!note.trim()) { setError("Add a note first."); return; }
    setSaving(true); setError(null);
    try {
      let screenshot_url: string | null = null;
      if (shot) screenshot_url = await uploadShot(shot);
      const res = await fetch("/api/dashboard-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", payload: {
          route: pathname, page_title: pageTitle, note: note.trim(), type, priority,
          recipient_emails: recipients, screenshot_url,
        } }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Save failed.");
      setSaved(true);
      setNote(""); setShot(null); setRecipients([]); setType("edit"); setPriority("medium");
      setTimeout(() => { setSaved(false); setOpen(false); }, 1100);
    } catch (err) { setError(err instanceof Error ? err.message : "Save failed."); }
    finally { setSaving(false); }
  }

  async function setStatus(n: DashboardNote, status: DashboardNoteStatus) {
    setShared((prev) => prev.map((x) => (x.id === n.id ? { ...x, status } : x)));
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_status", id: n.id, status }) }).catch(() => {});
  }

  async function hardRemoveNote(n: DashboardNote) {
    setShared((prev) => prev.filter((x) => x.id !== n.id));
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: n.id }) }).catch(() => {});
    loadUnread();
  }

  async function archiveNote(n: DashboardNote) {
    setShared((prev) => prev.filter((x) => x.id !== n.id));
    await fetch("/api/dashboard-notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_status", id: n.id, status: "archived" }) }).catch(() => {});
    loadUnread();
  }

  function toggleRecipient(email: string) {
    setRecipients((prev) => prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]);
  }

  return (
    <>
      {/* FAB */}
      <div data-fab-ignore className="fixed bottom-5 right-5 z-50 print:hidden">
        {open && !(fullscreen && tab === "messages") && (
          <div className={cn("mb-3 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl", tab === "messages" ? "w-[92vw] max-w-[640px]" : "w-[380px]")}>
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-1">
                <TabBtn active={tab === "note"} onClick={() => setTab("note")} icon={<PenLine className="h-3.5 w-3.5" />} label="Note" />
                <TabBtn active={tab === "shared"} onClick={() => openPanel("shared")} icon={<Inbox className="h-3.5 w-3.5" />} label="Requests" badge={unread} />
                <TabBtn active={tab === "messages"} onClick={() => setTab("messages")} icon={<MessagesSquare className="h-3.5 w-3.5" />} label="Direct Messages" badge={dmUnread} />
              </div>
              <div className="flex items-center gap-1">
                {tab === "messages" && (
                  <button type="button" onClick={() => setFullscreen(true)} title="Expand to fullscreen" className="rounded p-1 text-muted-foreground hover:text-foreground"><Maximize2 className="h-4 w-4" /></button>
                )}
                <button type="button" onClick={() => setOpen(false)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {tab === "messages" ? (
              <DmInbox className="h-[62vh] rounded-none border-0" />
            ) : tab === "note" ? (
              <div className="max-h-[70vh] space-y-3 overflow-y-auto p-4">
                <div className="text-[11px] text-muted-foreground">On <span className="font-medium text-foreground">{pageTitle}</span> — captured automatically.</div>
                {error && <div className="rounded bg-destructive/10 px-2 py-1 text-[11px] text-destructive">{error}</div>}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What needs changing, fixing, adding, or removing here?"
                  className="min-h-[80px] w-full resize-none rounded-md border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-accent" />
                <div className="grid grid-cols-2 gap-2">
                  <L label="Type"><select value={type} onChange={(e) => setType(e.target.value as NoteType)} className={ic}>{NOTE_TYPES.map((t) => <option key={t} value={t}>{NOTE_TYPE_LABELS[t]}</option>)}</select></L>
                  <L label="Priority"><select value={priority} onChange={(e) => setPriority(e.target.value as NotePriority)} className={ic}>{NOTE_PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}</select></L>
                </div>

                <div>
                  <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Share with (email + bell)</div>
                  <div className="flex flex-wrap gap-1.5">
                    {staff.length === 0 && <span className="text-[11px] text-muted-foreground">No teammates found.</span>}
                    {staff.map((s) => (
                      <button key={s.id} type="button" onClick={() => toggleRecipient(s.email)}
                        className={cn("rounded-full border px-2 py-0.5 text-[11px]", recipients.includes(s.email) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => void captureScreenshot()} disabled={capturing}>
                    {capturing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />} {shot ? "Recapture" : "Screenshot"}
                  </Button>
                  {shot && (
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => setEditing(shot)} title="Crop & annotate"><img src={shot} alt="preview" className="h-8 w-12 rounded border border-border object-cover transition hover:ring-2 hover:ring-accent" /></button>
                      <button type="button" onClick={() => setEditing(shot)} className="text-[11px] font-medium text-accent">Annotate</button>
                      <button type="button" onClick={() => setShot(null)} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button type="button" onClick={() => { setBoltOpen(true); }} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:opacity-80"><Sparkles className="h-3.5 w-3.5" /> Ask Bolt instead</button>
                  <Button size="sm" variant="accent" onClick={() => void submit()} disabled={saving || saved}>
                    {saved ? <Check className="h-3.5 w-3.5" /> : saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {saved ? "Saved" : recipients.length ? "Save & share" : "Save note"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-2 overflow-y-auto p-3">
                {loadingShared ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent" /></div>
                ) : shared.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">No requests yet. Save a note to see it here.</div>
                ) : shared.map((n) => (
                  <div key={n.id} onClick={() => setDetailId(n.id)} className="cursor-pointer rounded-lg border border-border bg-background p-2.5 transition hover:border-accent/40">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", PRIORITY_TONE[n.priority])}>{n.priority}</span>
                      <span className="text-[10px] text-muted-foreground">{NOTE_TYPE_LABELS[n.type]} · {n.page_title}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">{n.created_by_name}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 text-xs">{n.note}</div>
                    {n.screenshot_url && <img src={n.screenshot_url} alt="" className="mt-1.5 max-h-24 rounded border border-border object-cover" />}
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] font-medium text-accent">Open details →</span>
                      <select value={n.status} onClick={(e) => e.stopPropagation()} onChange={(e) => void setStatus(n, e.target.value as DashboardNoteStatus)} className={cn("ml-auto h-6 rounded border border-border bg-background px-1 text-[10px]", STATUS_TONE[n.status])}>
                        {NOTE_STATUSES.map((s) => <option key={s} value={s}>{NOTE_STATUS_LABELS[s]}</option>)}
                      </select>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setConfirmDel(n); }} title="Delete request" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          {open && (
            <button type="button" onClick={() => setBoltOpen(true)} title="Ask Bolt"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-accent shadow-lg transition hover:bg-muted">
              <Sparkles className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={() => (open ? setOpen(false) : openPanel("note"))} title="Leadership review"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-xl transition hover:opacity-90">
            {open ? <X className="h-6 w-6" /> : <MessageSquarePlus className="h-6 w-6" />}
            {!open && (unread + dmUnread) > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">{(unread + dmUnread) > 9 ? "9+" : unread + dmUnread}</span>}
          </button>
        </div>
      </div>

      {open && fullscreen && tab === "messages" && (
        <div className="fixed inset-0 z-[110] flex flex-col bg-background p-4 print:hidden">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold"><MessagesSquare className="h-4 w-4 text-accent" /> Direct Messages</div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setFullscreen(false)} title="Exit fullscreen" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><Minimize2 className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setFullscreen(false); setOpen(false); }} title="Close" className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
            </div>
          </div>
          <DmInbox className="min-h-0 flex-1" />
        </div>
      )}

      {editing && <ScreenshotEditor src={editing} onSave={(url) => { setShot(url); setEditing(null); }} onCancel={() => setEditing(null)} />}
      {boltOpen && <BoltModal context={pageTitle} jobId={boltJobId} onClose={() => setBoltOpen(false)} />}
      {detailId && <NoteDetailModal noteId={detailId} onClose={() => setDetailId(null)} onChanged={() => { void loadShared(); loadUnread(); }} />}
      {confirmDel && (
        <ConfirmDeleteDialog
          onConfirm={async () => { const n = confirmDel; setConfirmDel(null); await hardRemoveNote(n); }}
          onArchive={async () => { const n = confirmDel; setConfirmDel(null); await archiveNote(n); }}
          onCancel={() => setConfirmDel(null)}
        />
      )}
    </>
  );
}

const ic = "h-8 w-full rounded-md border border-border bg-background px-2 text-xs outline-none focus:border-accent";
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</label>{children}</div>;
}
function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; badge?: number }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium", active ? "bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground")}>
      {icon} {label}
      {badge ? <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white">{badge > 9 ? "9+" : badge}</span> : null}
    </button>
  );
}
