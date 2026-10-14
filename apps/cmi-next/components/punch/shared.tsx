"use client";

// Small shared pieces for the punch list UI: the one-time meta fetch (staff
// you can assign, templates, edit rights), a centered modal shell that goes
// full-width on phones, the "Attach to…" picker, and JSON fetch helpers.
import * as React from "react";
import { Briefcase, HardHat, Loader2, Search, Workflow, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { PARENT_LABEL, type PunchParent, type PunchParentType, type PunchTemplate } from "@/lib/punch/types";

export type PunchMeta = {
  me: string;
  canWrite: boolean;
  staff: { id: string; name: string }[];
  templates: PunchTemplate[];
};

let metaPromise: Promise<PunchMeta> | null = null;
export function loadPunchMeta(force = false): Promise<PunchMeta> {
  if (!metaPromise || force) {
    metaPromise = fetch("/api/punch-lists/meta").then(async (r) => {
      const j = await r.json();
      if (!r.ok) { metaPromise = null; throw new Error(j.error ?? "Couldn't load punch list settings."); }
      return j as PunchMeta;
    });
  }
  return metaPromise;
}
export function usePunchMeta(): PunchMeta | null {
  const [meta, setMeta] = React.useState<PunchMeta | null>(null);
  React.useEffect(() => { loadPunchMeta().then(setMeta).catch(() => setMeta(null)); }, []);
  return meta;
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json" } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 204) return undefined as T;
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j as { error?: string }).error ?? `Request failed (${res.status}).`);
  return j as T;
}

export const PARENT_ICON: Record<PunchParentType, typeof HardHat> = { job: HardHat, precon: Briefcase, deal: Workflow };

export const inputCls = "h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-accent sm:h-9";

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean;
}) {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className={cn(
        "relative z-10 flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-xl",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
      )}>
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Search Jobs, Pre-Con and Pipeline deals and pick one. */
export function TargetPicker({ value, onChange }: { value: PunchParent | null; onChange: (p: PunchParent | null) => void }) {
  const [q, setQ] = React.useState("");
  const [results, setResults] = React.useState<PunchParent[] | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (value) return;
    setLoading(true);
    const t = setTimeout(() => {
      api<PunchParent[]>(`/api/punch-lists/targets?q=${encodeURIComponent(q)}`)
        .then(setResults).catch(() => setResults([])).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(t);
  }, [q, value]);

  if (value) {
    const Icon = PARENT_ICON[value.type];
    return (
      <div className="flex items-center gap-2 rounded-md border border-accent/50 bg-accent/5 px-3 py-2 text-sm">
        <Icon className="h-4 w-4 text-accent" />
        <span className="min-w-0 flex-1 truncate"><span className="text-muted-foreground">{PARENT_LABEL[value.type]}:</span> {value.label}</span>
        <button type="button" className="text-xs text-accent hover:underline" onClick={() => onChange(null)}>Change</button>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border">
      <div className="relative border-b border-border">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search jobs, Pre-Con, pipeline…"
          className="h-10 w-full rounded-t-md bg-background pl-8 pr-3 text-sm outline-none" />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {loading && !results && <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</div>}
        {results?.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nothing matches.</div>}
        {results?.map((r) => {
          const Icon = PARENT_ICON[r.type];
          return (
            <button key={`${r.type}:${r.id}`} type="button" onClick={() => onChange(r)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{PARENT_LABEL[r.type]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function formatDue(iso: string | null): { text: string; overdue: boolean } | null {
  if (!iso) return null;
  const today = new Date().toISOString().slice(0, 10);
  const d = new Date(`${iso}T00:00:00`);
  return {
    text: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
    overdue: iso < today,
  };
}
