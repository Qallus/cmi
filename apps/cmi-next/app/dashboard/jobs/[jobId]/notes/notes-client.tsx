"use client";

import * as React from "react";
import { Loader2, Pin, PinOff, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JobNote } from "@/lib/job-notes/data";

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}
function initials(name: string | null) {
  return (name ?? "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
}

export function JobNotesClient({ jobId, initial }: { jobId: string; initial: JobNote[] }) {
  const [notes, setNotes] = React.useState<JobNote[]>(initial);
  const [body, setBody] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text }) });
      const data = await res.json();
      if (res.ok && data.note) { setNotes((n) => sortNotes([data.note, ...n])); setBody(""); }
    } finally {
      setSaving(false);
    }
  }

  async function togglePin(note: JobNote) {
    const next = !note.pinned;
    setNotes((n) => sortNotes(n.map((x) => (x.id === note.id ? { ...x, pinned: next } : x))));
    await fetch(`/api/jobs/${jobId}/notes/${note.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: next }) }).catch(() => {});
  }

  async function remove(note: JobNote) {
    if (!window.confirm("Delete this note?")) return;
    setNotes((n) => n.filter((x) => x.id !== note.id));
    await fetch(`/api/jobs/${jobId}/notes/${note.id}`, { method: "DELETE" }).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Composer */}
      <div className="rounded-lg border border-border bg-card p-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a note about this job…"
          className="min-h-[70px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void add(); } }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">⌘/Ctrl + Enter to post</span>
          <Button size="sm" variant="accent" onClick={() => void add()} disabled={saving || !body.trim()}>
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Post note
          </Button>
        </div>
      </div>

      {/* Notes list */}
      {notes.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No notes yet. Add the first one above.</div>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <div key={n.id} className={cn("rounded-lg border bg-card p-3", n.pinned ? "border-accent/50" : "border-border")}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent/10 text-[11px] font-semibold text-accent">{initials(n.author_name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{n.author_name ?? "Staff"}</span>
                    <span className="text-[11px] text-muted-foreground">{fmt(n.created_at)}</span>
                    {n.pinned && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-accent">Pinned</span>}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">{n.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={() => void togglePin(n)} title={n.pinned ? "Unpin" : "Pin"} className="rounded p-1 text-muted-foreground hover:text-accent">
                    {n.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  </button>
                  <button type="button" onClick={() => void remove(n)} title="Delete" className="rounded p-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function sortNotes(list: JobNote[]): JobNote[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}
