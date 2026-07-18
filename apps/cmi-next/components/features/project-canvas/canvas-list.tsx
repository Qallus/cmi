"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, SquarePen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "./canvas-api";
import type { Surface } from "./use-canvas-store";
import type { CanvasProject } from "@/lib/canvas/types";

const STATUS_LABEL: Record<string, string> = { draft: "Draft", submitted: "Submitted", in_review: "In review", responded: "Responded" };

export function CanvasList({ surface, basePath }: { surface: Surface; basePath: string }) {
  const router = useRouter();
  const [canvases, setCanvases] = React.useState<CanvasProject[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [isSuper, setIsSuper] = React.useState(false);

  React.useEffect(() => {
    api.apiListCanvases().then(setCanvases).catch((e) => setError(e instanceof Error ? e.message : "Could not load canvases."));
  }, []);
  React.useEffect(() => {
    if (surface !== "staff") return;
    fetch("/api/auth/me").then((r) => r.json()).then((d: { user?: { role?: string } }) => setIsSuper(d.user?.role === "super_admin")).catch(() => {});
  }, [surface]);

  async function del(id: string) {
    if (!window.confirm("Delete this canvas permanently? This can't be undone.")) return;
    setCanvases((prev) => prev?.filter((c) => c.id !== id) ?? prev);
    try { await api.apiDeleteCanvas(id); } catch (e) { setError(e instanceof Error ? e.message : "Delete failed."); }
  }

  async function create() {
    setCreating(true);
    setError(null);
    try {
      const canvas = await api.apiCreateCanvas({ title: "Untitled canvas" });
      router.push(`${basePath}/${canvas.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create a canvas.");
      setCreating(false);
    }
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Project Canvas</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{surface === "staff" ? "Canvases" : "Your Canvases"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sketch your project right on photos of your space, then send it to the team.</p>
        </div>
        <Button variant="accent" onClick={create} disabled={creating}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New canvas
        </Button>
      </div>

      {error && <div className="mb-4 text-sm text-destructive">{error}</div>}

      {canvases === null ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : canvases.length === 0 ? (
        <button type="button" onClick={create} disabled={creating} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground transition hover:border-accent/50 hover:text-foreground">
          <SquarePen className="h-6 w-6" />
          Start your first canvas
        </button>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {canvases.map((c) => (
            <div key={c.id} className="group relative rounded-xl border border-border bg-card transition hover:border-accent/50">
              <Link href={`${basePath}/${c.id}`} className="block p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{STATUS_LABEL[c.status] ?? c.status}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</span>
                </div>
                <div className="mt-2 font-medium">{c.title}</div>
              </Link>
              {isSuper && (
                <button type="button" onClick={() => del(c.id)} title="Delete canvas" aria-label="Delete canvas"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-card/80 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
