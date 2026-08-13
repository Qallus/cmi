"use client";

import { useEffect, useRef, useState } from "react";
import { Share2, Lock, Globe, X, Search, Check } from "lucide-react";
import { useDashboardActionToken } from "@/components/workspace/ui/action-token";
import { SimpleTooltip } from "@/components/workspace/ui/tooltip";
import { cn } from "@/lib/utils";
import type { WorkspaceScope } from "@/lib/workspace/types";

type Collab = { id: string; user_id: string; name: string; email: string | null; permission: string };
type UserRow = { id: string; name: string; email: string | null };

export function ShareControl({
  documentId,
  scope,
  onChanged,
  align = "right",
  variant = "icon",
}: {
  documentId: string;
  scope: WorkspaceScope;
  onChanged?: () => void;
  align?: "left" | "right";
  variant?: "icon" | "button" | "mini";
}) {
  const actionToken = useDashboardActionToken();
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [collabs, setCollabs] = useState<Collab[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");
  const [localScope, setLocalScope] = useState<WorkspaceScope>(scope);

  useEffect(() => setLocalScope(scope), [scope]);

  // The panel is position:fixed so it escapes the scroll container's overflow clip.
  useEffect(() => {
    if (!open || !ref.current) { setPos(null); return; }
    const r = ref.current.getBoundingClientRect();
    const width = 288;
    let left = align === "right" ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  async function refreshSharing() {
    const res = await fetch(`/api/workspace/documents/${documentId}/collaborators`);
    const data = await res.json();
    if (data.ok) { setCollabs(data.collaborators); setUsers(data.users); }
  }

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    refreshSharing().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, documentId]);

  async function patchScope(next: WorkspaceScope) {
    setLocalScope(next);
    await fetch(`/api/workspace/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionToken, scope: next }),
    });
    onChanged?.();
  }

  async function add(userId: string) {
    setQ("");
    await fetch(`/api/workspace/documents/${documentId}/collaborators`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionToken, userId }),
    });
    await refreshSharing();
    onChanged?.();
  }

  async function remove(userId: string) {
    setCollabs((cs) => cs.filter((c) => c.user_id !== userId));
    await fetch(`/api/workspace/documents/${documentId}/collaborators`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actionToken, userId }),
    });
    onChanged?.();
  }

  const collabIds = new Set(collabs.map((c) => c.user_id));
  const query = q.trim().toLowerCase();
  const matches = query
    ? users.filter((u) => !collabIds.has(u.id) && (u.name.toLowerCase().includes(query) || (u.email ?? "").toLowerCase().includes(query))).slice(0, 6)
    : [];

  const shareCount = collabs.length;
  const trigger =
    variant === "button" ? (
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent">
        <Share2 className="h-3.5 w-3.5" /> Share{shareCount ? ` · ${shareCount}` : ""}
      </button>
    ) : variant === "mini" ? (
      <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }} className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Share">
        <Share2 className="h-3 w-3" />
      </button>
    ) : (
      <button type="button" onClick={() => setOpen((o) => !o)} className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Share">
        <Share2 className="h-4 w-4" />
      </button>
    );

  return (
    <div className="relative" ref={ref}>
      <SimpleTooltip label="Share">{trigger}</SimpleTooltip>
      {open && pos ? (
        <div ref={panelRef} style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }} className="z-50 rounded-md border bg-popover p-3 text-popover-foreground shadow-lg">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Who can access</p>
          <div className="space-y-1">
            <ScopeRow active={localScope === "personal"} onClick={() => patchScope("personal")} icon={Lock} title="Personal" sub="Only you" />
            <ScopeRow active={localScope === "shared"} onClick={() => patchScope("shared")} icon={Globe} title="Public" sub="Everyone in the workspace" />
          </div>

          <div className="my-3 h-px bg-border" />

          <p className="mb-2 text-xs font-semibold text-muted-foreground">Share with people</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-md border bg-background py-1.5 pl-7 pr-2 text-sm outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          {matches.length ? (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-md border">
              {matches.map((u) => (
                <button key={u.id} type="button" onClick={() => add(u.id)} className="flex w-full items-center justify-between px-2 py-1.5 text-left text-sm hover:bg-accent">
                  <span className="min-w-0"><span className="block truncate">{u.name}</span>{u.email ? <span className="block truncate text-xs text-muted-foreground">{u.email}</span> : null}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-2 space-y-1">
            {loading ? <p className="text-xs text-muted-foreground">Loading…</p> : null}
            {!loading && !collabs.length ? <p className="text-xs text-muted-foreground">No one added yet.</p> : null}
            {collabs.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-md px-2 py-1 text-sm">
                <span className="flex min-w-0 items-center gap-1.5"><Check className="h-3.5 w-3.5 shrink-0 text-accent" /><span className="min-w-0"><span className="block truncate">{c.name}</span></span></span>
                <button type="button" onClick={() => remove(c.user_id)} className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${c.name}`}><X className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScopeRow({ active, onClick, icon: Icon, title, sub }: { active: boolean; onClick: () => void; icon: typeof Lock; title: string; sub: string }) {
  return (
    <button type="button" onClick={onClick} className={cn("flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors", active ? "border-accent bg-accent/10" : "hover:bg-accent")}>
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-accent" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted-foreground">{sub}</span></span>
      {active ? <Check className="h-4 w-4 shrink-0 text-accent" /> : null}
    </button>
  );
}
