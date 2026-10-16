"use client";

// Job communications toolbar, shown in the dashboard top bar on a single job's
// pages only: All · Calls · SMS · Email · Notes · Prints. Each tool opens with
// this job's clients, subs and team ready to pick, so staff can reach people
// without leaving the job. Messages sent here are logged against the job.
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ExternalLink, Mail, MessageSquare, MessagesSquare, NotebookPen, Phone, Pin, Plus, Printer, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { cn } from "@/lib/utils";
import { CallsWorkspace } from "@/app/dashboard/communications/calls-workspace";
import { ExecSummaryDialog } from "@/components/exec-summary/exec-summary-button";
import { ComposeDialog, type ComposeChannel } from "./compose-dialog";
import { RecipientPicker } from "./recipient-picker";
import type { JobCommCounts, JobRecipient } from "@/lib/job-communications/data";
import type { JobNote } from "@/lib/job-notes/data";

const JOB_PATH = /^\/dashboard\/jobs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\/|$)/i;

type CommsData = { job: { id: string; name: string }; recipients: JobRecipient[]; counts: JobCommCounts };
type Tool = "call" | "sms" | "email" | "notes" | "prints" | "summary";

/** Renders nothing unless the current page is inside one job. */
export function JobCommsBar() {
  const pathname = usePathname();
  const jobId = pathname.match(JOB_PATH)?.[1] ?? null;
  if (!jobId) return null;
  return <JobCommsBarInner key={jobId} jobId={jobId} pathname={pathname} />;
}

function JobCommsBarInner({ jobId, pathname }: { jobId: string; pathname: string }) {
  const router = useRouter();
  const [data, setData] = React.useState<CommsData | null>(null);
  const [tool, setTool] = React.useState<Tool | null>(null);
  const [printsOpen, setPrintsOpen] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const barRef = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!printsOpen && !mobileOpen) return;
    const h = (e: MouseEvent) => { if (!barRef.current?.contains(e.target as Node)) { setPrintsOpen(false); setMobileOpen(false); } };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [printsOpen, mobileOpen]);

  const load = React.useCallback(() => {
    fetch(`/api/jobs/${jobId}/comms`).then((r) => (r.ok ? r.json() : null)).then((d: CommsData | null) => d && setData(d)).catch(() => {});
  }, [jobId]);
  React.useEffect(() => { load(); }, [load]);

  const onCommsPage = pathname.startsWith(`/dashboard/jobs/${jobId}/communications`);
  const refreshAll = () => { load(); if (onCommsPage) router.refresh(); };
  const counts = data?.counts;
  const recipients = data?.recipients ?? [];
  const jobName = data?.job.name ?? "this job";

  const items: { key: Tool | "all"; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "all", label: "All", icon: RefreshCw, count: counts?.all },
    { key: "call", label: "Calls", icon: Phone, count: counts?.call },
    { key: "sms", label: "SMS", icon: MessageSquare, count: counts?.sms },
    { key: "email", label: "Email", icon: Mail, count: counts?.email },
    { key: "notes", label: "Notes", icon: NotebookPen, count: counts?.notes },
    { key: "prints", label: "Prints", icon: Printer },
  ];

  function choose(key: Tool | "all") {
    setMobileOpen(false);
    if (key === "all") { router.push(`/dashboard/jobs/${jobId}/communications`); return; }
    if (key === "prints") { setPrintsOpen((v) => !v); return; }
    setTool(key);
  }

  return (
    <div ref={barRef} className="contents">
      {/* md and up: the toolbar itself (labels from xl) */}
      <nav aria-label="Job communications" className="hidden items-center gap-0.5 md:flex">
        {items.map((it) => {
          const active = it.key === "all" ? onCommsPage : it.key === "prints" ? printsOpen : tool === it.key;
          return (
            <div key={it.key} className="relative">
              <button
                type="button"
                onClick={() => choose(it.key)}
                title={it.label}
                className={cn("flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium transition",
                  active ? "text-accent" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              >
                <it.icon className="h-3.5 w-3.5" />
                <span className="hidden xl:inline">{it.label}</span>
                {!!it.count && (
                  <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none", active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground")}>{it.count}</span>
                )}
              </button>
              {it.key === "prints" && printsOpen && (
                <PrintsMenu onClose={() => setPrintsOpen(false)} onSummary={() => { setPrintsOpen(false); setTool("summary"); }} />
              )}
            </div>
          );
        })}
        <span className="mx-1 h-5 w-px bg-border" />
      </nav>

      {/* Phones: one button with the same tools */}
      <div className="relative md:hidden">
        <button type="button" onClick={() => setMobileOpen((v) => !v)} aria-label="Job communications" className="rounded-md border border-border p-1.5 text-muted-foreground transition hover:text-foreground">
          <MessagesSquare className="h-4 w-4" />
        </button>
        {mobileOpen && (
          <>
            <div className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-xl">
              {items.map((it) => (
                <button key={it.key} type="button" onClick={() => (it.key === "prints" ? (setMobileOpen(false), setTool("summary")) : choose(it.key))}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted">
                  <it.icon className="h-4 w-4 text-muted-foreground" /> {it.key === "prints" ? "Executive Summary" : it.label}
                  {!!it.count && <span className="ml-auto text-xs text-muted-foreground">{it.count}</span>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {(tool === "sms" || tool === "email") && (
        <ComposeDialog
          init={{ channel: tool as ComposeChannel }}
          recipients={recipients}
          jobId={jobId}
          onClose={() => setTool(null)}
          onSent={refreshAll}
          onRecipientSaved={load}
          variant="panel"
        />
      )}
      {tool === "call" && <CallPanel jobId={jobId} jobName={jobName} recipients={recipients} onSaved={load} onClose={() => { setTool(null); refreshAll(); }} />}
      {tool === "notes" && <NotesPanel jobId={jobId} jobName={jobName} onClose={() => { setTool(null); refreshAll(); }} />}
      {tool === "summary" && <ExecSummaryDialog target="job" id={jobId} name={jobName} onClose={() => setTool(null)} asPanel />}
    </div>
  );
}

function PrintsMenu({ onClose, onSummary }: { onClose: () => void; onSummary: () => void }) {
  return (
    <>
      <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 text-sm shadow-xl">
        <button type="button" onClick={onSummary} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          <span><span className="block font-medium">Executive Summary</span><span className="text-xs text-muted-foreground">Write, print or send one for this job, or open a past one</span></span>
        </button>
        <Link href="/dashboard/communications?tab=prints&new=1" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-muted">
          <Plus className="h-4 w-4 text-muted-foreground" /> Create New Print
        </Link>
        <Link href="/dashboard/communications?tab=prints" onClick={onClose} className="flex items-center gap-2 px-3 py-2 hover:bg-muted">
          <ExternalLink className="h-4 w-4 text-muted-foreground" /> All prints
        </Link>
      </div>
    </>
  );
}

// Browser dialer with the job's people to pick from, or any number typed in.
// Choosing someone reloads the dialer with their number; a short note can be
// saved to the job after the call.
function CallPanel({ jobId, jobName, recipients, onSaved, onClose }: { jobId: string; jobName: string; recipients: JobRecipient[]; onSaved: () => void; onClose: () => void }) {
  const [number, setNumber] = React.useState(recipients.find((r) => r.phone)?.phone ?? "");
  const [who, setWho] = React.useState<JobRecipient | null>(recipients.find((r) => r.phone) ?? null);
  const [note, setNote] = React.useState("");
  const [saved, setSaved] = React.useState(false);

  async function saveNote() {
    if (!note.trim()) return;
    const res = await fetch(`/api/jobs/${jobId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: `Call${who ? ` with ${who.name}` : number ? ` to ${number}` : ""}: ${note.trim()}` }),
    });
    if (res.ok) { setSaved(true); setNote(""); }
  }

  return (
    <SidePanel title={`Call · ${jobName}`} subtitle={who ? `${who.name} · ${number}` : number || "Pick someone or enter a number"} onClose={onClose}>
      <div className="space-y-4">
        <RecipientPicker
          recipients={recipients}
          kind="phone"
          label="Who to call"
          onUse={(address, r) => { setNumber(address); setWho(r); }}
          onSaved={onSaved}
        />
        <CallsWorkspace key={number || "blank"} hideLog initialNumber={number} />
        <div className="space-y-2 border-t border-border pt-3">
          <label className="text-xs font-medium text-muted-foreground">Call note (saved to this job&apos;s Notes)</label>
          <textarea className="min-h-[70px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" value={note} onChange={(e) => { setNote(e.target.value); setSaved(false); }} placeholder="What was discussed?" />
          <div className="flex items-center justify-end gap-2">
            {saved && <span className="text-xs text-success">Saved</span>}
            <Button size="sm" variant="outline" onClick={() => void saveNote()} disabled={!note.trim()}>Save note</Button>
          </div>
        </div>
      </div>
    </SidePanel>
  );
}

function NotesPanel({ jobId, jobName, onClose }: { jobId: string; jobName: string; onClose: () => void }) {
  const [notes, setNotes] = React.useState<JobNote[] | null>(null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    fetch(`/api/jobs/${jobId}/notes`).then((r) => r.json()).then((d) => setNotes(d?.notes ?? [])).catch(() => setNotes([]));
  }, [jobId]);

  async function add() {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/jobs/${jobId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text.trim() }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d?.error || "Couldn't save the note."); return; }
    setNotes((n) => [d.note as JobNote, ...(n ?? [])]);
    setText("");
  }
  async function togglePin(note: JobNote) {
    setNotes((n) => (n ?? []).map((x) => (x.id === note.id ? { ...x, pinned: !x.pinned } : x)));
    await fetch(`/api/jobs/${jobId}/notes/${note.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: !note.pinned }) }).catch(() => {});
  }
  async function remove(note: JobNote) {
    setNotes((n) => (n ?? []).filter((x) => x.id !== note.id));
    await fetch(`/api/jobs/${jobId}/notes/${note.id}`, { method: "DELETE" }).catch(() => {});
  }

  const sorted = [...(notes ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
  return (
    <SidePanel title={`Notes · ${jobName}`} onClose={onClose}>
      <div className="space-y-3">
        {error && <div className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
        <textarea autoFocus className="min-h-[80px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" value={text} onChange={(e) => setText(e.target.value)} placeholder="Jot a note for this job…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void add(); }} />
        <div className="flex items-center justify-between">
          <Link href={`/dashboard/jobs/${jobId}/notes`} onClick={onClose} className="text-xs text-accent hover:underline">All notes</Link>
          <Button size="sm" variant="accent" onClick={() => void add()} disabled={busy || !text.trim()}>{busy ? "Saving…" : "Save note"}</Button>
        </div>
        <div className="space-y-2">
          {notes === null ? <div className="py-4 text-center text-sm text-muted-foreground">Loading…</div>
            : sorted.length === 0 ? <div className="py-4 text-center text-sm text-muted-foreground">No notes yet.</div>
            : sorted.map((n) => (
              <div key={n.id} className="group rounded-md border border-border p-3">
                <div className="whitespace-pre-wrap text-sm">{n.body}</div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span>{n.author_name ?? "Staff"} · {new Date(n.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <button type="button" onClick={() => void togglePin(n)} title={n.pinned ? "Unpin" : "Pin"} className={cn("ml-auto", n.pinned ? "text-accent" : "opacity-0 group-hover:opacity-100 hover:text-foreground")}><Pin className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => void remove(n)} title="Delete" className="opacity-0 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
        </div>
      </div>
    </SidePanel>
  );
}
