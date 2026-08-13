"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { ArrowLeft, Check, Loader2, AlertTriangle, Plus, Star, FileText, Folder, History, RotateCcw } from "lucide-react";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { Button } from "@/components/workspace/ui/button";
import { Input } from "@/components/workspace/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/workspace/ui/dialog";
import { CommentsPanel } from "@/components/workspace/comments-panel";
import { ShareControl } from "@/components/workspace/share-control";
import type { WorkspaceScope } from "@/lib/workspace/types";
import type { WorkspaceComment, MentionUser } from "@/lib/workspace/comments";

const WorkspaceEditorSurface = dynamic(() => import("@/components/workspace/plate-editor").then((m) => m.WorkspaceEditorSurface), {
  ssr: false,
  loading: () => <div className="min-h-[62vh] rounded-md border bg-background px-4 py-3 text-sm text-muted-foreground">Loading editor…</div>,
});

type SaveState = "idle" | "saving" | "saved" | "error";
type NavDoc = { id: string; title: string; is_favorite: boolean; folder_name: string | null };

export function WorkspaceEditor({
  doc,
  navDocs,
  folders,
  comments,
  mentionable,
  workspaceId,
}: {
  doc: { id: string; title: string; content_json: unknown; scope: string; updated_at: string };
  navDocs: NavDoc[];
  folders: { id: string; name: string }[];
  comments: WorkspaceComment[];
  mentionable: MentionUser[];
  workspaceId?: string;
}) {
  const actionToken = useDashboardActionToken();
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [state, setState] = useState<SaveState>("idle");
  const [conflict, setConflict] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const latest = useRef<{ title: string; content: unknown }>({ title: doc.title, content: doc.content_json });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseUpdatedAt = useRef<string>(doc.updated_at);
  const conflictRef = useRef(false);
  const saving = useRef(false);

  const save = useCallback(async (force = false) => {
    if (saving.current) return;
    saving.current = true;
    setState("saving");
    try {
      const res = await fetch(`/api/workspace/documents/${doc.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionToken, title: latest.current.title, content: latest.current.content, expectedUpdatedAt: baseUpdatedAt.current, force }),
      });
      if (res.status === 409) { conflictRef.current = true; setConflict(true); setState("idle"); return; }
      const data = await res.json().catch(() => ({}));
      if (res.ok) { if (data.updatedAt) baseUpdatedAt.current = data.updatedAt; conflictRef.current = false; setConflict(false); setState("saved"); }
      else setState("error");
    } catch { setState("error"); } finally { saving.current = false; }
  }, [actionToken, doc.id]);

  const scheduleSave = useCallback(() => {
    if (conflictRef.current) return; // paused until the conflict is resolved
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => save(), 900);
  }, [save]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function newDocument() {
    const res = await fetch("/api/workspace/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionToken, scope: "personal", workspaceId }) });
    const data = await res.json();
    if (data?.id) { router.push(`/dashboard/workspace/${data.id}`); router.refresh(); }
  }

  const favorites = navDocs.filter((d) => d.is_favorite);

  const left = (
    <div className="space-y-4 rounded-md border bg-card p-3">
      <button type="button" onClick={newDocument} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New document</button>
      {favorites.length ? (
        <div>
          <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Favorites</p>
          <NavList docs={favorites} activeId={doc.id} icon={Star} />
        </div>
      ) : null}
      {folders.length ? (
        <div>
          <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Folders</p>
          <ul className="space-y-0.5">{folders.map((f) => <li key={f.id} className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-muted-foreground"><Folder className="h-3.5 w-3.5" /> {f.name}</li>)}</ul>
        </div>
      ) : null}
      <div>
        <p className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Documents</p>
        <NavList docs={navDocs} activeId={doc.id} icon={FileText} />
      </div>
    </div>
  );

  const right = (
    <div className="space-y-4">
      <CommentsPanel documentId={doc.id} comments={comments} mentionable={mentionable} />
      <div className="rounded-md border bg-card p-3 text-xs text-muted-foreground">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">Document info</p>
          <ShareControl documentId={doc.id} scope={doc.scope as WorkspaceScope} onChanged={() => router.refresh()} variant="button" />
        </div>
        <p>Scope: <span className="capitalize text-foreground">{doc.scope === "shared" ? "Public" : doc.scope}</span></p>
        <p>Updated: {new Date(doc.updated_at).toLocaleString()}</p>
        <button type="button" onClick={() => setHistoryOpen(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"><History className="h-3.5 w-3.5" /> Version history</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Link href={workspaceId ? `/dashboard/documents?ws=${workspaceId}` : "/dashboard/documents"} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Workspace
        </Link>
        <SaveStatus state={state} />
      </div>
      {conflict ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /> This document was changed on another device. To avoid overwriting those edits, saving is paused.</span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>Reload latest</Button>
            <Button size="sm" onClick={() => save(true)}>Overwrite with mine</Button>
          </span>
        </div>
      ) : null}
      <WorkspaceEditorSurface
        initialValue={doc.content_json}
        onChange={(value) => { latest.current.content = value; scheduleSave(); }}
        statusSlot={undefined}
        left={left}
        right={right}
        mentionUsers={mentionable}
        titleSlot={
          <Input
            value={title}
            onChange={(e) => { setTitle(e.target.value); latest.current.title = e.target.value; scheduleSave(); }}
            placeholder="Untitled"
            className="mb-2 h-auto border-0 bg-transparent px-0 text-3xl font-bold shadow-none focus-visible:ring-0"
          />
        }
      />
      <VersionHistoryDialog open={historyOpen} onOpenChange={setHistoryOpen} documentId={doc.id} actionToken={actionToken} />
    </div>
  );
}

function VersionHistoryDialog({ open, onOpenChange, documentId, actionToken }: { open: boolean; onOpenChange: (v: boolean) => void; documentId: string; actionToken: string }) {
  const [versions, setVersions] = useState<{ id: string; created_at: string; created_by_name: string | null; char_count: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/workspace/documents/${documentId}/versions`).then((r) => r.json()).then((d) => { if (d.ok) setVersions(d.versions); }).finally(() => setLoading(false));
  }, [open, documentId]);
  async function restore(versionId: string) {
    setBusy(versionId);
    try {
      const res = await fetch(`/api/workspace/documents/${documentId}/versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionToken, versionId }) });
      if (res.ok) window.location.reload(); // reload the editor with the restored content
      else setBusy(null);
    } catch { setBusy(null); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Version history</DialogTitle><DialogDescription>Snapshots of this document are saved automatically as you edit. Restore any point in time — the current version is snapshotted first, so restoring is undoable.</DialogDescription></DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto">
          {loading ? <p className="p-4 text-center text-sm text-muted-foreground">Loading…</p>
            : versions.length ? (
              <div className="divide-y">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{new Date(v.created_at).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">{v.created_by_name ?? "—"} · {v.char_count.toLocaleString()} chars</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => restore(v.id)} disabled={busy !== null}><RotateCcw className="mr-1.5 h-4 w-4" /> {busy === v.id ? "Restoring…" : "Restore"}</Button>
                  </div>
                ))}
              </div>
            ) : <p className="p-4 text-center text-sm text-muted-foreground">No earlier versions yet — snapshots appear here as the document is edited.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NavList({ docs, activeId, icon: Icon }: { docs: NavDoc[]; activeId: string; icon: typeof FileText }) {
  return (
    <ul className="space-y-0.5">
      {docs.slice(0, 30).map((d) => (
        <li key={d.id}>
          <Link href={`/dashboard/workspace/${d.id}`} className={`flex items-center gap-1.5 truncate rounded px-2 py-1 text-sm transition-colors hover:bg-accent ${d.id === activeId ? "bg-accent font-medium" : "text-muted-foreground"}`}>
            <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{d.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Fixed width + always rendered: the label changing (idle → Saving… → Saved) must
// not change the toolbar's width, or flex-wrap would add/remove a row and jump the page.
function SaveStatus({ state }: { state: SaveState }) {
  return (
    <span className="inline-flex w-[92px] shrink-0 items-center justify-end gap-1.5 whitespace-nowrap px-2 text-xs">
      {state === "saving" ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" /> <span className="text-muted-foreground">Saving…</span></> : null}
      {state === "saved" ? <><Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> <span className="text-emerald-600 dark:text-emerald-400">Saved</span></> : null}
      {state === "error" ? <><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> <span className="text-destructive">Failed</span></> : null}
    </span>
  );
}
