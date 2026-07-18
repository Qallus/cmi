"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MapPin, Mic, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import * as api from "./canvas-api";
import type { CanvasComment, CanvasProject, CanvasScene, CanvasStatus } from "@/lib/canvas/types";

const STATUS_FLOW: { value: CanvasStatus; label: string }[] = [
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "responded", label: "Responded" },
];

type Readback = { headline?: string; narrative?: string; chips?: string[] };

export function BriefDetail({ canvasId }: { canvasId: string }) {
  const [canvas, setCanvas] = React.useState<CanvasProject | null>(null);
  const [scenes, setScenes] = React.useState<CanvasScene[]>([]);
  const [comments, setComments] = React.useState<CanvasComment[]>([]);
  const [urls, setUrls] = React.useState<Record<string, string>>({});
  const [comment, setComment] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [{ canvas, scenes }, comments] = await Promise.all([api.apiGetCanvas(canvasId), api.apiListComments(canvasId)]);
      setCanvas(canvas); setScenes(scenes); setComments(comments);
      for (const s of scenes) {
        const path = s.flattened_path ?? s.media_path;
        if (path) api.apiMediaUrl(path).then((u) => setUrls((m) => ({ ...m, [s.id]: u }))).catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this brief.");
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  React.useEffect(() => { void load(); }, [load]);

  async function setStatus(status: CanvasStatus) {
    setBusy(true);
    try { const c = await api.apiUpdateCanvas(canvasId, { status }); setCanvas(c); } catch (e) { setError(e instanceof Error ? e.message : "Could not update status."); } finally { setBusy(false); }
  }
  async function submitComment() {
    const text = comment.trim();
    if (!text) return;
    setBusy(true);
    try { const c = await api.apiAddComment(canvasId, text); setComments((prev) => [...prev, c]); setComment(""); } catch (e) { setError(e instanceof Error ? e.message : "Could not add comment."); } finally { setBusy(false); }
  }

  if (loading) return <div className="flex h-[50vh] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  if (!canvas) return <div className="p-6 text-sm text-destructive">{error ?? "Brief not found."}</div>;

  const readback = (canvas.bolt_summary && typeof canvas.bolt_summary === "object" ? canvas.bolt_summary : null) as Readback | null;

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-6">
      <Link href="/dashboard/canvas-briefs" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Canvas Briefs</Link>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c87f3a]">Project Brief</div>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight">{canvas.title}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">{scenes.length} scene{scenes.length === 1 ? "" : "s"}{canvas.submitted_at ? ` · submitted ${new Date(canvas.submitted_at).toLocaleDateString()}` : ""}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {STATUS_FLOW.map((s) => (
            <button key={s.value} type="button" disabled={busy || canvas.status === s.value} onClick={() => setStatus(s.value)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-default ${canvas.status === s.value ? "border-accent bg-accent/10 text-accent" : "border-border text-muted-foreground hover:border-accent/50"}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mb-4 text-sm text-destructive">{error}</div>}

      {readback && (readback.headline || readback.narrative) && (
        <div className="mb-6 rounded-xl border p-4" style={{ borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))", background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-[#966e1d] dark:text-[#c99a3a]"><Sparkles className="h-3 w-3" /> Bolt&apos;s Read-Back</div>
          {readback.headline && <h3 className="font-display text-lg">{readback.headline}</h3>}
          {readback.narrative && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{readback.narrative}</p>}
          {Array.isArray(readback.chips) && readback.chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">{readback.chips.map((c, i) => <span key={i} className="rounded-full border border-border bg-card px-2 py-0.5 text-[10.5px] font-semibold text-muted-foreground">{c}</span>)}</div>
          )}
        </div>
      )}

      <div className="space-y-6">
        {scenes.map((s, i) => {
          const notes = s.annotations.pins;
          return (
            <div key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-sm font-semibold"><span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span> Scene {i + 1}</div>
              <div className="bg-[#20261f]">
                {urls[s.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urls[s.id]} alt={`Scene ${i + 1}`} className="mx-auto max-h-[70vh] w-full object-contain" />
                ) : (
                  <div className="flex h-48 items-center justify-center text-white/60"><Loader2 className="h-5 w-5 animate-spin" /></div>
                )}
              </div>
              {notes.length > 0 && (
                <ul className="divide-y divide-border">
                  {notes.map((p) => (
                    <li key={p.id} className="flex items-start gap-2.5 px-4 py-2.5 text-sm">
                      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white ${p.kind === "voice" ? "bg-[#2e7d5b]" : "bg-[#b08427]"}`}>{p.kind === "voice" ? <Mic className="h-3 w-3" /> : (p.number ?? "•")}</span>
                      <span className="text-muted-foreground">{p.text?.trim() || <em>(no note)</em>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {/* Comments */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">Team Comments</h2>
        <div className="space-y-2">
          {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
          {comments.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.author_name ?? "Staff"}</span><span>{new Date(c.created_at).toLocaleString()}</span></div>
              <p className="mt-1 text-sm">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-end gap-2">
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Add a comment for the team…" className="flex-1 resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          <Button variant="accent" onClick={submitComment} disabled={busy || !comment.trim()}><Send className="h-4 w-4" /> Post</Button>
        </div>
      </div>
    </div>
  );
}
